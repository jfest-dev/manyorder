package com.manyorder.api.domain.order;

public enum OrderStatus {
    PENDING,
    CONFIRMED,
    PREPARING,
    READY,
    OUT_FOR_DELIVERY,
    DELIVERED,
    COMPLETED,
    CANCELLED
}