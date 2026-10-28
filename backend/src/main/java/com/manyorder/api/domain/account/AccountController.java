package com.manyorder.api.domain.account;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.manyorder.api.domain.auth.AuthService;
import com.manyorder.api.domain.auth.LoginResponse;
import com.manyorder.api.domain.user.User;
import com.manyorder.api.domain.user.UserRepository;
import com.manyorder.api.security.CurrentUserService;

import jakarta.validation.Valid;

/**
 * Account-level actions that apply to the signed-in user, not to any one store.
 * Covered by {@code anyRequest().authenticated()} in SecurityConfig.
 */
@RestController
@RequestMapping("/account")
public class AccountController {

    private final CurrentUserService currentUserService;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthService authService;

    public AccountController(CurrentUserService currentUserService,
                            UserRepository userRepository,
                            PasswordEncoder passwordEncoder,
                            AuthService authService) {
        this.currentUserService = currentUserService;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.authService = authService;
    }

    /** The signed-in user's own account details (name, email, phone, verified). */
    @GetMapping
    public AccountResponse me(Authentication authentication) {
        return AccountResponse.from(currentUserService.require(authentication));
    }

    /**
     * Update the signed-in user's own full name and optional phone. Acts only on
     * the current user (no id in the request) and never touches email, role or
     * verified status. Name is trimmed and required (1 to 100 chars); an empty
     * phone clears it.
     */
    @PutMapping
    public AccountResponse updateProfile(@Valid @RequestBody UpdateAccountRequest request,
                                         Authentication authentication) {
        User user = currentUserService.require(authentication);
        String name = request.getFullName() == null ? "" : request.getFullName().trim();
        if (name.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Name is required");
        }
        String phone = request.getPhone() == null ? "" : request.getPhone().trim();
        user.setFullName(name);
        user.setPhone(phone.isEmpty() ? null : phone);
        userRepository.save(user);
        return AccountResponse.from(user);
    }

    /**
     * Change the signed-in user's password. Verification is atomic with the change:
     * resolve the user, confirm the current password (403 on mismatch, nothing
     * changes), then encode and persist the new one. The token version is bumped so
     * every other device is signed out, and a fresh token is returned so THIS device
     * stays signed in.
     */
    @PostMapping("/change-password")
    public LoginResponse changePassword(@Valid @RequestBody ChangePasswordRequest request,
                                        Authentication authentication) {
        User user = currentUserService.require(authentication);
        com.manyorder.api.common.Passwords.requireNoWhitespace(request.getNewPassword());
        com.manyorder.api.common.Passwords.requireWithinMaxLength(request.getNewPassword());

        if (!passwordEncoder.matches(request.getCurrentPassword().trim(), user.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Incorrect password");
        }

        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        user.bumpTokenVersion();
        userRepository.save(user);
        return authService.toLoginResponse(user);
    }

    /**
     * Sign out every other device: bump the token version so all previously issued
     * tokens stop verifying, and return a fresh token so the current device keeps
     * working.
     */
    @PostMapping("/sign-out-everywhere")
    public LoginResponse signOutEverywhere(Authentication authentication) {
        User user = currentUserService.require(authentication);
        user.bumpTokenVersion();
        userRepository.save(user);
        return authService.toLoginResponse(user);
    }
}
