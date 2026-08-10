package com.manyorder.api.domain.product;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

import com.manyorder.api.domain.category.Category;
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

@Entity
@Table(name = "products")
public class Product {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "merchant_id", nullable = false)
    private Merchant merchant;

    @Column(nullable = false)
    private String name;

    private String description;

    @Column(nullable = false)
    private BigDecimal price;

    @Column(nullable = false)
    private Boolean isActive;

    /** Optional reference to a per-store managed category. Null = uncategorized. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id")
    private Category category;

    /** Inventory count. Out-of-stock is derived from stock == 0, not a status. */
    @Column(nullable = false, columnDefinition = "integer default 0 not null")
    private Integer stock = 0;

    /** Stock-keeping unit — free text, not enforced unique. */
    private String sku;

    /** Absolute product photo URL on the image host. Null = no photo. */
    @Column(length = 512)
    private String photoUrl;

    /** Pre-order toggle + its details (ready date / note). Not a category. */
    @Column(nullable = false, columnDefinition = "boolean default false not null")
    private boolean preOrder = false;

    private LocalDate preOrderReadyDate;

    /** Optional ready time window shown on the storefront (both required to show a range). */
    private LocalTime preOrderReadyTimeStart;
    private LocalTime preOrderReadyTimeEnd;

    private String preOrderNote;

    private LocalDateTime createdAt;

    protected Product() {
        // JPA only
    }

    public Product(Merchant merchant, String name, String description, BigDecimal price) {
        this.merchant = merchant;
        this.name = name;
        this.description = description;
        this.price = price;
        this.isActive = true;
        this.createdAt = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public Merchant getMerchant() {
        return merchant;
    }

    public String getName() {
        return name;
    }

    public String getDescription() {
        return description;
    }

    public BigDecimal getPrice() {
        return price;
    }

    public Boolean getIsActive() {
        return isActive;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setName(String name) {
        this.name = name;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public void setPrice(BigDecimal price) {
        this.price = price;
    }

    public void setIsActive(Boolean isActive) {
        this.isActive = isActive;
    }

    public Category getCategory() { return category; }
    public void setCategory(Category category) { this.category = category; }

    public Integer getStock() { return stock; }
    public void setStock(Integer stock) { this.stock = stock; }

    public String getSku() { return sku; }
    public void setSku(String sku) { this.sku = sku; }

    public String getPhotoUrl() { return photoUrl; }
    public void setPhotoUrl(String photoUrl) { this.photoUrl = photoUrl; }

    public boolean isPreOrder() { return preOrder; }
    public void setPreOrder(boolean preOrder) { this.preOrder = preOrder; }

    public LocalDate getPreOrderReadyDate() { return preOrderReadyDate; }
    public void setPreOrderReadyDate(LocalDate preOrderReadyDate) { this.preOrderReadyDate = preOrderReadyDate; }

    public LocalTime getPreOrderReadyTimeStart() { return preOrderReadyTimeStart; }
    public void setPreOrderReadyTimeStart(LocalTime preOrderReadyTimeStart) { this.preOrderReadyTimeStart = preOrderReadyTimeStart; }
    public LocalTime getPreOrderReadyTimeEnd() { return preOrderReadyTimeEnd; }
    public void setPreOrderReadyTimeEnd(LocalTime preOrderReadyTimeEnd) { this.preOrderReadyTimeEnd = preOrderReadyTimeEnd; }

    public String getPreOrderNote() { return preOrderNote; }
    public void setPreOrderNote(String preOrderNote) { this.preOrderNote = preOrderNote; }
}