package com.manyorder.api.config;

import java.util.Date;

import javax.crypto.SecretKey;

import org.junit.jupiter.api.Test;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * JWT claims and lifetimes: the version claim round-trips, a token minted before
 * versioning (no "ver" claim) reads as version 0, and the lifetimes are 24 hours
 * for a normal session and 7 days for remember-me.
 */
class JwtUtilTest {

    private static final String SECRET = "test-secret-test-secret-test-secret-test-secret-64-bytes-min!!";
    private static final long DAY = 86_400_000L;
    private static final long WEEK = 7 * DAY;

    private final JwtUtil jwt = new JwtUtil(SECRET, DAY, WEEK);
    private final SecretKey key = Keys.hmacShaKeyFor(SECRET.getBytes());

    private Claims parse(String token) {
        return Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
    }

    @Test
    void carriesAndReadsTheVersionClaim() {
        String t = jwt.generateToken(1L, "a@test.com", "MERCHANT", false, 3);
        assertEquals(3, jwt.extractTokenVersion(t));
        assertEquals("a@test.com", jwt.extractEmail(t));
        assertEquals("MERCHANT", jwt.extractRole(t));
    }

    @Test
    void legacyTokenWithoutVersionClaimReadsAsZero() {
        // A token minted the old way, with no "ver" claim at all.
        String legacy = Jwts.builder().subject("a@test.com").claim("uid", 1L).claim("role", "MERCHANT")
                .issuedAt(new Date()).expiration(new Date(System.currentTimeMillis() + DAY))
                .signWith(key).compact();
        assertEquals(0, jwt.extractTokenVersion(legacy));
    }

    @Test
    void normalSessionLasts24HoursAndRememberLasts7Days() {
        long normal = ttlSeconds(jwt.generateToken(1L, "a@test.com", "MERCHANT", false, 0));
        long remember = ttlSeconds(jwt.generateToken(1L, "a@test.com", "MERCHANT", true, 0));
        assertEquals(24 * 3600, normal, 5, "normal session is 24 hours");
        assertEquals(7 * 24 * 3600, remember, 5, "remember-me is 7 days");
        assertTrue(remember > normal);
    }

    private long ttlSeconds(String token) {
        Claims c = parse(token);
        return (c.getExpiration().getTime() - c.getIssuedAt().getTime()) / 1000;
    }
}
