package com.manyorder.api.domain.admin;

import java.util.Optional;

import org.springframework.stereotype.Component;

/**
 * Turns an {@code /admin/merchants/{merchantId}/...} mutation (HTTP method + path)
 * into the audit fields to record: action, target type, target id (from the path,
 * so a create has none) and the store id. Pure and side-effect free so it can be
 * unit-tested and checked against every registered route by a guard test.
 *
 * <p>Returns empty for anything it does not recognise, including merchant
 * suspend/unsuspend (those are audited inline by the controller).
 */
@Component
public class AdminAuditClassifier {

    /** The resolved audit fields for one admin mutation. */
    public record Entry(String action, String targetType, Long targetId, Long merchantId) {}

    public Optional<Entry> classify(String httpMethod, String path) {
        if (path == null) return Optional.empty();
        String clean = path.split("\\?", 2)[0];
        String[] seg = clean.split("/");
        // Expect: ["", "admin", "merchants", "{mid}", entity, ...rest]
        if (seg.length < 5 || !"admin".equals(seg[1]) || !"merchants".equals(seg[2])) {
            return Optional.empty();
        }
        Long merchantId = parseLong(seg[3]);
        if (merchantId == null) return Optional.empty();

        String method = httpMethod == null ? "" : httpMethod.toUpperCase();
        String entity = seg[4];
        // Segments after the entity, e.g. ["{id}"], ["reorder"], ["{id}","activate"].
        String rest1 = seg.length > 5 ? seg[5] : null;
        String rest2 = seg.length > 6 ? seg[6] : null;

        return switch (entity) {
            case "products" -> product(method, rest1, rest2, merchantId);
            case "customers" -> customer(method, rest1, merchantId);
            case "discounts" -> discount(method, rest1, rest2, merchantId);
            case "orders" -> order(method, rest1, rest2, merchantId);
            default -> Optional.empty(); // suspend / unsuspend / anything else
        };
    }

    private Optional<Entry> product(String method, String rest1, String rest2, Long mid) {
        if ("POST".equals(method) && rest1 == null) return entry("CREATE_PRODUCT", "PRODUCT", null, mid);
        if ("PATCH".equals(method) && "reorder".equals(rest1)) return entry("REORDER_PRODUCTS", "PRODUCT", null, mid);
        Long id = parseLong(rest1);
        if (id == null) return Optional.empty();
        if ("PATCH".equals(method) && rest2 == null) return entry("UPDATE_PRODUCT", "PRODUCT", id, mid);
        if ("PATCH".equals(method) && "activate".equals(rest2)) return entry("ACTIVATE_PRODUCT", "PRODUCT", id, mid);
        if ("PATCH".equals(method) && "deactivate".equals(rest2)) return entry("DEACTIVATE_PRODUCT", "PRODUCT", id, mid);
        if ("DELETE".equals(method) && rest2 == null) return entry("DELETE_PRODUCT", "PRODUCT", id, mid);
        return Optional.empty();
    }

    private Optional<Entry> customer(String method, String rest1, Long mid) {
        if ("POST".equals(method) && rest1 == null) return entry("CREATE_CUSTOMER", "CUSTOMER", null, mid);
        Long id = parseLong(rest1);
        if (id == null) return Optional.empty();
        if ("PUT".equals(method)) return entry("UPDATE_CUSTOMER", "CUSTOMER", id, mid);
        if ("DELETE".equals(method)) return entry("DELETE_CUSTOMER", "CUSTOMER", id, mid);
        return Optional.empty();
    }

    private Optional<Entry> discount(String method, String rest1, String rest2, Long mid) {
        if ("POST".equals(method) && rest1 == null) return entry("CREATE_DISCOUNT", "DISCOUNT", null, mid);
        if ("PATCH".equals(method) && "reorder".equals(rest1)) return entry("REORDER_DISCOUNTS", "DISCOUNT", null, mid);
        Long id = parseLong(rest1);
        if (id == null) return Optional.empty();
        if ("PATCH".equals(method) && "activate".equals(rest2)) return entry("ACTIVATE_DISCOUNT", "DISCOUNT", id, mid);
        if ("PATCH".equals(method) && "deactivate".equals(rest2)) return entry("DEACTIVATE_DISCOUNT", "DISCOUNT", id, mid);
        if ("PATCH".equals(method) && rest2 == null) return entry("UPDATE_DISCOUNT", "DISCOUNT", id, mid);
        if ("DELETE".equals(method) && rest2 == null) return entry("DELETE_DISCOUNT", "DISCOUNT", id, mid);
        return Optional.empty();
    }

    private Optional<Entry> order(String method, String rest1, String rest2, Long mid) {
        Long id = parseLong(rest1);
        if (id == null || !"PATCH".equals(method)) return Optional.empty();
        if ("status".equals(rest2)) return entry("UPDATE_ORDER_STATUS", "ORDER", id, mid);
        if ("payment-status".equals(rest2)) return entry("UPDATE_ORDER_PAYMENT_STATUS", "ORDER", id, mid);
        return Optional.empty();
    }

    private Optional<Entry> entry(String action, String targetType, Long targetId, Long merchantId) {
        return Optional.of(new Entry(action, targetType, targetId, merchantId));
    }

    private Long parseLong(String s) {
        if (s == null) return null;
        try {
            return Long.valueOf(s);
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
