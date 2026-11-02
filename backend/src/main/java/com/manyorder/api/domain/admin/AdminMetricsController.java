package com.manyorder.api.domain.admin;

import java.time.LocalDate;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Starter metrics for the admin dashboard. PLATFORM_ADMIN-only via SecurityConfig. */
@RestController
@RequestMapping("/admin/metrics")
public class AdminMetricsController {

    private final AdminMerchantService adminMerchantService;
    private final AdminAnalyticsService adminAnalyticsService;
    private final AdminDashboardService adminDashboardService;

    public AdminMetricsController(AdminMerchantService adminMerchantService,
                                  AdminAnalyticsService adminAnalyticsService,
                                  AdminDashboardService adminDashboardService) {
        this.adminMerchantService = adminMerchantService;
        this.adminAnalyticsService = adminAnalyticsService;
        this.adminDashboardService = adminDashboardService;
    }

    @GetMapping
    public AdminMetricsResponse metrics() {
        return adminMerchantService.metrics();
    }

    /** Rich Overview: order value by currency, orders per day, top stores, attention, newest, recent actions. */
    @GetMapping("/overview")
    public AdminOverviewResponse overview() {
        return adminMerchantService.overview();
    }

    /**
     * Range-scoped analytics. Either a named {@code range} (today|yesterday|7d|30d|all)
     * or a custom range via {@code from}/{@code to} (inclusive SGT calendar dates).
     * {@code compare=true} adds the equal-length previous period. The server resolves
     * all day boundaries in Asia/Singapore and echoes the window back.
     */
    @GetMapping("/analytics")
    public AdminAnalyticsResponse analytics(
            @RequestParam(required = false) String range,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false, defaultValue = "false") boolean compare) {
        return adminAnalyticsService.analytics(range, from, to, compare);
    }

    /**
     * The redesigned admin dashboard (what happened, needs action, drop-off, right now).
     * Defaults to Today when no range is given. Read-only, PLATFORM_ADMIN only.
     */
    @GetMapping("/dashboard")
    public AdminDashboardResponse dashboard(
            @RequestParam(required = false) String range,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return adminDashboardService.dashboard(range, from, to);
    }

    /** A bad range (reversed, over the 366-day cap, missing dates, or an unknown token)
     *  comes back as a clear 400, not a 500. */
    @ExceptionHandler(IllegalArgumentException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public String badRange(IllegalArgumentException e) {
        return e.getMessage();
    }
}
