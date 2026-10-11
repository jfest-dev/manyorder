package com.manyorder.api.domain.admin;

import java.util.List;

/** One page of the admin merchants list, with totals for the pager. */
public record AdminMerchantPage(
        List<AdminMerchantSummary> content,
        long totalElements,
        int totalPages,
        int page) {
}
