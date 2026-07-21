package com.manyorder.api.domain.product;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public class ProductResponse {

    private Long id;
    private Long merchantId;
    private String name;
    private String description;
    private BigDecimal price;
    private Boolean isActive;
    private LocalDateTime createdAt;

    public ProductResponse(Long id, Long merchantId, String name, String description,
                           BigDecimal price, Boolean isActive, LocalDateTime createdAt) {
        this.id = id;
        this.merchantId = merchantId;
        this.name = name;
        this.description = description;
        this.price = price;
        this.isActive = isActive;
        this.createdAt = createdAt;
    }

    public Long getId() { return id; }
    public Long getMerchantId() { return merchantId; }
    public String getName() { return name; }
    public String getDescription() { return description; }
    public BigDecimal getPrice() { return price; }
    public Boolean getIsActive() { return isActive; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
