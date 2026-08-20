package com.manyorder.api.domain.storefront;

import java.math.BigDecimal;

import com.manyorder.api.domain.merchant.Merchant;

/** Safe public projection of a store for the storefront + Sign In to Store branding. */
public class PublicStoreResponse {

    private Long id;
    private String name;
    private String slug;
    private String storeDescription;
    /** Composed public address (street, city, postal) — null/blank when unset. */
    private String address;
    /** Free-text opening hours, e.g. "Mon–Sat, 9am–6pm". Null/blank = not shown. */
    private String operatingHours;
    private String currency;
    private String themeColor;
    private String logoUrl;
    /** Store contact / WhatsApp number — the storefront's wa.me deep-link target. */
    private String phoneNumber;
    private String paymentInstruction;
    /** Merchant's custom wording for the to-be-confirmed delivery case; null → storefront default. */
    private String deliveryToBeConfirmedMessage;
    /** BOTH | PICKUP_ONLY | DELIVERY_ONLY — which fulfilment choices checkout offers. */
    private String fulfilmentMode;
    /** Flat fee; null = to-be-confirmed by seller (see deliveryFeeConfigured), 0 = free. */
    private BigDecimal deliveryFee;
    /** False when no fee is set → checkout shows an estimated total + "to be confirmed". */
    private boolean deliveryFeeConfigured;
    /** Waive the fee at/above this subtotal; null = no threshold. */
    private BigDecimal freeDeliveryThreshold;
    /** Total units sold across the whole shop (all products). */
    private long totalItemsSold;
    /** When false, the storefront hides the per-item note field on the product page. */
    private boolean itemNotesEnabled;

    public PublicStoreResponse(Merchant m, long totalItemsSold) {
        this.id = m.getId();
        this.name = m.getName();
        this.slug = m.getSlug();
        this.storeDescription = m.getStoreDescription();
        this.address = composeAddress(m);
        this.operatingHours = m.getOperatingHours();
        this.currency = m.getCurrency();
        this.themeColor = m.getThemeColor();
        this.logoUrl = m.getLogoUrl();
        this.phoneNumber = m.getPhoneNumber();
        this.paymentInstruction = m.getPaymentInstruction();
        this.deliveryFee = m.getDeliveryFee();
        this.deliveryFeeConfigured = m.getDeliveryFee() != null;
        this.freeDeliveryThreshold = m.getFreeDeliveryThreshold();
        this.deliveryToBeConfirmedMessage = m.getDeliveryToBeConfirmedMessage();
        this.fulfilmentMode = m.getFulfilmentMode();
        this.itemNotesEnabled = m.isItemNotesEnabled();
        this.totalItemsSold = totalItemsSold;
    }

    /** Join the structured address parts into one display line ("Street, City Postal"), or null when empty. */
    private static String composeAddress(Merchant m) {
        StringBuilder sb = new StringBuilder();
        if (m.getStreetAddress() != null && !m.getStreetAddress().isBlank()) sb.append(m.getStreetAddress().trim());
        String cityLine = "";
        if (m.getCity() != null && !m.getCity().isBlank()) cityLine += m.getCity().trim();
        if (m.getPostalCode() != null && !m.getPostalCode().isBlank()) {
            cityLine += (cityLine.isEmpty() ? "" : " ") + m.getPostalCode().trim();
        }
        if (!cityLine.isEmpty()) sb.append(sb.length() > 0 ? ", " : "").append(cityLine);
        return sb.length() > 0 ? sb.toString() : null;
    }

    public Long getId() { return id; }
    public String getName() { return name; }
    public String getSlug() { return slug; }
    public String getStoreDescription() { return storeDescription; }
    public String getAddress() { return address; }
    public String getOperatingHours() { return operatingHours; }
    public String getCurrency() { return currency; }
    public String getThemeColor() { return themeColor; }
    public String getLogoUrl() { return logoUrl; }
    public String getPhoneNumber() { return phoneNumber; }
    public String getPaymentInstruction() { return paymentInstruction; }
    public BigDecimal getDeliveryFee() { return deliveryFee; }
    public boolean isDeliveryFeeConfigured() { return deliveryFeeConfigured; }
    public BigDecimal getFreeDeliveryThreshold() { return freeDeliveryThreshold; }
    public String getDeliveryToBeConfirmedMessage() { return deliveryToBeConfirmedMessage; }
    public String getFulfilmentMode() { return fulfilmentMode; }
    public boolean isItemNotesEnabled() { return itemNotesEnabled; }
    public long getTotalItemsSold() { return totalItemsSold; }
}
