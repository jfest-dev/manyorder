package com.manyorder.api.domain.order;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

import com.manyorder.api.domain.customer.Customer;
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

@Entity
@Table(name = "orders")
public class Order {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Null for guest orders, populated for logged-in customers
    @ManyToOne(optional = true, fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id", nullable = true)
    private Customer customer;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "merchant_id", nullable = false)
    private Merchant merchant;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private OrderStatus status;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private OrderType orderType;

    // Contact info — always filled regardless of guest or logged-in
    @Column(nullable = false)
    private String contactName;

    @Column(nullable = false)
    private String contactPhone;

    private String contactEmail;

    // Required only for DELIVERY orders
    private String deliveryAddress;

    private String notes;

    // Scheduling — customer picks preferred date/time
    private LocalDate scheduledDate;

    private LocalTime scheduledTime;

    @Column(nullable = false)
    private BigDecimal totalAmount = BigDecimal.ZERO;

    private LocalDateTime createdAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PaymentStatus paymentStatus = PaymentStatus.UNPAID;

    /** e.g. Cash, PayNow, Bank Transfer — free text for manual orders. */
    private String paymentMethod;

    /** Transaction ID / account number reference (optional). */
    private String paymentReference;

    protected Order() {
        // JPA only
    }

    // Guest order constructor
    public Order(Merchant merchant, OrderType orderType, String contactName, String contactPhone) {
        this.merchant = merchant;
        this.orderType = orderType;
        this.contactName = contactName;
        this.contactPhone = contactPhone;
        this.status = OrderStatus.PENDING;
        this.createdAt = LocalDateTime.now();
        this.totalAmount = BigDecimal.ZERO;
    }

    // Logged-in customer order constructor
    public Order(Customer customer, Merchant merchant, OrderType orderType, String contactName, String contactPhone) {
        this.customer = customer;
        this.merchant = merchant;
        this.orderType = orderType;
        this.contactName = contactName;
        this.contactPhone = contactPhone;
        this.status = OrderStatus.PENDING;
        this.createdAt = LocalDateTime.now();
        this.totalAmount = BigDecimal.ZERO;
    }

    // Backward compatible constructor for existing merchant manual orders
    public Order(Customer customer, Merchant merchant) {
        this.customer = customer;
        this.merchant = merchant;
        this.orderType = OrderType.PICKUP;
        this.contactName = customer.getFullName();
        this.contactPhone = customer.getPhoneNumber() != null ? customer.getPhoneNumber() : "";
        this.status = OrderStatus.PENDING;
        this.createdAt = LocalDateTime.now();
        this.totalAmount = BigDecimal.ZERO;
    }

    public Long getId() { return id; }
    public Customer getCustomer() { return customer; }
    public Merchant getMerchant() { return merchant; }
    public OrderStatus getStatus() { return status; }
    public void setStatus(OrderStatus status) { this.status = status; }
    public OrderType getOrderType() { return orderType; }
    public void setOrderType(OrderType orderType) { this.orderType = orderType; }
    public String getContactName() { return contactName; }
    public void setContactName(String contactName) { this.contactName = contactName; }
    public String getContactPhone() { return contactPhone; }
    public void setContactPhone(String contactPhone) { this.contactPhone = contactPhone; }
    public String getContactEmail() { return contactEmail; }
    public void setContactEmail(String contactEmail) { this.contactEmail = contactEmail; }
    public String getDeliveryAddress() { return deliveryAddress; }
    public void setDeliveryAddress(String deliveryAddress) { this.deliveryAddress = deliveryAddress; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public LocalDate getScheduledDate() { return scheduledDate; }
    public void setScheduledDate(LocalDate scheduledDate) { this.scheduledDate = scheduledDate; }
    public LocalTime getScheduledTime() { return scheduledTime; }
    public void setScheduledTime(LocalTime scheduledTime) { this.scheduledTime = scheduledTime; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public BigDecimal getTotalAmount() { return totalAmount; }
    public void setTotalAmount(BigDecimal totalAmount) { this.totalAmount = totalAmount; }
    public PaymentStatus getPaymentStatus() { return paymentStatus; }
    public void setPaymentStatus(PaymentStatus paymentStatus) { this.paymentStatus = paymentStatus; }
    public String getPaymentMethod() { return paymentMethod; }
    public void setPaymentMethod(String paymentMethod) { this.paymentMethod = paymentMethod; }
    public String getPaymentReference() { return paymentReference; }
    public void setPaymentReference(String paymentReference) { this.paymentReference = paymentReference; }
}