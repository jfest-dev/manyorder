package com.manyorder.api.domain.auth;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;

import com.manyorder.api.common.Passwords;
import com.manyorder.api.config.JwtUtil;
import com.manyorder.api.domain.emailverification.EmailVerificationService;
import com.manyorder.api.domain.merchant.Merchant;
import com.manyorder.api.domain.merchant.MerchantRepository;
import com.manyorder.api.domain.user.User;
import com.manyorder.api.domain.user.UserRepository;
import com.manyorder.api.domain.user.UserRole;

@Service
public class AuthService {

    private static final String GOOGLE_TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo?id_token={token}";

    private final UserRepository userRepository;
    private final MerchantRepository merchantRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final EmailVerificationService emailVerificationService;
    private final String googleClientId;
    private final String supportEmail;
    private final Clock clock;
    private final RestClient restClient = RestClient.create();

    /** Lock an account after this many consecutive wrong passwords. Platform admin
     *  gets the higher threshold. */
    private static final int MAX_FAILED_ATTEMPTS = 5;
    private static final int MAX_FAILED_ATTEMPTS_ADMIN = 10;
    /** How long an account stays locked once the threshold is crossed. */
    private static final int LOCK_MINUTES = 15;
    /** One message and status for wrong password, locked account, and unknown email,
     *  so none of them can be told apart from the response. */
    private static final String SIGN_IN_FAILED_MESSAGE =
            "Invalid email or password, or too many attempts. Try again in a few minutes.";

    /** A valid hash to compare against when the email is unknown, so an unknown
     *  email costs about the same time as a wrong password (no timing oracle). */
    private final String dummyHash;

    public AuthService(UserRepository userRepository,
                       MerchantRepository merchantRepository,
                       PasswordEncoder passwordEncoder,
                       JwtUtil jwtUtil,
                       EmailVerificationService emailVerificationService,
                       @Value("${app.google.client-id:}") String googleClientId,
                       @Value("${app.support.email:support@manyorder.app}") String supportEmail,
                       Clock clock) {
        this.userRepository = userRepository;
        this.merchantRepository = merchantRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
        this.emailVerificationService = emailVerificationService;
        this.googleClientId = googleClientId == null ? "" : googleClientId.trim();
        this.supportEmail = supportEmail;
        this.clock = clock;
        this.dummyHash = passwordEncoder.encode("sign-in-timing-equalizer");
    }

    public String getGoogleClientId() {
        return googleClientId;
    }

    public LoginResponse login(LoginRequest request) {
        User user = userRepository.findByEmail(request.getEmail()).orElse(null);
        if (user == null) {
            // Unknown email: do a throwaway hash comparison so the timing matches a
            // wrong password, then fail with the same message. No counter is kept
            // for a non-existent account.
            passwordEncoder.matches(request.getPassword().trim(), dummyHash);
            throw signInFailed();
        }

        LocalDateTime now = LocalDateTime.now(clock);
        // A locked account is refused before the password is even checked, so a
        // correct password during a lock is still rejected and the lock is not
        // revealed (same message as a wrong password).
        if (isLocked(user, now)) {
            throw signInFailed();
        }

        if (!passwordEncoder.matches(request.getPassword().trim(), user.getPasswordHash())) {
            registerFailedAttempt(user, now);
            throw signInFailed();
        }

        // Correct password: clear any failure state before anything else can throw.
        clearFailedAttempts(user);
        // Upgrade-on-login: migrate an older hash (bare bcrypt) to the current
        // default (Argon2id) using the password we just verified. The plaintext is
        // only re-encoded, never logged or stored.
        if (passwordEncoder.upgradeEncoding(user.getPasswordHash())) {
            user.setPasswordHash(passwordEncoder.encode(request.getPassword().trim()));
            userRepository.save(user);
        }
        requireNotSuspended(user);
        // Remember me extends the session to the longer lifetime, except a platform
        // admin always gets the standard (short) lifetime whatever the box says.
        boolean longLived = request.isRemember() && user.getRole() != UserRole.PLATFORM_ADMIN;
        return toLoginResponse(user, longLived);
    }

    private boolean isLocked(User user, LocalDateTime now) {
        return user.getLockedUntil() != null && now.isBefore(user.getLockedUntil());
    }

    private int failedAttemptThreshold(User user) {
        return user.getRole() == UserRole.PLATFORM_ADMIN ? MAX_FAILED_ATTEMPTS_ADMIN : MAX_FAILED_ATTEMPTS;
    }

    /** Count a wrong password for an existing account and lock it once the threshold
     *  is crossed. An already-expired lock starts a fresh count. */
    private void registerFailedAttempt(User user, LocalDateTime now) {
        int attempts = user.getFailedLoginAttempts() == null ? 0 : user.getFailedLoginAttempts();
        if (user.getLockedUntil() != null && !now.isBefore(user.getLockedUntil())) {
            attempts = 0; // previous lock has expired
            user.setLockedUntil(null);
        }
        attempts++;
        user.setFailedLoginAttempts(attempts);
        if (attempts >= failedAttemptThreshold(user)) {
            user.setLockedUntil(now.plusMinutes(LOCK_MINUTES));
        }
        userRepository.save(user);
    }

    private void clearFailedAttempts(User user) {
        if (user.getFailedLoginAttempts() != null || user.getLockedUntil() != null) {
            user.setFailedLoginAttempts(null);
            user.setLockedUntil(null);
            userRepository.save(user);
        }
    }

    /** Block sign-in for an admin-suspended account: a MERCHANT with any suspended
     *  store, or STAFF whose assigned store is suspended. */
    private void requireNotSuspended(User user) {
        boolean suspended = switch (user.getRole()) {
            case MERCHANT -> merchantRepository.existsByOwnerAndSuspendedAtIsNotNull(user);
            case STAFF -> user.getStaffStore() != null && user.getStaffStore().isSuspended();
            default -> false;
        };
        if (suspended) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "This account has been suspended. Please contact support at " + supportEmail + ".");
        }
    }

    public LoginResponse register(RegisterRequest request) {
        UserRole role = parseSelfServiceRole(request.getRole());

        if (userRepository.existsByEmail(request.getEmail())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already registered");
        }

        Merchant staffStore = null;
        if (role == UserRole.STAFF) {
            String slug = request.getStoreSlug() == null ? "" : request.getStoreSlug().trim().toLowerCase();
            if (slug.isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Store code is required for staff accounts");
            }
            staffStore = merchantRepository.findBySlugAndArchivedAtIsNullAndSuspendedAtIsNull(slug)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                            "Store code not found. Ask the store owner for the store link."));
        }

        // Passwords may not contain whitespace at all (login still trims, so a
        // pasted trailing space there is harmless). Reject rather than silently strip.
        Passwords.requireNoWhitespace(request.getPassword());
        Passwords.requireWithinMaxLength(request.getPassword());
        String hashed = passwordEncoder.encode(request.getPassword());
        User user = new User(request.getFullName(), request.getEmail(), hashed, role);
        user.setStaffStore(staffStore);
        userRepository.save(user);

        // Fire the confirmation email. No-ops when Resend is unconfigured and
        // never throws, so a send issue can't fail the registration.
        emailVerificationService.sendVerification(user);

        return toLoginResponse(user);
    }

    /** Resend the confirmation email to the current account (silent when already verified). */
    public void resendVerification(User user) {
        emailVerificationService.sendVerification(user);
    }

    /**
     * Google Sign-In for MERCHANT accounts. The SPA obtains an ID token via
     * Google Identity Services; we verify it against Google's tokeninfo
     * endpoint (fine for demo/low volume — production would verify the JWT
     * signature locally against Google's JWKS) and check the audience.
     * Env-gated: disabled with a clear message when GOOGLE_CLIENT_ID is unset.
     */
    public LoginResponse loginWithGoogle(GoogleAuthRequest request) {
        if (googleClientId.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Google sign-in is not configured on this server");
        }

        Map<String, Object> claims;
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> body = restClient.get()
                    .uri(GOOGLE_TOKENINFO_URL, request.getIdToken())
                    .retrieve()
                    .body(Map.class);
            claims = body;
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid Google token");
        }

        if (claims == null
                || !googleClientId.equals(claims.get("aud"))
                || !"true".equals(String.valueOf(claims.get("email_verified")))) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid Google token");
        }

        String email = String.valueOf(claims.get("email"));
        String name = claims.get("name") != null ? String.valueOf(claims.get("name")) : email;

        User user = resolveGoogleUser(email, name);
        requireNotSuspended(user);
        return toLoginResponse(user);
    }

    /**
     * Resolve the account for a Google-verified email. A verified account links as-is.
     * An UNVERIFIED existing account is taken over: Google has proven ownership of the
     * address, so its password is rotated to a random value (locking out whoever
     * registered it but never confirmed it, e.g. a squatter) and it is marked verified.
     * With no account, a verified MERCHANT is created. Package-private so the takeover
     * logic can be tested without a live Google token.
     */
    User resolveGoogleUser(String email, String name) {
        return userRepository.findByEmail(email).map(existing -> {
            if (!existing.isVerified()) {
                existing.setPasswordHash(passwordEncoder.encode(UUID.randomUUID().toString()));
                existing.setVerified(true);
                userRepository.save(existing);
            }
            return existing;
        }).orElseGet(() -> {
            // Google already confirmed this address (email_verified checked above),
            // so the account starts verified and needs no confirmation email.
            User created = new User(name, email, passwordEncoder.encode(UUID.randomUUID().toString()), UserRole.MERCHANT);
            created.setVerified(true);
            return userRepository.save(created);
        });
    }

    private UserRole parseSelfServiceRole(String raw) {
        String value = raw == null ? "" : raw.trim().toUpperCase();
        if (value.equals("MERCHANT")) return UserRole.MERCHANT;
        if (value.equals("STAFF")) return UserRole.STAFF;
        // PLATFORM_ADMIN (or anything else) is never self-registerable.
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Role must be MERCHANT or STAFF");
    }

    /** Build the session payload for a user, minting a fresh JWT. Public so the
     *  authenticated /auth/me can re-serve current state (e.g. verified flag). */
    public LoginResponse toLoginResponse(User user) {
        return toLoginResponse(user, false);
    }

    public LoginResponse toLoginResponse(User user, boolean rememberMe) {
        String token = jwtUtil.generateToken(user.getId(), user.getEmail(), user.getRole().name(), rememberMe);
        Long staffStoreId = user.getStaffStore() != null ? user.getStaffStore().getId() : null;
        return new LoginResponse(
                user.getId(), user.getFullName(), user.getEmail(),
                user.getRole(), staffStoreId, user.isVerified(), token);
    }

    private ResponseStatusException signInFailed() {
        return new ResponseStatusException(HttpStatus.UNAUTHORIZED, SIGN_IN_FAILED_MESSAGE);
    }
}
