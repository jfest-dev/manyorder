package com.manyorder.api.domain.order;

import java.math.BigDecimal;
import java.util.List;

public class OrderItemResponse {

    private Long productId;
    private String productName;
    private Integer quantity;
    /** Base per-unit product price at order time (excludes modifiers). */
    private BigDecimal price;
    /** Effective per-unit price = base price + chosen modifier deltas. */
    private BigDecimal unitPrice;
    /** Line subtotal = effective unit price * quantity. */
    private BigDecimal lineSubtotal;
    /** Chosen modifiers for this line (empty when none). */
    private List<ModifierLine> modifiers;
    /** Per-line note (null/blank when none). */
    private String notes;

    public OrderItemResponse(
            Long productId,
            String productName,
            Integer quantity,
            BigDecimal price,
            BigDecimal unitPrice,
            BigDecimal lineSubtotal,
            List<ModifierLine> modifiers,
            String notes
    ) {
        this.productId = productId;
        this.productName = productName;
        this.quantity = quantity;
        this.price = price;
        this.unitPrice = unitPrice;
        this.lineSubtotal = lineSubtotal;
        this.modifiers = modifiers;
        this.notes = notes;
    }

    public Long getProductId() {
        return productId;
    }

    public String getProductName() {
        return productName;
    }

    public Integer getQuantity() {
        return quantity;
    }

    public BigDecimal getPrice() {
        return price;
    }

    public BigDecimal getUnitPrice() {
        return unitPrice;
    }

    public BigDecimal getLineSubtotal() {
        return lineSubtotal;
    }

    public List<ModifierLine> getModifiers() {
        return modifiers;
    }

    public String getNotes() {
        return notes;
    }

    /**
     * One chosen modifier on a line: its group, option, and price delta (snapshots),
     * plus the source option id (nullable — may point at a since-deleted option) so
     * the merchant edit form can round-trip the selection back on save.
     */
    public record ModifierLine(String groupName, String optionName, BigDecimal priceDelta, Long sourceOptionId) {}
}
