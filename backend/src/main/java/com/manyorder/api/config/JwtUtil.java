package com.manyorder.api.config;

import java.util.Date;

import javax.crypto.SecretKey;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

@Component
public class JwtUtil {

    private final SecretKey secretKey;
    private final long expirationMs;
    private final long rememberExpirationMs;

    public JwtUtil(
            @Value("${app.jwt.secret}") String secret,
            @Value("${app.jwt.expiration-ms}") long expirationMs,
            @Value("${app.jwt.remember-expiration-ms:604800000}") long rememberExpirationMs) {
        this.secretKey = Keys.hmacShaKeyFor(secret.getBytes());
        this.expirationMs = expirationMs;
        this.rememberExpirationMs = rememberExpirationMs;
    }

    /** Standard-lifetime token (the default session length), token version 0. */
    public String generateToken(Long userId, String email, String role) {
        return generateToken(userId, email, role, false, 0);
    }

    /**
     * Build a signed token. When {@code rememberMe}, it lasts the longer remember-me
     * lifetime instead of the standard one. {@code tokenVersion} is carried as a "ver"
     * claim so the auth filter can reject a token older than the account's version.
     */
    public String generateToken(Long userId, String email, String role, boolean rememberMe, int tokenVersion) {
        long ttl = rememberMe ? rememberExpirationMs : expirationMs;
        return Jwts.builder()
                .subject(email)
                .claim("uid", userId)
                .claim("role", role)
                .claim("ver", tokenVersion)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + ttl))
                .signWith(secretKey)
                .compact();
    }

    /** The token's version claim, or 0 when absent (tokens issued before versioning). */
    public int extractTokenVersion(String token) {
        Object ver = getClaims(token).get("ver");
        return ver instanceof Number n ? n.intValue() : 0;
    }

    public String extractEmail(String token) {
        return getClaims(token).getSubject();
    }

    public Long extractUserId(String token) {
        Object uid = getClaims(token).get("uid");
        return uid instanceof Number n ? n.longValue() : null;
    }

    public String extractRole(String token) {
        return getClaims(token).get("role", String.class);
    }

    public boolean isTokenValid(String token) {
        try {
            getClaims(token);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private Claims getClaims(String token) {
        return Jwts.parser()
                .verifyWith(secretKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
