package com.manyorder.api.domain.merchant;

import jakarta.validation.constraints.Pattern;

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
    private String storeDescription;
    private String paymentInstruction;
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
    public String getStoreDescription() { return storeDescription; }
    public void setStoreDescription(String storeDescription) { this.storeDescription = storeDescription; }
    public String getPaymentInstruction() { return paymentInstruction; }
    public void setPaymentInstruction(String paymentInstruction) { this.paymentInstruction = paymentInstruction; }
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
