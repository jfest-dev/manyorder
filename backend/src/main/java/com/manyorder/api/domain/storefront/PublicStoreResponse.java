package com.manyorder.api.domain.storefront;

import java.math.BigDecimal;

import com.manyorder.api.domain.merchant.Merchant;

/** Safe public projection of a store for the storefront + Sign In to Store branding. */
public class PublicStoreResponse {

    private Long id;
    private String name;
    private String slug;
    private String storeDescription;
    private String currency;
    private String themeColor;
    private String logoUrl;
    /** Store contact / WhatsApp number — the storefront's wa.me deep-link target. */
    private String phoneNumber;
    private String paymentInstruction;
    private BigDecimal deliveryFee;
    /** Total units sold across the whole shop (all products). */
    private long totalItemsSold;

    public PublicStoreResponse(Merchant m, long totalItemsSold) {
        this.id = m.getId();
        this.name = m.getName();
        this.slug = m.getSlug();
        this.storeDescription = m.getStoreDescription();
        this.currency = m.getCurrency();
        this.themeColor = m.getThemeColor();
        this.logoUrl = m.getLogoUrl();
        this.phoneNumber = m.getPhoneNumber();
        this.paymentInstruction = m.getPaymentInstruction();
        this.deliveryFee = m.getDeliveryFee();
        this.totalItemsSold = totalItemsSold;
    }

    public Long getId() { return id; }
    public String getName() { return name; }
    public String getSlug() { return slug; }
    public String getStoreDescription() { return storeDescription; }
    public String getCurrency() { return currency; }
    public String getThemeColor() { return themeColor; }
    public String getLogoUrl() { return logoUrl; }
    public String getPhoneNumber() { return phoneNumber; }
    public String getPaymentInstruction() { return paymentInstruction; }
    public BigDecimal getDeliveryFee() { return deliveryFee; }
    public long getTotalItemsSold() { return totalItemsSold; }
}
