package com.manyorder.api.domain.customer;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** A store customer with their derived order activity (count, spend, dates). */
public class CustomerResponse {

    private final Long id;
    private final String fullName;
    private final String email;
    private final String phoneNumber;
    private final LocalDateTime createdAt;
    private final long ordersCount;
    private final BigDecimal totalSpent;
    private final LocalDateTime firstOrderAt;
    private final LocalDateTime lastOrderAt;

    public CustomerResponse(Customer c, long ordersCount, BigDecimal totalSpent,
                            LocalDateTime firstOrderAt, LocalDateTime lastOrderAt) {
        this.id = c.getId();
        this.fullName = c.getFullName();
        this.email = c.getEmail();
        this.phoneNumber = c.getPhoneNumber();
        this.createdAt = c.getCreatedAt();
        this.ordersCount = ordersCount;
        this.totalSpent = totalSpent != null ? totalSpent : BigDecimal.ZERO;
        this.firstOrderAt = firstOrderAt;
        this.lastOrderAt = lastOrderAt;
    }

    public Long getId() { return id; }
    public String getFullName() { return fullName; }
    public String getEmail() { return email; }
    public String getPhoneNumber() { return phoneNumber; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public long getOrdersCount() { return ordersCount; }
    public BigDecimal getTotalSpent() { return totalSpent; }
    public LocalDateTime getFirstOrderAt() { return firstOrderAt; }
    public LocalDateTime getLastOrderAt() { return lastOrderAt; }
}
