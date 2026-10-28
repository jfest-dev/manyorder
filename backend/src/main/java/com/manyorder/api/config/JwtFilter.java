package com.manyorder.api.config;

import java.io.IOException;

import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import com.manyorder.api.domain.user.User;
import com.manyorder.api.domain.user.UserRepository;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.util.List;

@Component
public class JwtFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;
    private final UserRepository userRepository;

    public JwtFilter(JwtUtil jwtUtil, UserRepository userRepository) {
        this.jwtUtil = jwtUtil;
        this.userRepository = userRepository;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {

        String authHeader = request.getHeader("Authorization");

        if (authHeader != null && authHeader.startsWith("Bearer ") && jwtUtil.isTokenValid(authHeader.substring(7))) {
            String token = authHeader.substring(7);
            String email = jwtUtil.extractEmail(token);
            // Load the account once here and verify the token's version against it, so a
            // token issued before a password change / reset / "sign out everywhere" is
            // rejected. The loaded user is stashed as the authentication details and
            // reused by CurrentUserService, so this adds no extra query per request.
            User user = userRepository.findWithStaffStoreByEmail(email).orElse(null);
            if (user != null && jwtUtil.extractTokenVersion(token) >= user.tokenVersion()) {
                UsernamePasswordAuthenticationToken authentication =
                        new UsernamePasswordAuthenticationToken(
                                email,
                                null,
                                List.of(new SimpleGrantedAuthority("ROLE_" + jwtUtil.extractRole(token))));
                authentication.setDetails(user);
                SecurityContextHolder.getContext().setAuthentication(authentication);
            }
            // A stale (lower-version) token or an unknown email leaves the context
            // unauthenticated, so the request is refused downstream like any other.
        }

        filterChain.doFilter(request, response);
    }
}
