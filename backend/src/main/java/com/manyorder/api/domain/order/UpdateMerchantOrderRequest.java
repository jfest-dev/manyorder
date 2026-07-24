package com.manyorder.api.domain.order;

import java.util.List;

import jakarta.validation.constraints.NotBlank;

/**
 * Edit an existing manual order (Edit Order). The store and order come from the
 * URL path, never the body.
 *
 * Contact and logistics fields (name, phone, email, order type, delivery
 * address, notes) are editable at any status. Line items are only replaced when
 * {@link #items} is provided, and the service rejects that unless the order is
 * still PENDING or CONFIRMED.
 */
public class UpdateMerchantOrderRequest {

    @NotBlank
    private String customerName;
    private String email;
    private String phoneNumber;

    private OrderType orderType;
    private String deliveryAddress;
    private String notes;

    /**
     * When present, replaces the order's line items (allowed only while
     * PENDING/CONFIRMED). When null, existing items are left untouched — this
     * lets contact edits succeed at any status without resending items.
     */
    private List<CreateMerchantOrderRequest.ItemRequest> items;

    public UpdateMerchantOrderRequest() {}

    public String getCustomerName() { return customerName; }
    public void setCustomerName(String customerName) { this.customerName = customerName; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getPhoneNumber() { return phoneNumber; }
    public void setPhoneNumber(String phoneNumber) { this.phoneNumber = phoneNumber; }
    public OrderType getOrderType() { return orderType; }
    public void setOrderType(OrderType orderType) { this.orderType = orderType; }
    public String getDeliveryAddress() { return deliveryAddress; }
    public void setDeliveryAddress(String deliveryAddress) { this.deliveryAddress = deliveryAddress; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public List<CreateMerchantOrderRequest.ItemRequest> getItems() { return items; }
    public void setItems(List<CreateMerchantOrderRequest.ItemRequest> items) { this.items = items; }
}
