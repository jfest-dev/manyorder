package com.manyorder.api.domain.category;

import java.time.LocalDateTime;

import com.manyorder.api.domain.merchant.Merchant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

/**
 * A product category, scoped per store (merchant). Managed by the merchant on
 * the Categories screen; products reference one (optionally). Ordered by
 * displayOrder for the storefront category browser.
 */
@Entity
@Table(name = "categories",
       uniqueConstraints = @UniqueConstraint(columnNames = {"merchant_id", "name"}))
public class Category {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "merchant_id", nullable = false)
    private Merchant merchant;

    @Column(nullable = false)
    private String name;

    /** Hex color for the storefront browser, e.g. "#8B5CF6". Optional. */
    private String color;

    @Column(nullable = false, columnDefinition = "integer default 0 not null")
    private Integer displayOrder = 0;

    private LocalDateTime createdAt;

    protected Category() {}

    public Category(Merchant merchant, String name, String color, Integer displayOrder) {
        this.merchant = merchant;
        this.name = name;
        this.color = color;
        this.displayOrder = displayOrder != null ? displayOrder : 0;
        this.createdAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public Merchant getMerchant() { return merchant; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getColor() { return color; }
    public void setColor(String color) { this.color = color; }
    public Integer getDisplayOrder() { return displayOrder; }
    public void setDisplayOrder(Integer displayOrder) { this.displayOrder = displayOrder; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
