package com.manyorder.api.domain.admin;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Starter metrics for the admin dashboard. PLATFORM_ADMIN-only via SecurityConfig. */
@RestController
@RequestMapping("/admin/metrics")
public class AdminMetricsController {

    private final AdminMerchantService adminMerchantService;

    public AdminMetricsController(AdminMerchantService adminMerchantService) {
        this.adminMerchantService = adminMerchantService;
    }

    @GetMapping
    public AdminMetricsResponse metrics() {
        return adminMerchantService.metrics();
    }
}
