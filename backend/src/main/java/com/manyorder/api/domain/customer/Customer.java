package com.manyorder.api.domain.customer;

import java.time.LocalDateTime;

import com.manyorder.api.domain.merchant.Merchant;
import com.manyorder.api.util.PhoneNumbers;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "customers")
public class Customer {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "merchant_id", nullable = false)
    private Merchant merchant;

    @Column(nullable = false)
    private String fullName;

    @Column(nullable = false)
    private String email;

    /** As typed by the customer - kept verbatim for display (WhatsApp, lists). */
    private String phoneNumber;

    /** Digits-only form of phoneNumber, used only for identity matching so the same
     *  number typed with different spacing/dashes resolves to one customer. */
    private String phoneNormalized;

    private LocalDateTime createdAt;

    protected Customer() {
        // JPA only
    }

    public Customer(Merchant merchant, String fullName, String email, String phoneNumber) {
        this.merchant = merchant;
        this.fullName = fullName;
        this.email = email;
        this.phoneNumber = phoneNumber;
        this.phoneNormalized = PhoneNumbers.normalize(phoneNumber);
        this.createdAt = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public Merchant getMerchant() {
        return merchant;
    }

    public String getFullName() {
        return fullName;
    }

    public String getEmail() {
        return email;
    }

    public String getPhoneNumber() {
        return phoneNumber;
    }

    public String getPhoneNormalized() {
        return phoneNormalized;
    }

    /** Recompute the normalized form from the current raw phone (used by the
     *  one-time backfill of rows created before this column existed). */
    public void refreshPhoneNormalized() {
        this.phoneNormalized = PhoneNumbers.normalize(phoneNumber);
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    /** Replace the editable contact details (a manual edit of the live record;
     *  past orders keep their own point-in-time contact snapshot). */
    public void updateDetails(String fullName, String email, String phoneNumber) {
        this.fullName = fullName;
        this.email = email;
        this.phoneNumber = phoneNumber;
        this.phoneNormalized = PhoneNumbers.normalize(phoneNumber);
    }
}