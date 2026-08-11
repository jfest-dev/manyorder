package com.manyorder.api.domain.storefront;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public class GuestCheckoutResponse {

    /** Shared id when the checkout was split into two orders; null for a single order. */
    private String orderGroupId;
    /** Primary order id — the (single) order, or the "ready now" order of a split. */
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
    // Combined across all orders in this checkout (equals the single order when not split).
    private BigDecimal subtotal;
    private BigDecimal deliveryFee;
    private BigDecimal discountAmount;
    private String discountCode;
    private BigDecimal totalAmount;
    private LocalDateTime createdAt;
    private List<ItemSummary> items;
    /** Per-order breakdown: one entry normally, two when split (ready + pre-order). */
    private List<OrderSummary> orders;

    public GuestCheckoutResponse(String orderGroupId, Long orderId, String storeName, String storePhone,
                                  String paymentInstruction, String paymentMethod,
                                  String customerName, String fulfilmentMethod,
                                  String deliveryAddress, String notes, String orderStatus,
                                  String paymentStatus, BigDecimal subtotal, BigDecimal deliveryFee,
                                  BigDecimal discountAmount, String discountCode, BigDecimal totalAmount,
                                  LocalDateTime createdAt, List<ItemSummary> items, List<OrderSummary> orders) {
        this.orderGroupId = orderGroupId;
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
        this.orders = orders;
    }

    public String getOrderGroupId() { return orderGroupId; }
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
    public List<OrderSummary> getOrders() { return orders; }

    /** One split order's own breakdown. kind: READY | PREORDER | STANDARD. */
    public static class OrderSummary {
        private Long orderId;
        private String kind;
        private String orderStatus;
        private String paymentStatus;
        private BigDecimal subtotal;
        private BigDecimal deliveryFee;
        private BigDecimal discountAmount;
        private BigDecimal totalAmount;
        private List<ItemSummary> items;

        public OrderSummary(Long orderId, String kind, String orderStatus, String paymentStatus,
                            BigDecimal subtotal, BigDecimal deliveryFee, BigDecimal discountAmount,
                            BigDecimal totalAmount, List<ItemSummary> items) {
            this.orderId = orderId;
            this.kind = kind;
            this.orderStatus = orderStatus;
            this.paymentStatus = paymentStatus;
            this.subtotal = subtotal;
            this.deliveryFee = deliveryFee;
            this.discountAmount = discountAmount;
            this.totalAmount = totalAmount;
            this.items = items;
        }

        public Long getOrderId() { return orderId; }
        public String getKind() { return kind; }
        public String getOrderStatus() { return orderStatus; }
        public String getPaymentStatus() { return paymentStatus; }
        public BigDecimal getSubtotal() { return subtotal; }
        public BigDecimal getDeliveryFee() { return deliveryFee; }
        public BigDecimal getDiscountAmount() { return discountAmount; }
        public BigDecimal getTotalAmount() { return totalAmount; }
        public List<ItemSummary> getItems() { return items; }
    }

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