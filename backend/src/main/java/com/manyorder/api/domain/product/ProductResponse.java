package com.manyorder.api.domain.product;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

public class ProductResponse {

    /** A choosable option in the response (with its id so the client can send it back). */
    public record ModifierOptionView(Long id, String name, BigDecimal priceDelta, int sortOrder) {}

    /** A modifier group in the response. `required` is a convenience for minSelect >= 1. */
    public record ModifierGroupView(Long id, String name, int minSelect, Integer maxSelect,
                                    boolean required, int sortOrder, List<ModifierOptionView> options) {}


    private final Long id;
    private final Long merchantId;
    private final String name;
    private final String description;
    private final BigDecimal price;
    /** Configured sale price and window. On the public view these are null unless
     *  the sale is active now (customers never see a not-yet-active sale). */
    private final BigDecimal salePrice;
    private final LocalDateTime saleStartsAt;
    private final LocalDateTime saleEndsAt;
    /** Whether the sale is active now, and the price in force (sale or base). */
    private final boolean onSale;
    private final BigDecimal effectivePrice;
    private final Boolean isActive;
    private final Long categoryId;
    private final String categoryName;
    /** The category's displayOrder, so the storefront can order its chips. */
    private final Integer categoryDisplayOrder;
    private final Integer stock;
    private final String sku;
    private final String photoUrl;
    private final boolean preOrder;
    private final LocalDate preOrderReadyDate;
    private final LocalTime preOrderReadyTimeStart;
    private final LocalTime preOrderReadyTimeEnd;
    private final String preOrderNote;
    private final List<ModifierGroupView> modifierGroups;
    /** Units sold, derived from order history (see ProductService). */
    private final long unitsSold;
    private final LocalDateTime createdAt;

    public ProductResponse(Product p, long unitsSold) {
        this(p, unitsSold, false);
    }

    /** @param publicView when true, a not-yet-active sale is hidden (customers only
     *                    ever see a sale while it is live). */
    public ProductResponse(Product p, long unitsSold, boolean publicView) {
        java.time.LocalDateTime now = java.time.LocalDateTime.now();
        this.onSale = p.isOnSaleAt(now);
        this.effectivePrice = p.effectivePriceAt(now);
        // Public view: expose the sale price only while active, and never the raw
        // window. Merchant view: always show the configured sale for management.
        this.salePrice = publicView ? (onSale ? p.getSalePrice() : null) : p.getSalePrice();
        this.saleStartsAt = publicView ? null : p.getSaleStartsAt();
        this.saleEndsAt = publicView ? null : p.getSaleEndsAt();
        this.id = p.getId();
        this.merchantId = p.getMerchant().getId();
        this.name = p.getName();
        this.description = p.getDescription();
        this.price = p.getPrice();
        this.isActive = p.getIsActive();
        this.categoryId = p.getCategory() != null ? p.getCategory().getId() : null;
        this.categoryName = p.getCategory() != null ? p.getCategory().getName() : null;
        this.categoryDisplayOrder = p.getCategory() != null ? p.getCategory().getDisplayOrder() : null;
        this.stock = p.getStock();
        this.sku = p.getSku();
        this.photoUrl = p.getPhotoUrl();
        this.preOrder = p.isPreOrder();
        this.preOrderReadyDate = p.getPreOrderReadyDate();
        this.preOrderReadyTimeStart = p.getPreOrderReadyTimeStart();
        this.preOrderReadyTimeEnd = p.getPreOrderReadyTimeEnd();
        this.preOrderNote = p.getPreOrderNote();
        this.modifierGroups = p.getModifierGroups().stream()
                .map(g -> new ModifierGroupView(
                        g.getId(), g.getName(), g.getMinSelect(), g.getMaxSelect(), g.isRequired(), g.getSortOrder(),
                        g.getOptions().stream()
                                .map(o -> new ModifierOptionView(o.getId(), o.getName(), o.getPriceDelta(), o.getSortOrder()))
                                .toList()))
                .toList();
        this.unitsSold = unitsSold;
        this.createdAt = p.getCreatedAt();
    }

    public Long getId() { return id; }
    public Long getMerchantId() { return merchantId; }
    public String getName() { return name; }
    public String getDescription() { return description; }
    public BigDecimal getPrice() { return price; }
    public BigDecimal getSalePrice() { return salePrice; }
    public LocalDateTime getSaleStartsAt() { return saleStartsAt; }
    public LocalDateTime getSaleEndsAt() { return saleEndsAt; }
    public boolean isOnSale() { return onSale; }
    public BigDecimal getEffectivePrice() { return effectivePrice; }
    public Boolean getIsActive() { return isActive; }
    public Long getCategoryId() { return categoryId; }
    public String getCategoryName() { return categoryName; }
    public Integer getCategoryDisplayOrder() { return categoryDisplayOrder; }
    public Integer getStock() { return stock; }
    public String getSku() { return sku; }
    public String getPhotoUrl() { return photoUrl; }
    public boolean isPreOrder() { return preOrder; }
    public LocalDate getPreOrderReadyDate() { return preOrderReadyDate; }
    public LocalTime getPreOrderReadyTimeStart() { return preOrderReadyTimeStart; }
    public LocalTime getPreOrderReadyTimeEnd() { return preOrderReadyTimeEnd; }
    public String getPreOrderNote() { return preOrderNote; }
    public List<ModifierGroupView> getModifierGroups() { return modifierGroups; }
    public long getUnitsSold() { return unitsSold; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
