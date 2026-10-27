package com.manyorder.api.util;

/** Shared phone-number handling so every path compares numbers the same way. */
public final class PhoneNumbers {

    private PhoneNumbers() {}

    /**
     * Normalize a phone number to digits only (drops spaces, dashes, parentheses,
     * the leading '+', etc.), for identity matching. A null/blank input, or one
     * with no digits, returns "". Country-code differences (with vs without a
     * prefix like +65) are intentionally NOT reconciled here - that is a separate
     * concern; this only makes formatting differences of the same number match.
     */
    public static String normalize(String phone) {
        return phone == null ? "" : phone.replaceAll("\\D", "");
    }
}
