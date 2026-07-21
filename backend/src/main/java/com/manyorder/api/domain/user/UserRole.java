package com.manyorder.api.domain.user;

/**
 * MERCHANT       — self-registered store owner; full access to their own stores (max 3).
 * STAFF          — self-registered with a store code (slug); limited to one store:
 *                  view orders + products, update order/payment status only.
 * PLATFORM_ADMIN — never self-registerable. Flagged manually in the database:
 *                  UPDATE users SET role = 'PLATFORM_ADMIN' WHERE email = '...';
 */
public enum UserRole {
    MERCHANT,
    STAFF,
    PLATFORM_ADMIN
}
