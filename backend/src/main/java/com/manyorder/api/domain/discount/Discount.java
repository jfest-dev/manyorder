package com.manyorder.api.domain.discount;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import com.manyorder.api.domain.merchant.Merchant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

/**
 * A per-store, order-level discount code. Codes are stored normalised to upper
 * case so uniqueness within a store is effectively case-insensitive. usageLimit
 * null = unlimited (reusable); 1 = single-use; N = capped at N redemptions.
 */
@Entity
@Table(name = "discounts", uniqueConstraints = @UniqueConstraint(columnNames = {"merchant_id", "code"}))
public class Discount {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "merchant_id", nullable = false)
    private Merchant merchant;

    @Column(nullable = false)
    private String code;

    /** Optional friendly label shown in the dashboard; the code is the identity. */
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private DiscountType type;

    /** Percent (1–100) for PERCENTAGE, or a currency amount for FIXED.
     *  Column named to avoid the reserved word "value" (H2/SQL). */
    @Column(name = "discount_value", nullable = false)
    private BigDecimal value;

    /** Total redemptions allowed. Null = unlimited. */
    private Integer usageLimit;

    @Column(nullable = false, columnDefinition = "integer default 0 not null")
    private int usedCount = 0;

    /** Optional validity window; null bound = open-ended on that side. */
    private LocalDateTime startsAt;
    private LocalDateTime endsAt;

    @Column(nullable = false, columnDefinition = "boolean default true not null")
    private boolean active = true;

    private LocalDateTime createdAt;

    protected Discount() {
        // JPA only
    }

    public Discount(Merchant merchant, String code, DiscountType type, BigDecimal value,
                    Integer usageLimit, LocalDateTime startsAt, LocalDateTime endsAt, boolean active) {
        this.merchant = merchant;
        this.code = code;
        this.type = type;
        this.value = value;
        this.usageLimit = usageLimit;
        this.startsAt = startsAt;
        this.endsAt = endsAt;
        this.active = active;
        this.createdAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public Merchant getMerchant() { return merchant; }
    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public DiscountType getType() { return type; }
    public void setType(DiscountType type) { this.type = type; }
    public BigDecimal getValue() { return value; }
    public void setValue(BigDecimal value) { this.value = value; }
    public Integer getUsageLimit() { return usageLimit; }
    public void setUsageLimit(Integer usageLimit) { this.usageLimit = usageLimit; }
    public int getUsedCount() { return usedCount; }
    public void setUsedCount(int usedCount) { this.usedCount = usedCount; }
    public LocalDateTime getStartsAt() { return startsAt; }
    public void setStartsAt(LocalDateTime startsAt) { this.startsAt = startsAt; }
    public LocalDateTime getEndsAt() { return endsAt; }
    public void setEndsAt(LocalDateTime endsAt) { this.endsAt = endsAt; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
