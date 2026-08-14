package com.manyorder.api.domain.merchant;

import java.math.BigDecimal;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

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

    /** Absolute logo URL from the upload endpoint; blank/null means no logo. */
    private String logoUrl;

    @Size(max = 200, message = "Store description must be 200 characters or fewer")
    private String storeDescription;
    /** Free-text opening hours, e.g. "Mon–Sat, 9am–6pm". */
    private String operatingHours;
    private String streetAddress;
    private String city;
    private String postalCode;
    private String paymentInstruction;

    /** Optional flat delivery fee. Null = to-be-confirmed; 0 = free. */
    @PositiveOrZero
    private BigDecimal deliveryFee;

    /** Waive the delivery fee at/above this subtotal. Null = no threshold. */
    @PositiveOrZero
    private BigDecimal freeDeliveryThreshold;

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
    public String getLogoUrl() { return logoUrl; }
    public void setLogoUrl(String logoUrl) { this.logoUrl = logoUrl; }
    public String getStoreDescription() { return storeDescription; }
    public void setStoreDescription(String storeDescription) { this.storeDescription = storeDescription; }
    public String getOperatingHours() { return operatingHours; }
    public void setOperatingHours(String operatingHours) { this.operatingHours = operatingHours; }
    public String getStreetAddress() { return streetAddress; }
    public void setStreetAddress(String streetAddress) { this.streetAddress = streetAddress; }
    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }
    public String getPostalCode() { return postalCode; }
    public void setPostalCode(String postalCode) { this.postalCode = postalCode; }
    public String getPaymentInstruction() { return paymentInstruction; }
    public void setPaymentInstruction(String paymentInstruction) { this.paymentInstruction = paymentInstruction; }
    public BigDecimal getDeliveryFee() { return deliveryFee; }
    public void setDeliveryFee(BigDecimal deliveryFee) { this.deliveryFee = deliveryFee; }
    public BigDecimal getFreeDeliveryThreshold() { return freeDeliveryThreshold; }
    public void setFreeDeliveryThreshold(BigDecimal freeDeliveryThreshold) { this.freeDeliveryThreshold = freeDeliveryThreshold; }
}
