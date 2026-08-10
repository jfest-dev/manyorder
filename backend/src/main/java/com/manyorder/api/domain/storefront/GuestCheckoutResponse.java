package com.manyorder.api.domain.storefront;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public class GuestCheckoutResponse {

    private Long orderId;
    private String storeName;
    /** Store WhatsApp / contact number for the wa.me handoff on the confirmation screen. */
    private String storePhone;
    private String paymentInstruction;
    private String paymentMethod;
    private String customerName;
    private String fulfilmentMethod;
    private String deliveryAddress;
    private String notes;
    private String orderStatus;
    private String paymentStatus;
    private BigDecimal subtotal;
    private BigDecimal deliveryFee;
    private BigDecimal discountAmount;
    private String discountCode;
    private BigDecimal totalAmount;
    private LocalDateTime createdAt;
    private List<ItemSummary> items;

    public GuestCheckoutResponse(Long orderId, String storeName, String storePhone,
                                  String paymentInstruction, String paymentMethod,
                                  String customerName, String fulfilmentMethod,
                                  String deliveryAddress, String notes, String orderStatus,
                                  String paymentStatus, BigDecimal subtotal, BigDecimal deliveryFee,
                                  BigDecimal discountAmount, String discountCode, BigDecimal totalAmount,
                                  LocalDateTime createdAt, List<ItemSummary> items) {
        this.orderId = orderId;
        this.storeName = storeName;
        this.storePhone = storePhone;
        this.paymentInstruction = paymentInstruction;
        this.paymentMethod = paymentMethod;
        this.customerName = customerName;
        this.fulfilmentMethod = fulfilmentMethod;
        this.deliveryAddress = deliveryAddress;
        this.notes = notes;
        this.orderStatus = orderStatus;
        this.paymentStatus = paymentStatus;
        this.subtotal = subtotal;
        this.deliveryFee = deliveryFee;
        this.discountAmount = discountAmount;
        this.discountCode = discountCode;
        this.totalAmount = totalAmount;
        this.createdAt = createdAt;
        this.items = items;
    }

    public Long getOrderId() { return orderId; }
    public String getStoreName() { return storeName; }
    public String getStorePhone() { return storePhone; }
    public String getPaymentInstruction() { return paymentInstruction; }
    public String getPaymentMethod() { return paymentMethod; }
    public String getCustomerName() { return customerName; }
    public String getFulfilmentMethod() { return fulfilmentMethod; }
    public String getDeliveryAddress() { return deliveryAddress; }
    public String getNotes() { return notes; }
    public String getOrderStatus() { return orderStatus; }
    public String getPaymentStatus() { return paymentStatus; }
    public BigDecimal getSubtotal() { return subtotal; }
    public BigDecimal getDeliveryFee() { return deliveryFee; }
    public BigDecimal getDiscountAmount() { return discountAmount; }
    public String getDiscountCode() { return discountCode; }
    public BigDecimal getTotalAmount() { return totalAmount; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public List<ItemSummary> getItems() { return items; }

    public static class ItemSummary {
        private String productName;
        private Integer quantity;
        private BigDecimal unitPrice;
        private BigDecimal subtotal;

        public ItemSummary(String productName, Integer quantity,
                           BigDecimal unitPrice, BigDecimal subtotal) {
            this.productName = productName;
            this.quantity = quantity;
            this.unitPrice = unitPrice;
            this.subtotal = subtotal;
        }

        public String getProductName() { return productName; }
        public Integer getQuantity() { return quantity; }
        public BigDecimal getUnitPrice() { return unitPrice; }
        public BigDecimal getSubtotal() { return subtotal; }
    }
}