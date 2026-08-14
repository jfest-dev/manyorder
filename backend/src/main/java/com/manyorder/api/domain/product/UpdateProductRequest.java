package com.manyorder.api.domain.product;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;

import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;

/** PATCH semantics: null fields are left unchanged. */
public class UpdateProductRequest {

    private String name;
    private String description;

    @Positive
    private BigDecimal price;

    /** Category reference: null = leave unchanged, 0 = clear to none, >0 = set. */
    private Long categoryId;

    @PositiveOrZero
    private Integer stock;

    private String sku;

    /** Empty string clears the photo (and deletes the old file); null leaves it. */
    private String photoUrl;

    // Pre-order schedule. When preOrder is present it's applied as a unit: the
    // sub-fields are set absolutely (a null/omitted one clears it), and preOrder
    // = false wipes them all. When preOrder is null the whole block is untouched.
    private Boolean preOrder;
    private LocalDate preOrderReadyDate;
    private LocalTime preOrderReadyTimeStart;
    private LocalTime preOrderReadyTimeEnd;
    private String preOrderNote;

    public UpdateProductRequest() {}

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public BigDecimal getPrice() { return price; }
    public void setPrice(BigDecimal price) { this.price = price; }
    public Long getCategoryId() { return categoryId; }
    public void setCategoryId(Long categoryId) { this.categoryId = categoryId; }
    public Integer getStock() { return stock; }
    public void setStock(Integer stock) { this.stock = stock; }
    public String getSku() { return sku; }
    public void setSku(String sku) { this.sku = sku; }
    public String getPhotoUrl() { return photoUrl; }
    public void setPhotoUrl(String photoUrl) { this.photoUrl = photoUrl; }
    public Boolean getPreOrder() { return preOrder; }
    public void setPreOrder(Boolean preOrder) { this.preOrder = preOrder; }
    public LocalDate getPreOrderReadyDate() { return preOrderReadyDate; }
    public void setPreOrderReadyDate(LocalDate preOrderReadyDate) { this.preOrderReadyDate = preOrderReadyDate; }
    public LocalTime getPreOrderReadyTimeStart() { return preOrderReadyTimeStart; }
    public void setPreOrderReadyTimeStart(LocalTime preOrderReadyTimeStart) { this.preOrderReadyTimeStart = preOrderReadyTimeStart; }
    public LocalTime getPreOrderReadyTimeEnd() { return preOrderReadyTimeEnd; }
    public void setPreOrderReadyTimeEnd(LocalTime preOrderReadyTimeEnd) { this.preOrderReadyTimeEnd = preOrderReadyTimeEnd; }
    public String getPreOrderNote() { return preOrderNote; }
    public void setPreOrderNote(String preOrderNote) { this.preOrderNote = preOrderNote; }
}
