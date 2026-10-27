package com.manyorder.api.domain.admin;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Everything the Platform Admin store-detail page shows for one store. Only fields
 * that are actually stored are included; revenue/last-order/low-stock are computed.
 */
public record AdminStoreDetailResponse(
        Long id,
        String name,
        String slug,
        String status,          // ACTIVE | SUSPENDED | ARCHIVED
        String currency,
        Owner owner,
        Profile profile,
        Activity activity,
        List<AdminAuditLogResponse> recentActions) {

    /** The account that owns the store. */
    public record Owner(String name, String email, String phone, boolean verified, LocalDateTime createdAt) {}

    /** Stored store-profile fields. */
    public record Profile(
            String email,
            boolean emailVerified,
            String phoneNumber,
            String businessType,
            String streetAddress,
            String city,
            String postalCode,
            String storeDescription,
            String operatingHours,
            String paymentInstruction,
            String fulfilmentMode,
            BigDecimal deliveryFee,
            BigDecimal freeDeliveryThreshold,
            String themeColor,
            String logoUrl,
            boolean whatsappVerified,
            boolean notifyNewOrderEmail,
            boolean notifyLowStockEmail,
            boolean notifyNewOrderWhatsapp,
            boolean notifyUrgentWhatsapp,
            boolean itemNotesEnabled,
            boolean protectedFromDeletion,
            LocalDateTime createdAt,
            LocalDateTime suspendedAt,
            LocalDateTime archivedAt,
            LocalDateTime lastOrdersViewedAt) {}

    /** Computed activity. Revenue counts completed + delivered orders only, in the store currency. */
    public record Activity(
            long productCount,
            long orderCount,
            long customerCount,
            BigDecimal revenue,
            String revenueCurrency,
            LocalDateTime lastOrderAt,
            long lowStockCount) {}
}
