package com.manyorder.api.domain.order;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

import com.manyorder.api.domain.customer.CustomerTag;

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
    private BigDecimal subtotal;
    private BigDecimal deliveryFee;
    private boolean deliveryFeePending;
    private BigDecimal discountAmount;
    private BigDecimal deliveryDiscount;
    /** True when the delivery discount was a FREE_DELIVERY voucher; drives the
     *  "Free delivery" vs "Delivery discount" label. */
    private boolean freeDelivery;
    private String discountCode;
    private String orderGroupId;
    private BigDecimal totalAmount;
    private List<OrderItemResponse> items;
    /** How the order was placed (STOREFRONT vs MANUAL). Lets the Orders list tag a
     *  storefront order still in its initial status as "New". */
    private OrderSource source;
    /** The linked customer's current tags (empty when the order has no customer).
     *  Live labels, not a per-order snapshot. */
    private List<CustomerTag> customerTags;

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
            BigDecimal subtotal,
            BigDecimal deliveryFee,
            boolean deliveryFeePending,
            BigDecimal discountAmount,
            BigDecimal deliveryDiscount,
            boolean freeDelivery,
            String discountCode,
            String orderGroupId,
            BigDecimal totalAmount,
            List<OrderItemResponse> items,
            OrderSource source,
            List<CustomerTag> customerTags) {
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
        this.subtotal = subtotal;
        this.deliveryFee = deliveryFee;
        this.deliveryFeePending = deliveryFeePending;
        this.discountAmount = discountAmount;
        this.deliveryDiscount = deliveryDiscount;
        this.freeDelivery = freeDelivery;
        this.discountCode = discountCode;
        this.orderGroupId = orderGroupId;
        this.totalAmount = totalAmount;
        this.items = items;
        this.source = source;
        this.customerTags = customerTags;
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
    public BigDecimal getSubtotal() { return subtotal; }
    public BigDecimal getDeliveryFee() { return deliveryFee; }
    public boolean isDeliveryFeePending() { return deliveryFeePending; }
    public BigDecimal getDiscountAmount() { return discountAmount; }
    public BigDecimal getDeliveryDiscount() { return deliveryDiscount; }
    public boolean isFreeDelivery() { return freeDelivery; }
    public String getDiscountCode() { return discountCode; }
    public String getOrderGroupId() { return orderGroupId; }
    public BigDecimal getTotalAmount() { return totalAmount; }
    public List<OrderItemResponse> getItems() { return items; }
    public OrderSource getSource() { return source; }
    public List<CustomerTag> getCustomerTags() { return customerTags; }
}