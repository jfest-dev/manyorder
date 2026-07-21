package com.manyorder.api.domain.order;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

public class OrderResponse {

    private Long id;
    private Long customerId;
    private String customerName;
    private Long merchantId;
    private String merchantName;
    private OrderStatus status;
    private PaymentStatus paymentStatus;
    private String paymentMethod;
    private String paymentReference;
    private OrderType orderType;
    private String contactName;
    private String contactPhone;
    private String contactEmail;
    private String deliveryAddress;
    private String notes;
    private LocalDate scheduledDate;
    private LocalTime scheduledTime;
    private LocalDateTime createdAt;
    private BigDecimal totalAmount;
    private List<OrderItemResponse> items;

    public OrderResponse(
            Long id,
            Long customerId,
            String customerName,
            Long merchantId,
            String merchantName,
            OrderStatus status,
            PaymentStatus paymentStatus,
            String paymentMethod,
            String paymentReference,
            OrderType orderType,
            String contactName,
            String contactPhone,
            String contactEmail,
            String deliveryAddress,
            String notes,
            LocalDate scheduledDate,
            LocalTime scheduledTime,
            LocalDateTime createdAt,
            BigDecimal totalAmount,
            List<OrderItemResponse> items) {
        this.id = id;
        this.customerId = customerId;
        this.customerName = customerName;
        this.merchantId = merchantId;
        this.merchantName = merchantName;
        this.status = status;
        this.paymentStatus = paymentStatus;
        this.paymentMethod = paymentMethod;
        this.paymentReference = paymentReference;
        this.orderType = orderType;
        this.contactName = contactName;
        this.contactPhone = contactPhone;
        this.contactEmail = contactEmail;
        this.deliveryAddress = deliveryAddress;
        this.notes = notes;
        this.scheduledDate = scheduledDate;
        this.scheduledTime = scheduledTime;
        this.createdAt = createdAt;
        this.totalAmount = totalAmount;
        this.items = items;
    }

    public Long getId() { return id; }
    public Long getCustomerId() { return customerId; }
    public String getCustomerName() { return customerName; }
    public Long getMerchantId() { return merchantId; }
    public String getMerchantName() { return merchantName; }
    public OrderStatus getStatus() { return status; }
    public PaymentStatus getPaymentStatus() { return paymentStatus; }
    public String getPaymentMethod() { return paymentMethod; }
    public String getPaymentReference() { return paymentReference; }
    public OrderType getOrderType() { return orderType; }
    public String getContactName() { return contactName; }
    public String getContactPhone() { return contactPhone; }
    public String getContactEmail() { return contactEmail; }
    public String getDeliveryAddress() { return deliveryAddress; }
    public String getNotes() { return notes; }
    public LocalDate getScheduledDate() { return scheduledDate; }
    public LocalTime getScheduledTime() { return scheduledTime; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public BigDecimal getTotalAmount() { return totalAmount; }
    public List<OrderItemResponse> getItems() { return items; }
}