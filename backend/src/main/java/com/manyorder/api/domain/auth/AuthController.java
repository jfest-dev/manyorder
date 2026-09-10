package com.manyorder.api.domain.auth;

import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.manyorder.api.domain.emailverification.EmailVerificationService;
import com.manyorder.api.domain.emailverification.VerifyEmailRequest;
import com.manyorder.api.domain.passwordreset.ForgotPasswordRequest;
import com.manyorder.api.domain.passwordreset.PasswordResetService;
import com.manyorder.api.domain.passwordreset.ResetPasswordRequest;
import com.manyorder.api.domain.user.User;
import com.manyorder.api.security.CurrentUserService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/auth")
public class AuthController {

    private final AuthService authService;
    private final PasswordResetService passwordResetService;
    private final EmailVerificationService emailVerificationService;
    private final CurrentUserService currentUserService;

    public AuthController(AuthService authService,
                          PasswordResetService passwordResetService,
                          EmailVerificationService emailVerificationService,
                          CurrentUserService currentUserService) {
        this.authService = authService;
        this.passwordResetService = passwordResetService;
        this.emailVerificationService = emailVerificationService;
        this.currentUserService = currentUserService;
    }

    @PostMapping("/login")
    public LoginResponse login(@Valid @RequestBody LoginRequest request) {
        return authService.login(request);
    }

    @PostMapping("/register")
    public LoginResponse register(@Valid @RequestBody RegisterRequest request) {
        return authService.register(request);
    }

    @PostMapping("/google")
    public LoginResponse google(@Valid @RequestBody GoogleAuthRequest request) {
        return authService.loginWithGoogle(request);
    }

    /** Lets the SPA discover optional features (e.g. hide the Google button when unset). */
    @GetMapping("/config")
    public Map<String, String> config() {
        return Map.of("googleClientId", authService.getGoogleClientId());
    }

    /**
     * Request a reset link. Always 200 with the same generic message so callers
     * can't probe which emails have accounts.
     */
    @PostMapping("/forgot-password")
    public Map<String, String> forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        String message = passwordResetService.requestReset(request.getEmail());
        return Map.of("message", message);
    }

    /**
     * Complete a reset with the emailed token. 204 on success; 400 if the token
     * is invalid, expired, or already used.
     */
    @PostMapping("/reset-password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        passwordResetService.resetPassword(request.getToken(), request.getNewPassword());
    }

    /**
     * Confirm an email with the token from the verification link. 204 on
     * success; 400 if the token is invalid, expired, or already used.
     */
    @PostMapping("/verify-email")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void verifyEmail(@Valid @RequestBody VerifyEmailRequest request) {
        emailVerificationService.verify(request.getToken());
    }

    /**
     * Resend the verification email to the signed-in account. 204 regardless of
     * whether a mail actually went out (already verified, or rate-limited), so
     * nothing about account state leaks.
     */
    @PostMapping("/resend-verification")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void resendVerification(Authentication authentication) {
        authService.resendVerification(currentUserService.require(authentication));
    }

    /**
     * Current account snapshot for the signed-in user, so the SPA can refresh
     * state (notably the verified flag) without a re-login. Mints a fresh token.
     */
    @GetMapping("/me")
    public LoginResponse me(Authentication authentication) {
        User user = currentUserService.require(authentication);
        return authService.toLoginResponse(user);
    }
}
