package com.manyorder.api.domain.order;

import java.math.BigDecimal;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

/**
 * A modifier choice captured on an ordered line — a snapshot of the group/option
 * name and price at order time. Deliberately holds NO foreign key to the source
 * ModifierOption (only an informational sourceOptionId), so a merchant editing or
 * deleting a modifier later never rewrites or breaks historical orders.
 */
@Entity
@Table(name = "order_item_modifiers")
public class OrderItemModifier {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "order_item_id", nullable = false)
    private OrderItem orderItem;

    @Column(nullable = false)
    private String groupName;

    @Column(nullable = false)
    private String optionName;

    @Column(nullable = false)
    private BigDecimal priceDelta;

    /** The option this came from, for analytics only. No FK — may point at a deleted option. */
    private Long sourceOptionId;

    protected OrderItemModifier() { /* JPA */ }

    public OrderItemModifier(OrderItem orderItem, String groupName, String optionName, BigDecimal priceDelta, Long sourceOptionId) {
        this.orderItem = orderItem;
        this.groupName = groupName;
        this.optionName = optionName;
        this.priceDelta = priceDelta == null ? BigDecimal.ZERO : priceDelta;
        this.sourceOptionId = sourceOptionId;
    }

    public Long getId() { return id; }
    public OrderItem getOrderItem() { return orderItem; }
    public String getGroupName() { return groupName; }
    public String getOptionName() { return optionName; }
    public BigDecimal getPriceDelta() { return priceDelta; }
    public Long getSourceOptionId() { return sourceOptionId; }
}
