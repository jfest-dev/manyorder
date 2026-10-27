package com.manyorder.api.domain.order;

import java.security.SecureRandom;
import java.util.Base64;

/** Generates private, unguessable order tracking tokens (192 bits, URL-safe). */
public final class TrackingTokens {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final int BYTES = 24; // 192 bits, well above the 128-bit minimum

    private TrackingTokens() {}

    public static String generate() {
        byte[] buf = new byte[BYTES];
        RANDOM.nextBytes(buf);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(buf);
    }
}
