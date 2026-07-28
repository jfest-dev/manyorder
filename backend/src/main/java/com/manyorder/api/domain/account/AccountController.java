package com.manyorder.api.domain.account;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

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

    public AccountController(CurrentUserService currentUserService,
                            UserRepository userRepository,
                            PasswordEncoder passwordEncoder) {
        this.currentUserService = currentUserService;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    /**
     * Change the signed-in user's password. Verification is atomic with the
     * change: resolve the user, confirm the current password (403 on mismatch,
     * nothing changes), then encode and persist the new one. The session uses a
     * stateless JWT, so this does not revoke any already-issued token — the
     * current device stays signed in.
     */
    @PostMapping("/change-password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void changePassword(@Valid @RequestBody ChangePasswordRequest request,
                               Authentication authentication) {
        User user = currentUserService.require(authentication);

        if (!passwordEncoder.matches(request.getCurrentPassword(), user.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Incorrect password");
        }

        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);
    }
}
