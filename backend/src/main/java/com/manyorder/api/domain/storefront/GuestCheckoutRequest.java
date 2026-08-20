package com.manyorder.api.domain.storefront;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

public class GuestCheckoutRequest {

    @NotNull
    private Long merchantId;

    @NotBlank
    private String customerName;

    @NotBlank
    private String customerPhone;

    private String customerEmail;

    @NotBlank
    private String fulfilmentMethod;

    private String deliveryAddress;

    private String notes;

    /** For the merchant's reference only, e.g. PayNow / Cash / Bank Transfer. */
    private String paymentMethod;

    /** Optional voucher code entered at checkout. */
    private String discountCode;

    @Valid
    @NotEmpty
    private List<ItemRequest> items;

    public GuestCheckoutRequest() {}

    public Long getMerchantId() { return merchantId; }
    public void setMerchantId(Long merchantId) { this.merchantId = merchantId; }
    public String getCustomerName() { return customerName; }
    public void setCustomerName(String customerName) { this.customerName = customerName; }
    public String getCustomerPhone() { return customerPhone; }
    public void setCustomerPhone(String customerPhone) { this.customerPhone = customerPhone; }
    public String getCustomerEmail() { return customerEmail; }
    public void setCustomerEmail(String customerEmail) { this.customerEmail = customerEmail; }
    public String getFulfilmentMethod() { return fulfilmentMethod; }
    public void setFulfilmentMethod(String fulfilmentMethod) { this.fulfilmentMethod = fulfilmentMethod; }
    public String getDeliveryAddress() { return deliveryAddress; }
    public void setDeliveryAddress(String deliveryAddress) { this.deliveryAddress = deliveryAddress; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public String getPaymentMethod() { return paymentMethod; }
    public void setPaymentMethod(String paymentMethod) { this.paymentMethod = paymentMethod; }
    public String getDiscountCode() { return discountCode; }
    public void setDiscountCode(String discountCode) { this.discountCode = discountCode; }
    public List<ItemRequest> getItems() { return items; }
    public void setItems(List<ItemRequest> items) { this.items = items; }

    public static class ItemRequest {
        @NotNull
        private Long productId;

        @NotNull
        @Min(1)
        private Integer quantity;

        /** Ids of the chosen modifier options; prices are re-derived server-side. */
        private List<Long> modifierOptionIds;

        /** Per-line note for this cart line, e.g. "less sugar". */
        private String notes;

        public ItemRequest() {}
        public Long getProductId() { return productId; }
        public void setProductId(Long productId) { this.productId = productId; }
        public Integer getQuantity() { return quantity; }
        public void setQuantity(Integer quantity) { this.quantity = quantity; }
        public List<Long> getModifierOptionIds() { return modifierOptionIds; }
        public void setModifierOptionIds(List<Long> modifierOptionIds) { this.modifierOptionIds = modifierOptionIds; }
        public String getNotes() { return notes; }
        public void setNotes(String notes) { this.notes = notes; }
    }
}