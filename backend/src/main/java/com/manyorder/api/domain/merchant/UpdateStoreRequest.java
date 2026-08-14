package com.manyorder.api.domain.merchant;

import java.math.BigDecimal;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

/** PATCH semantics: null fields are left unchanged. */
public class UpdateStoreRequest {

    private String storeName;

    @Pattern(regexp = "^$|^[a-z0-9]+(-[a-z0-9]+)*$",
             message = "may only contain lowercase letters, numbers and hyphens")
    private String slug;

    private String storeEmail;
    private String storePhone;
    private String businessType;
    private String currency;
    private String themeColor;

    /** Absolute logo URL from the upload endpoint. Empty string clears the logo; null leaves it unchanged. */
    private String logoUrl;

    @Size(max = 200, message = "Store description must be 200 characters or fewer")
    private String storeDescription;
    private String operatingHours;
    private String paymentInstruction;

    /** Flat delivery fee. Null leaves it unchanged; 0 means no fee (free delivery). */
    @PositiveOrZero
    private BigDecimal deliveryFee;

    private String streetAddress;
    private String city;
    private String postalCode;
    private Boolean notifyNewOrderEmail;
    private Boolean notifyLowStockEmail;
    private Boolean notifyNewOrderWhatsapp;
    private Boolean notifyUrgentWhatsapp;

    public UpdateStoreRequest() {}

    public String getStoreName() { return storeName; }
    public void setStoreName(String storeName) { this.storeName = storeName; }
    public String getSlug() { return slug; }
    public void setSlug(String slug) { this.slug = slug; }
    public String getStoreEmail() { return storeEmail; }
    public void setStoreEmail(String storeEmail) { this.storeEmail = storeEmail; }
    public String getStorePhone() { return storePhone; }
    public void setStorePhone(String storePhone) { this.storePhone = storePhone; }
    public String getBusinessType() { return businessType; }
    public void setBusinessType(String businessType) { this.businessType = businessType; }
    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }
    public String getThemeColor() { return themeColor; }
    public void setThemeColor(String themeColor) { this.themeColor = themeColor; }
    public String getLogoUrl() { return logoUrl; }
    public void setLogoUrl(String logoUrl) { this.logoUrl = logoUrl; }
    public String getStoreDescription() { return storeDescription; }
    public void setStoreDescription(String storeDescription) { this.storeDescription = storeDescription; }
    public String getPaymentInstruction() { return paymentInstruction; }
    public void setPaymentInstruction(String paymentInstruction) { this.paymentInstruction = paymentInstruction; }
    public BigDecimal getDeliveryFee() { return deliveryFee; }
    public void setDeliveryFee(BigDecimal deliveryFee) { this.deliveryFee = deliveryFee; }
    public String getOperatingHours() { return operatingHours; }
    public void setOperatingHours(String operatingHours) { this.operatingHours = operatingHours; }
    public String getStreetAddress() { return streetAddress; }
    public void setStreetAddress(String streetAddress) { this.streetAddress = streetAddress; }
    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }
    public String getPostalCode() { return postalCode; }
    public void setPostalCode(String postalCode) { this.postalCode = postalCode; }
    public Boolean getNotifyNewOrderEmail() { return notifyNewOrderEmail; }
    public void setNotifyNewOrderEmail(Boolean v) { this.notifyNewOrderEmail = v; }
    public Boolean getNotifyLowStockEmail() { return notifyLowStockEmail; }
    public void setNotifyLowStockEmail(Boolean v) { this.notifyLowStockEmail = v; }
    public Boolean getNotifyNewOrderWhatsapp() { return notifyNewOrderWhatsapp; }
    public void setNotifyNewOrderWhatsapp(Boolean v) { this.notifyNewOrderWhatsapp = v; }
    public Boolean getNotifyUrgentWhatsapp() { return notifyUrgentWhatsapp; }
    public void setNotifyUrgentWhatsapp(Boolean v) { this.notifyUrgentWhatsapp = v; }
}
