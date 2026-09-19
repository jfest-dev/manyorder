package com.manyorder.api.domain.order;

/** One store's unseen new-order count, for the sidebar badge. */
public record StoreUnseenCountResponse(Long storeId, long count) {}
