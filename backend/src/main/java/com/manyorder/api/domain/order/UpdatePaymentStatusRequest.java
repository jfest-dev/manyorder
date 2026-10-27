package com.manyorder.api.domain.order;

import jakarta.validation.constraints.NotNull;

public class UpdatePaymentStatusRequest {

    @NotNull
    private PaymentStatus paymentStatus;

    public UpdatePaymentStatusRequest() {}

    public PaymentStatus getPaymentStatus() { return paymentStatus; }
    public void setPaymentStatus(PaymentStatus paymentStatus) { this.paymentStatus = paymentStatus; }
}
