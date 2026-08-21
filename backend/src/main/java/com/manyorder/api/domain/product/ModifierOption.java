package com.manyorder.api.domain.product;

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
 * A single choosable add-on within a {@link ModifierGroup} — e.g. "Extra shot"
 * with a price added on top of the base product price. priceDelta is >= 0
 * (add-ons only for now).
 */
@Entity
@Table(name = "modifier_options")
public class ModifierOption {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "group_id", nullable = false)
    private ModifierGroup group;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private BigDecimal priceDelta = BigDecimal.ZERO;

    @Column(nullable = false, columnDefinition = "integer default 0 not null")
    private int sortOrder = 0;

    protected ModifierOption() { /* JPA */ }

    public ModifierOption(ModifierGroup group, String name, BigDecimal priceDelta, int sortOrder) {
        this.group = group;
        this.name = name;
        this.priceDelta = priceDelta == null ? BigDecimal.ZERO : priceDelta;
        this.sortOrder = sortOrder;
    }

    public Long getId() { return id; }
    public ModifierGroup getGroup() { return group; }
    public String getName() { return name; }
    public BigDecimal getPriceDelta() { return priceDelta; }
    public int getSortOrder() { return sortOrder; }

    // Setters for reconcile-on-save: an option that still exists (matched by id)
    // is updated in place, keeping its id stable so cart references survive.
    public void setName(String name) { this.name = name; }
    public void setPriceDelta(BigDecimal priceDelta) { this.priceDelta = priceDelta == null ? BigDecimal.ZERO : priceDelta; }
    public void setSortOrder(int sortOrder) { this.sortOrder = sortOrder; }
}
