package com.manyorder.api.domain.admin;

import java.time.LocalDateTime;

/** One row in the admin merchants list / drill-down: identity, owner, status,
 *  and per-store data counts. */
public record AdminMerchantSummary(
        Long id,
        String name,
        String slug,
        String ownerName,
        String ownerEmail,
        String status,          // ACTIVE | SUSPENDED | ARCHIVED
        String currency,
        LocalDateTime createdAt,
        long productCount,
        long orderCount,
        long customerCount) {
}
