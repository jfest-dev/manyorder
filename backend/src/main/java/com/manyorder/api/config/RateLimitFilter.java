package com.manyorder.api.config;

import java.io.IOException;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.concurrent.TimeUnit;

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
 * specific limit) and a per-IP global backstop across all public endpoints. Client
 * IP comes from {@code getRemoteAddr()} — with {@code server.forward-headers-strategy:
 * framework} that reflects the real client behind a trusted proxy.
 */
@Component
public class RateLimitFilter extends OncePerRequestFilter {

    private enum Tier { STRICT, STANDARD, READS }

    private final boolean enabled;
    private final int strictPerMinute;
    private final int standardPerMinute;
    private final int readsPerMinute;
    private final int globalPerMinute;

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
            @Value("${app.ratelimit.global-per-minute:120}") int globalPerMinute) {
        this.enabled = enabled;
        this.strictPerMinute = strictPerMinute;
        this.standardPerMinute = standardPerMinute;
        this.readsPerMinute = readsPerMinute;
        this.globalPerMinute = globalPerMinute;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String path = request.getRequestURI();
        if (!enabled || !isPublic(path)) {
            chain.doFilter(request, response);
            return;
        }
        String ip = clientIp(request);
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
        return Tier.STANDARD;
    }

    /** With server.forward-headers-strategy=framework this is the real client IP
     *  behind a trusted proxy; otherwise the direct socket address. */
    private static String clientIp(HttpServletRequest request) {
        String ip = request.getRemoteAddr();
        return (ip == null || ip.isBlank()) ? "unknown" : ip;
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
