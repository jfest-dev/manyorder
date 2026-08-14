package com.manyorder.api.domain.merchant;

import java.math.BigDecimal;

import jakarta.validation.constraints.PositiveOrZero;

/**
 * Full delivery configuration for a store — absolute semantics (the Delivery
 * screen sends the complete desired state each save). Unlike PATCH, a null here
 * is meaningful: null deliveryFee = "to be confirmed by seller", null threshold
 * = no free-delivery threshold.
 */
public class DeliverySettingsRequest {

    /** Null = to-be-confirmed by seller; 0 = free; >0 = flat fee. */
    @PositiveOrZero
    private BigDecimal deliveryFee;

    /** Waive the fee at/above this subtotal; null = no threshold. */
    @PositiveOrZero
    private BigDecimal freeDeliveryThreshold;

    /** Custom customer-facing wording for the to-be-confirmed case; null/blank → storefront default. */
    private String deliveryToBeConfirmedMessage;

    public DeliverySettingsRequest() {}

    public BigDecimal getDeliveryFee() { return deliveryFee; }
    public void setDeliveryFee(BigDecimal deliveryFee) { this.deliveryFee = deliveryFee; }
    public BigDecimal getFreeDeliveryThreshold() { return freeDeliveryThreshold; }
    public void setFreeDeliveryThreshold(BigDecimal freeDeliveryThreshold) { this.freeDeliveryThreshold = freeDeliveryThreshold; }
    public String getDeliveryToBeConfirmedMessage() { return deliveryToBeConfirmedMessage; }
    public void setDeliveryToBeConfirmedMessage(String deliveryToBeConfirmedMessage) { this.deliveryToBeConfirmedMessage = deliveryToBeConfirmedMessage; }
}
