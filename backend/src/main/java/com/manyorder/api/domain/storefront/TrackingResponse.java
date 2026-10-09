package com.manyorder.api.domain.storefront;

import java.math.BigDecimal;
import java.util.List;

/**
 * Deliberately minimal, privacy-safe view of a checkout for the public tracking page.
 * Carries only what a customer needs to see their order status. It never includes the
 * customer's name, phone, email or delivery address.
 */
public record TrackingResponse(
        String storeName,
        String contactLink,
        String orderType,          // fulfilment type: PICKUP | DELIVERY
        String notes,              // the order's own notes to the store
        List<Long> orderNumbers,
        BigDecimal subtotal,
        BigDecimal deliveryFee,
        BigDecimal discount,
        BigDecimal total,
        List<TrackedOrder> orders) {

    public record TrackedOrder(Long orderNumber, String kind, String status, List<Item> items) {}

    public record Item(String name, int quantity, BigDecimal unitPrice, BigDecimal lineSubtotal,
                       List<Modifier> modifiers, String notes) {}

    public record Modifier(String groupName, String optionName, BigDecimal priceDelta) {}
}
