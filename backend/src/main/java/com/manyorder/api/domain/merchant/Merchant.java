package com.manyorder.api.domain.merchant;

import java.time.LocalDateTime;

import com.manyorder.api.domain.user.User;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

/**
 * A Merchant row is a single store. One User (role MERCHANT) can own up to
 * three stores; the limit is enforced in MerchantStoreController.
 */
@Entity
@Table(name = "merchants")
public class Merchant {

    public static final int MAX_STORES_PER_OWNER = 3;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_user_id", nullable = false)
    private User owner;

    @Column(nullable = false)
    private String name;

    /** Public store link, e.g. "kirikiri-brew". Also the staff sign-up store code. */
    @Column(nullable = false, unique = true)
    private String slug;

    private String email;
    private String phoneNumber;

    /** Label only for now (e.g. "Food & Beverage"). */
    private String businessType;

    /** Per-store display currency: SGD or IDR. */
    @Column(nullable = false)
    private String currency = "SGD";

    /** Storefront theme color hex, e.g. "#0F172A". */
    private String themeColor;

    @Column(columnDefinition = "TEXT")
    private String storeDescription;

    @Column(columnDefinition = "TEXT")
    private String paymentInstruction;

    private String streetAddress;
    private String city;
    private String postalCode;

    // Notification preferences (consumed by Resend/WhatsApp integrations later).
    // Explicit SQL defaults let ddl-auto add these columns to existing rows.
    @Column(nullable = false, columnDefinition = "boolean default true not null")
    private boolean notifyNewOrderEmail = true;
    @Column(nullable = false, columnDefinition = "boolean default true not null")
    private boolean notifyLowStockEmail = true;
    @Column(nullable = false, columnDefinition = "boolean default true not null")
    private boolean notifyNewOrderWhatsapp = true;
    @Column(nullable = false, columnDefinition = "boolean default true not null")
    private boolean notifyUrgentWhatsapp = true;

    private LocalDateTime createdAt;

    protected Merchant() {}

    public Merchant(User owner, String name, String slug, String email, String phoneNumber) {
        this.owner = owner;
        this.name = name;
        this.slug = slug;
        this.email = email;
        this.phoneNumber = phoneNumber;
        this.createdAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public User getOwner() { return owner; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getSlug() { return slug; }
    public void setSlug(String slug) { this.slug = slug; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getPhoneNumber() { return phoneNumber; }
    public void setPhoneNumber(String phoneNumber) { this.phoneNumber = phoneNumber; }
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
    public boolean isNotifyNewOrderEmail() { return notifyNewOrderEmail; }
    public void setNotifyNewOrderEmail(boolean v) { this.notifyNewOrderEmail = v; }
    public boolean isNotifyLowStockEmail() { return notifyLowStockEmail; }
    public void setNotifyLowStockEmail(boolean v) { this.notifyLowStockEmail = v; }
    public boolean isNotifyNewOrderWhatsapp() { return notifyNewOrderWhatsapp; }
    public void setNotifyNewOrderWhatsapp(boolean v) { this.notifyNewOrderWhatsapp = v; }
    public boolean isNotifyUrgentWhatsapp() { return notifyUrgentWhatsapp; }
    public void setNotifyUrgentWhatsapp(boolean v) { this.notifyUrgentWhatsapp = v; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
