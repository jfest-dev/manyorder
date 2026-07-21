package com.manyorder.api.domain.merchant;

import java.time.LocalDateTime;

public class StoreResponse {

    private Long id;
    private String name;
    private String slug;
    private String email;
    private String phone;
    private String businessType;
    private String currency;
    private String themeColor;
    private String storeDescription;
    private String paymentInstruction;
    private String streetAddress;
    private String city;
    private String postalCode;
    private boolean notifyNewOrderEmail;
    private boolean notifyLowStockEmail;
    private boolean notifyNewOrderWhatsapp;
    private boolean notifyUrgentWhatsapp;
    private LocalDateTime createdAt;

    public StoreResponse(Merchant m) {
        this.id = m.getId();
        this.name = m.getName();
        this.slug = m.getSlug();
        this.email = m.getEmail();
        this.phone = m.getPhoneNumber();
        this.businessType = m.getBusinessType();
        this.currency = m.getCurrency();
        this.themeColor = m.getThemeColor();
        this.storeDescription = m.getStoreDescription();
        this.paymentInstruction = m.getPaymentInstruction();
        this.streetAddress = m.getStreetAddress();
        this.city = m.getCity();
        this.postalCode = m.getPostalCode();
        this.notifyNewOrderEmail = m.isNotifyNewOrderEmail();
        this.notifyLowStockEmail = m.isNotifyLowStockEmail();
        this.notifyNewOrderWhatsapp = m.isNotifyNewOrderWhatsapp();
        this.notifyUrgentWhatsapp = m.isNotifyUrgentWhatsapp();
        this.createdAt = m.getCreatedAt();
    }

    public Long getId() { return id; }
    public String getName() { return name; }
    public String getSlug() { return slug; }
    public String getEmail() { return email; }
    public String getPhone() { return phone; }
    public String getBusinessType() { return businessType; }
    public String getCurrency() { return currency; }
    public String getThemeColor() { return themeColor; }
    public String getStoreDescription() { return storeDescription; }
    public String getPaymentInstruction() { return paymentInstruction; }
    public String getStreetAddress() { return streetAddress; }
    public String getCity() { return city; }
    public String getPostalCode() { return postalCode; }
    public boolean isNotifyNewOrderEmail() { return notifyNewOrderEmail; }
    public boolean isNotifyLowStockEmail() { return notifyLowStockEmail; }
    public boolean isNotifyNewOrderWhatsapp() { return notifyNewOrderWhatsapp; }
    public boolean isNotifyUrgentWhatsapp() { return notifyUrgentWhatsapp; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
