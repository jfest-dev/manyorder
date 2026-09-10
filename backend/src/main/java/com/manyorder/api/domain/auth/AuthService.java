package com.manyorder.api.domain.auth;

import java.util.Map;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;

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
    private final RestClient restClient = RestClient.create();

    public AuthService(UserRepository userRepository,
                       MerchantRepository merchantRepository,
                       PasswordEncoder passwordEncoder,
                       JwtUtil jwtUtil,
                       EmailVerificationService emailVerificationService,
                       @Value("${app.google.client-id:}") String googleClientId) {
        this.userRepository = userRepository;
        this.merchantRepository = merchantRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
        this.emailVerificationService = emailVerificationService;
        this.googleClientId = googleClientId == null ? "" : googleClientId.trim();
    }

    public String getGoogleClientId() {
        return googleClientId;
    }

    public LoginResponse login(LoginRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(this::badCredentials);

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw badCredentials();
        }
        return toLoginResponse(user);
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
            staffStore = merchantRepository.findBySlugAndArchivedAtIsNull(slug)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                            "Store code not found. Ask the store owner for the store link."));
        }

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

        User user = userRepository.findByEmail(email).orElseGet(() -> {
            String randomPassword = passwordEncoder.encode(UUID.randomUUID().toString());
            User created = new User(name, email, randomPassword, UserRole.MERCHANT);
            // Google already confirmed this address (email_verified checked above),
            // so the account starts verified and needs no confirmation email.
            created.setVerified(true);
            return userRepository.save(created);
        });

        return toLoginResponse(user);
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
        String token = jwtUtil.generateToken(user.getId(), user.getEmail(), user.getRole().name());
        Long staffStoreId = user.getStaffStore() != null ? user.getStaffStore().getId() : null;
        return new LoginResponse(
                user.getId(), user.getFullName(), user.getEmail(),
                user.getRole(), staffStoreId, user.isVerified(), token);
    }

    private ResponseStatusException badCredentials() {
        return new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password");
    }
}
