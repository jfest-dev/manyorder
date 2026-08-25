package com.manyorder.api.domain.product;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;

import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

/** PATCH semantics: null fields are left unchanged. */
public class UpdateProductRequest {

    @Size(max = 255, message = "Name must be 255 characters or fewer")
    private String name;

    @Size(max = 5000, message = "Description must be 5000 characters or fewer")
    private String description;

    @Positive
    private BigDecimal price;

    /** Category reference: null = leave unchanged, 0 = clear to none, >0 = set. */
    private Long categoryId;

    @PositiveOrZero
    private Integer stock;

    @Size(max = 255, message = "SKU must be 255 characters or fewer")
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

    @Size(max = 255, message = "Pre-order note must be 255 characters or fewer")
    private String preOrderNote;

    /** Null = leave the product's modifiers unchanged; non-null = replace them wholesale. */
    @jakarta.validation.Valid
    private java.util.List<ModifierGroupRequest> modifierGroups;

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
    public java.util.List<ModifierGroupRequest> getModifierGroups() { return modifierGroups; }
    public void setModifierGroups(java.util.List<ModifierGroupRequest> modifierGroups) { this.modifierGroups = modifierGroups; }
}
