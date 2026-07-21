package com.manyorder.api.domain.merchant;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public class CreateStoreRequest {

    @NotBlank
    private String storeName;

    /** Optional; derived from the name when blank. Lowercase letters, digits, hyphens. */
    @Pattern(regexp = "^$|^[a-z0-9]+(-[a-z0-9]+)*$",
             message = "may only contain lowercase letters, numbers and hyphens")
    private String slug;

    private String storeEmail;
    private String storePhone;
    private String businessType;

    /** SGD or IDR; defaults to SGD. */
    private String currency;

    private String themeColor;
    private String storeDescription;
    private String paymentInstruction;

    public CreateStoreRequest() {}

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
}
