package com.manyorder.api.domain.order;

import java.util.List;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/** Manual order entry (Add Order). The store comes from the URL path, never the body. */
public class CreateMerchantOrderRequest {

    @NotBlank
    private String customerName;
    private String email;
    private String phoneNumber;

    /** Optional line items; totals are computed server-side from live prices. */
    private List<ItemRequest> items;

    private PaymentStatus paymentStatus;
    private String paymentMethod;
    private String paymentReference;
    private String notes;

    /**
     * Explicit order type for manual entry. When provided it is authoritative.
     * When null (guest / storefront path), the type is inferred from whether a
     * delivery address is present (backward compatible).
     */
    private OrderType orderType;

    /** Address for DELIVERY orders. May be blank even for DELIVERY (fill in later via Edit). */
    private String deliveryAddress;

    public static class ItemRequest {
        @NotNull
        private Long productId;
        @Min(1)
        private int quantity = 1;

        public ItemRequest() {}
        public Long getProductId() { return productId; }
        public void setProductId(Long productId) { this.productId = productId; }
        public int getQuantity() { return quantity; }
        public void setQuantity(int quantity) { this.quantity = quantity; }
    }

    public CreateMerchantOrderRequest() {}

    public String getCustomerName() { return customerName; }
    public void setCustomerName(String customerName) { this.customerName = customerName; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getPhoneNumber() { return phoneNumber; }
    public void setPhoneNumber(String phoneNumber) { this.phoneNumber = phoneNumber; }
    public List<ItemRequest> getItems() { return items; }
    public void setItems(List<ItemRequest> items) { this.items = items; }
    public PaymentStatus getPaymentStatus() { return paymentStatus; }
    public void setPaymentStatus(PaymentStatus paymentStatus) { this.paymentStatus = paymentStatus; }
    public String getPaymentMethod() { return paymentMethod; }
    public void setPaymentMethod(String paymentMethod) { this.paymentMethod = paymentMethod; }
    public String getPaymentReference() { return paymentReference; }
    public void setPaymentReference(String paymentReference) { this.paymentReference = paymentReference; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public OrderType getOrderType() { return orderType; }
    public void setOrderType(OrderType orderType) { this.orderType = orderType; }
    public String getDeliveryAddress() { return deliveryAddress; }
    public void setDeliveryAddress(String deliveryAddress) { this.deliveryAddress = deliveryAddress; }
}
