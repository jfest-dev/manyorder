package com.manyorder.api.domain.category;

import java.time.LocalDateTime;

public class CategoryResponse {

    private final Long id;
    private final String name;
    private final String color;
    private final Integer displayOrder;
    /** Number of products in this category (derived). */
    private final long productCount;
    private final LocalDateTime createdAt;

    public CategoryResponse(Category c, long productCount) {
        this.id = c.getId();
        this.name = c.getName();
        this.color = c.getColor();
        this.displayOrder = c.getDisplayOrder();
        this.productCount = productCount;
        this.createdAt = c.getCreatedAt();
    }

    public Long getId() { return id; }
    public String getName() { return name; }
    public String getColor() { return color; }
    public Integer getDisplayOrder() { return displayOrder; }
    public long getProductCount() { return productCount; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
