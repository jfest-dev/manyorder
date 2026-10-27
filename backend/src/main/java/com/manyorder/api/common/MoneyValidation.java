package com.manyorder.api.common;

import java.math.BigDecimal;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/**
 * Currency-aware guard for merchant-entered money, matching the frontend's
 * {@code parseMoneyInput}: SGD amounts carry at most 2 decimal places, IDR
 * amounts are whole numbers. This is the server-side backstop against a bad
 * value slipping in via the API — most importantly an IDR price entered with a
 * stray decimal (e.g. 25.000 meaning 25000), which would otherwise persist as a
 * 1000× error.
 */
public final class MoneyValidation {

    private MoneyValidation() {}

    /** Max decimal places a currency's amounts may carry. */
    private static int maxScale(String currency) {
        return "IDR".equalsIgnoreCase(currency == null ? "" : currency.trim()) ? 0 : 2;
    }

    /**
     * Reject an amount whose decimal scale is too fine for the currency (400).
     * Null amounts are allowed through (they mean "unset" for optional fields);
     * presence/positivity are enforced separately by bean validation.
     */
    public static void requireValidScale(BigDecimal amount, String currency, String fieldLabel) {
        if (amount == null) return;
        int max = maxScale(currency);
        // stripTrailingZeros so "25000.00" (scale 2, integral) still counts as a
        // whole number for IDR; a genuine fractional part raises the scale above max.
        if (amount.stripTrailingZeros().scale() > max) {
            String code = currency == null ? "this currency" : currency.toUpperCase();
            String msg = max == 0
                    ? fieldLabel + " must be a whole number for " + code + "."
                    : fieldLabel + " can have at most " + max + " decimal places for " + code + ".";
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, msg);
        }
    }
}
