package com.manyorder.api.domain.order;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

import com.manyorder.api.domain.product.Product;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;

@Entity
@Table(name = "order_items")
public class OrderItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", nullable = false)
    private Order order;

    /** The ordered product. Nullable: it is set to null when the product is
     *  permanently deleted, so past orders survive — {@link #productName} keeps
     *  the label and {@link #price} the amount charged. */
    @ManyToOne(optional = true, fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id")
    private Product product;

    /** Product name at order time (a snapshot), so order history reads correctly
     *  even after the product row is deleted. */
    @Column(nullable = false, length = 255)
    private String productName;

    @Column(nullable = false)
    private Integer quantity;

    /** Base per-unit product price at order time (a snapshot). The effective unit
     *  price adds the chosen modifiers — see {@link #getLineSubtotal()}. */
    @Column(nullable = false)
    private BigDecimal price;

    /** Per-line customer note (e.g. "less sugar"), separate from the order-wide notes. */
    @Column(columnDefinition = "TEXT")
    private String notes;

    @OneToMany(mappedBy = "orderItem", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<OrderItemModifier> modifiers = new ArrayList<>();

    protected OrderItem() {
        // JPA only
    }

    public OrderItem(Order order, Product product, Integer quantity, BigDecimal price) {
        this.order = order;
        this.product = product;
        this.productName = product.getName(); // snapshot, survives product deletion
        this.quantity = quantity;
        this.price = price;
    }

    /** Cleared when the referenced product is permanently deleted. */
    public void detachProduct() { this.product = null; }

    public String getProductName() { return productName; }

    public void addModifier(OrderItemModifier modifier) { this.modifiers.add(modifier); }

    /** Sum of the chosen modifier deltas for one unit. */
    public BigDecimal getModifiersTotal() {
        return modifiers.stream().map(OrderItemModifier::getPriceDelta).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    /** Effective per-unit price = base price + modifiers. */
    public BigDecimal getUnitPrice() {
        return price.add(getModifiersTotal());
    }

    /** Line subtotal = effective unit price * quantity — the single source for all subtotal math. */
    public BigDecimal getLineSubtotal() {
        return getUnitPrice().multiply(BigDecimal.valueOf(quantity));
    }

    public Long getId() {
        return id;
    }

    public Order getOrder() {
        return order;
    }

    public Product getProduct() {
        return product;
    }

    public Integer getQuantity() {
        return quantity;
    }

    public BigDecimal getPrice() {
        return price;
    }

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }

    public List<OrderItemModifier> getModifiers() { return modifiers; }
}