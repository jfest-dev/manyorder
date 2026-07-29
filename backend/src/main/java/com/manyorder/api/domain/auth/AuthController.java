package com.manyorder.api.domain.auth;

import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.manyorder.api.domain.passwordreset.ForgotPasswordRequest;
import com.manyorder.api.domain.passwordreset.PasswordResetService;
import com.manyorder.api.domain.passwordreset.ResetPasswordRequest;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/auth")
public class AuthController {

    private final AuthService authService;
    private final PasswordResetService passwordResetService;

    public AuthController(AuthService authService, PasswordResetService passwordResetService) {
        this.authService = authService;
        this.passwordResetService = passwordResetService;
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
}
