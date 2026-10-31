package com.manyorder.api.config;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.concurrent.TimeUnit;
import java.util.regex.Pattern;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.ConsumptionProbe;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Per-IP rate limiting for the public surface ({@code /auth/**}, {@code /public/**}).
 * In-memory token buckets (Bucket4j) held in a Caffeine cache that evicts idle IPs,
 * so it needs no Redis and is correct for a SINGLE instance only. If the app is ever
 * scaled horizontally, swap the bucket store for a distributed one (bucket4j-redis).
 *
 * <p>Each request draws from two buckets: the endpoint's tier bucket (the tighter,
 * specific limit) and a per-key global backstop across all public endpoints. The
 * client key is derived by {@link #clientKey(HttpServletRequest)} (X-Real-IP, then
 * the leftmost X-Forwarded-For, then the socket address); see the trust note there.
 */
@Component
public class RateLimitFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(RateLimitFilter.class);

    private enum Tier { STRICT, STANDARD, READS }

    // IPv4 dotted quad, each octet 0-255.
    private static final Pattern IPV4 = Pattern.compile(
            "^(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(\\.(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3}$");
    // Full IPv6, including :: compression and an optional embedded IPv4 tail.
    private static final Pattern IPV6 = Pattern.compile(
            "^(" +
            "([0-9A-Fa-f]{1,4}:){7}[0-9A-Fa-f]{1,4}|" +
            "([0-9A-Fa-f]{1,4}:){1,7}:|" +
            "([0-9A-Fa-f]{1,4}:){1,6}:[0-9A-Fa-f]{1,4}|" +
            "([0-9A-Fa-f]{1,4}:){1,5}(:[0-9A-Fa-f]{1,4}){1,2}|" +
            "([0-9A-Fa-f]{1,4}:){1,4}(:[0-9A-Fa-f]{1,4}){1,3}|" +
            "([0-9A-Fa-f]{1,4}:){1,3}(:[0-9A-Fa-f]{1,4}){1,4}|" +
            "([0-9A-Fa-f]{1,4}:){1,2}(:[0-9A-Fa-f]{1,4}){1,5}|" +
            "[0-9A-Fa-f]{1,4}:(:[0-9A-Fa-f]{1,4}){1,6}|" +
            ":((:[0-9A-Fa-f]{1,4}){1,7}|:)|" +
            "::(ffff(:0{1,4})?:)?((25[0-5]|(2[0-4]|1?[0-9])?[0-9])\\.){3}(25[0-5]|(2[0-4]|1?[0-9])?[0-9])|" +
            "([0-9A-Fa-f]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1?[0-9])?[0-9])\\.){3}(25[0-5]|(2[0-4]|1?[0-9])?[0-9])" +
            ")$");

    private final boolean enabled;
    private final int strictPerMinute;
    private final int standardPerMinute;
    private final int readsPerMinute;
    private final int globalPerMinute;

    // When on (off by default), log a short hash of the derived key so a live run
    // can confirm the key is stable per client, without ever logging the address.
    private final boolean logKeyHash;
    // A random value made once at process startup: never persisted, never a secret
    // from config, so the logged hash cannot be reversed to an address or correlated
    // across restarts.
    private final byte[] keyHashSalt = newSalt();

    // One bucket per "TIER:ip" and "GLOBAL:ip". expireAfterAccess evicts IPs that
    // stop calling, keeping memory bounded; the cap is a hard safety ceiling.
    private final Cache<String, Bucket> buckets = Caffeine.newBuilder()
            .expireAfterAccess(10, TimeUnit.MINUTES)
            .maximumSize(100_000)
            .build();

    public RateLimitFilter(
            @Value("${app.ratelimit.enabled:true}") boolean enabled,
            @Value("${app.ratelimit.strict-per-minute:5}") int strictPerMinute,
            @Value("${app.ratelimit.standard-per-minute:10}") int standardPerMinute,
            @Value("${app.ratelimit.reads-per-minute:60}") int readsPerMinute,
            @Value("${app.ratelimit.global-per-minute:120}") int globalPerMinute,
            @Value("${app.ratelimit.log-key-hash:false}") boolean logKeyHash) {
        this.enabled = enabled;
        this.strictPerMinute = strictPerMinute;
        this.standardPerMinute = standardPerMinute;
        this.readsPerMinute = readsPerMinute;
        this.globalPerMinute = globalPerMinute;
        this.logKeyHash = logKeyHash;
    }

    private static byte[] newSalt() {
        byte[] salt = new byte[16];
        new SecureRandom().nextBytes(salt);
        return salt;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String path = request.getRequestURI();
        if (!enabled || !isPublic(path)) {
            chain.doFilter(request, response);
            return;
        }
        String ip = clientKey(request);
        if (logKeyHash) {
            // INFO so the line is visible during a live check without changing log
            // levels; the flag is the gate and defaults to off.
            log.info("ratelimit key hash={}", keyHashPrefix(ip));
        }
        Tier tier = resolveTier(request.getMethod(), path);

        // Endpoint tier first (usually the binding limit), then the global backstop.
        ConsumptionProbe tierProbe = bucket(tier.name() + ":" + ip, perMinute(tier)).tryConsumeAndReturnRemaining(1);
        if (!tierProbe.isConsumed()) {
            reject(request, response, tierProbe);
            return;
        }
        ConsumptionProbe globalProbe = bucket("GLOBAL:" + ip, globalPerMinute).tryConsumeAndReturnRemaining(1);
        if (!globalProbe.isConsumed()) {
            reject(request, response, globalProbe);
            return;
        }
        chain.doFilter(request, response);
    }

    private Bucket bucket(String key, int perMinute) {
        return buckets.get(key, k -> Bucket.builder()
                .addLimit(Bandwidth.builder()
                        .capacity(perMinute)
                        .refillGreedy(perMinute, Duration.ofMinutes(1))
                        .build())
                .build());
    }

    private int perMinute(Tier tier) {
        return switch (tier) {
            case STRICT -> strictPerMinute;
            case STANDARD -> standardPerMinute;
            case READS -> readsPerMinute;
        };
    }

    private static boolean isPublic(String path) {
        return path.startsWith("/auth/") || path.startsWith("/public/");
    }

    /**
     * STRICT: public POSTs that send email or create accounts (low legit frequency,
     * high abuse cost). STANDARD: brute-force / order-spam POSTs. READS: everything
     * else public (GETs, low risk). Any unmatched public POST is treated as STANDARD.
     *
     * <p>The discount EVALUATE preview is a read-only check that happens to POST a
     * cart: the storefront calls it every time the cart or fulfilment changes while
     * a code is applied. It creates nothing, so it belongs in READS, not the tight
     * STANDARD order bucket - otherwise a customer re-checking a code could both be
     * cut off and starve the shared budget the real checkout POST draws from.
     */
    private static Tier resolveTier(String method, String path) {
        if (!"POST".equals(method)) {
            return Tier.READS;
        }
        if (path.equals("/auth/forgot-password")
                || path.equals("/auth/resend-verification")
                || path.equals("/auth/register")) {
            return Tier.STRICT;
        }
        if (path.equals("/public/discounts/evaluate")) {
            return Tier.READS;
        }
        return Tier.STANDARD;
    }

    /**
     * The key a client is rate-limited under. Precedence:
     * <ol>
     *   <li>{@code X-Real-IP}, when present and a valid IP literal.</li>
     *   <li>the leftmost {@code X-Forwarded-For} entry, when valid.</li>
     *   <li>the socket address, {@code getRemoteAddr()}.</li>
     * </ol>
     * Malformed values are ignored and fall through to the next source.
     *
     * <p><b>Trust assumption.</b> {@code X-Real-IP} and {@code X-Forwarded-For} are
     * set by the client, so keying on them is safe ONLY because the Railway edge
     * overwrites both on every inbound request ({@code X-Real-IP} is its documented
     * client address, and the leftmost {@code X-Forwarded-For} is the client).
     * Without an edge that overwrites them a client could forge these headers to
     * rotate its key and evade the per-key limit (see docs/deployment-notes.md).
     * Locally no such headers are sent, so this falls back to {@code getRemoteAddr()}
     * and local development keeps working. With {@code forward-headers-strategy:
     * framework}, {@code getRemoteAddr()} itself already reflects the leftmost
     * forwarded value, so the fallback and step 2 agree.
     */
    static String clientKey(HttpServletRequest request) {
        String realIp = request.getHeader("X-Real-IP");
        if (realIp != null && isValidIp(realIp.trim())) {
            return realIp.trim();
        }
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            String leftmost = xff.split(",", 2)[0].trim();
            if (isValidIp(leftmost)) {
                return leftmost;
            }
        }
        String remote = request.getRemoteAddr();
        return (remote == null || remote.isBlank()) ? "unknown" : remote;
    }

    /** True for a well-formed IPv4 or IPv6 literal (an optional IPv6 zone id is
     *  tolerated). Anything else is treated as malformed and ignored. */
    static boolean isValidIp(String value) {
        if (value == null) {
            return false;
        }
        String s = value.trim();
        if (s.isEmpty() || s.length() > 45) {
            return false;
        }
        if (s.indexOf(':') >= 0) {
            int zone = s.indexOf('%');
            if (zone >= 0) {
                s = s.substring(0, zone);
            }
            return IPV6.matcher(s).matches();
        }
        return IPV4.matcher(s).matches();
    }

    /** First 8 hex chars of SHA-256(startup-salt || key). Not reversible to the
     *  address and not stable across restarts; for the debug log line only. */
    private String keyHashPrefix(String key) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            md.update(keyHashSalt);
            md.update(key.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(md.digest()).substring(0, 8);
        } catch (NoSuchAlgorithmException e) {
            return "nohash";
        }
    }

    private void reject(HttpServletRequest request, HttpServletResponse response, ConsumptionProbe probe)
            throws IOException {
        long retryAfterSeconds = Math.max(1, probe.getNanosToWaitForRefill() / 1_000_000_000L);
        response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
        response.setHeader("Retry-After", String.valueOf(retryAfterSeconds));
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        // Hand-built to match ApiErrorResponse's shape without depending on a shared
        // ObjectMapper bean (not exposed for injection here).
        String json = "{"
                + "\"timestamp\":\"" + LocalDateTime.now() + "\","
                + "\"status\":" + HttpStatus.TOO_MANY_REQUESTS.value() + ","
                + "\"error\":\"" + HttpStatus.TOO_MANY_REQUESTS.getReasonPhrase() + "\","
                + "\"message\":\"Too many requests. Please slow down and try again shortly.\","
                + "\"path\":\"" + jsonEscape(request.getRequestURI()) + "\"}";
        response.getWriter().write(json);
    }

    private static String jsonEscape(String s) {
        return s == null ? "" : s.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
