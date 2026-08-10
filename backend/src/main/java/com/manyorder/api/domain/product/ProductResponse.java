package com.manyorder.api.domain.product;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

public class ProductResponse {

    private final Long id;
    private final Long merchantId;
    private final String name;
    private final String description;
    private final BigDecimal price;
    private final Boolean isActive;
    private final Long categoryId;
    private final String categoryName;
    private final Integer stock;
    private final String sku;
    private final String photoUrl;
    private final boolean preOrder;
    private final LocalDate preOrderReadyDate;
    private final LocalTime preOrderReadyTimeStart;
    private final LocalTime preOrderReadyTimeEnd;
    private final String preOrderNote;
    /** Units sold, derived from order history (see ProductService). */
    private final long unitsSold;
    private final LocalDateTime createdAt;

    public ProductResponse(Product p, long unitsSold) {
        this.id = p.getId();
        this.merchantId = p.getMerchant().getId();
        this.name = p.getName();
        this.description = p.getDescription();
        this.price = p.getPrice();
        this.isActive = p.getIsActive();
        this.categoryId = p.getCategory() != null ? p.getCategory().getId() : null;
        this.categoryName = p.getCategory() != null ? p.getCategory().getName() : null;
        this.stock = p.getStock();
        this.sku = p.getSku();
        this.photoUrl = p.getPhotoUrl();
        this.preOrder = p.isPreOrder();
        this.preOrderReadyDate = p.getPreOrderReadyDate();
        this.preOrderReadyTimeStart = p.getPreOrderReadyTimeStart();
        this.preOrderReadyTimeEnd = p.getPreOrderReadyTimeEnd();
        this.preOrderNote = p.getPreOrderNote();
        this.unitsSold = unitsSold;
        this.createdAt = p.getCreatedAt();
    }

    public Long getId() { return id; }
    public Long getMerchantId() { return merchantId; }
    public String getName() { return name; }
    public String getDescription() { return description; }
    public BigDecimal getPrice() { return price; }
    public Boolean getIsActive() { return isActive; }
    public Long getCategoryId() { return categoryId; }
    public String getCategoryName() { return categoryName; }
    public Integer getStock() { return stock; }
    public String getSku() { return sku; }
    public String getPhotoUrl() { return photoUrl; }
    public boolean isPreOrder() { return preOrder; }
    public LocalDate getPreOrderReadyDate() { return preOrderReadyDate; }
    public LocalTime getPreOrderReadyTimeStart() { return preOrderReadyTimeStart; }
    public LocalTime getPreOrderReadyTimeEnd() { return preOrderReadyTimeEnd; }
    public String getPreOrderNote() { return preOrderNote; }
    public long getUnitsSold() { return unitsSold; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
