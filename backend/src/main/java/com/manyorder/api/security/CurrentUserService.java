package com.manyorder.api.security;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import com.manyorder.api.domain.user.User;
import com.manyorder.api.domain.user.UserRepository;

/** Resolves the authenticated User from the JWT-derived security context. */
@Service
public class CurrentUserService {

    private final UserRepository userRepository;

    public CurrentUserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public User require(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Not authenticated");
        }
        // The JwtFilter already loaded and version-checked the user; reuse it rather
        // than querying again (keeps one user load per authenticated request).
        if (authentication.getDetails() instanceof User cached
                && cached.getEmail() != null
                && cached.getEmail().equals(authentication.getName())) {
            return cached;
        }
        return userRepository.findByEmail(authentication.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));
    }
}
