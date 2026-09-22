package com.manyorder.api.domain.customer;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import com.manyorder.api.domain.merchant.Merchant;
import com.manyorder.api.util.PhoneNumbers;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OrderColumn;
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

    /** Free-form, informational labels the merchant applies (e.g. "VIP",
     *  "Wholesale"). No automatic behaviour keys off them. */
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "customer_tags", joinColumns = @JoinColumn(name = "customer_id"))
    @OrderColumn(name = "position")
    @Column(name = "tag", nullable = false, length = 30)
    private List<String> tags = new ArrayList<>();

    private static final int MAX_TAG_LENGTH = 30;
    private static final int MAX_TAGS = 20;

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

    public List<String> getTags() {
        return tags;
    }

    /**
     * Replace the tag set. Normalizes: trims, drops blanks, truncates to
     * {@value #MAX_TAG_LENGTH} chars, dedupes case-insensitively (keeping the
     * first casing and order), and caps at {@value #MAX_TAGS} tags.
     */
    public void setTags(Collection<String> incoming) {
        this.tags.clear();
        if (incoming == null) {
            return;
        }
        Set<String> seen = new HashSet<>();
        for (String raw : incoming) {
            if (raw == null) {
                continue;
            }
            String tag = raw.trim();
            if (tag.length() > MAX_TAG_LENGTH) {
                tag = tag.substring(0, MAX_TAG_LENGTH).trim();
            }
            if (tag.isEmpty() || !seen.add(tag.toLowerCase())) {
                continue;
            }
            this.tags.add(tag);
            if (this.tags.size() >= MAX_TAGS) {
                break;
            }
        }
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