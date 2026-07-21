package com.manyorder.api.domain.storefront;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public class GuestCheckoutResponse {

    private Long orderId;
    private String storeName;
    private String paymentInstruction;
    private String customerName;
    private String fulfilmentMethod;
    private String deliveryAddress;
    private String orderStatus;
    private String paymentStatus;
    private BigDecimal totalAmount;
    private LocalDateTime createdAt;
    private List<ItemSummary> items;

    public GuestCheckoutResponse(Long orderId, String storeName, String paymentInstruction,
                                  String customerName, String fulfilmentMethod,
                                  String deliveryAddress, String orderStatus,
                                  String paymentStatus, BigDecimal totalAmount,
                                  LocalDateTime createdAt, List<ItemSummary> items) {
        this.orderId = orderId;
        this.storeName = storeName;
        this.paymentInstruction = paymentInstruction;
        this.customerName = customerName;
        this.fulfilmentMethod = fulfilmentMethod;
        this.deliveryAddress = deliveryAddress;
        this.orderStatus = orderStatus;
        this.paymentStatus = paymentStatus;
        this.totalAmount = totalAmount;
        this.createdAt = createdAt;
        this.items = items;
    }

    public Long getOrderId() { return orderId; }
    public String getStoreName() { return storeName; }
    public String getPaymentInstruction() { return paymentInstruction; }
    public String getCustomerName() { return customerName; }
    public String getFulfilmentMethod() { return fulfilmentMethod; }
    public String getDeliveryAddress() { return deliveryAddress; }
    public String getOrderStatus() { return orderStatus; }
    public String getPaymentStatus() { return paymentStatus; }
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