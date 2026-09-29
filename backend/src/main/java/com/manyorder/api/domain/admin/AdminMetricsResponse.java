package com.manyorder.api.domain.admin;

/**
 * Starter tiles for the admin dashboard. Deliberately counts only: cross-store
 * revenue is omitted because merchants can use different currencies, so a single
 * summed figure would be meaningless.
 */
public record AdminMetricsResponse(
        long totalMerchants,
        long activeMerchants,
        long suspendedMerchants,
        long archivedMerchants,
        long totalOrders,
        long totalCustomers,
        long newMerchantsLast30Days) {
}
