package com.manyorder.api.domain.admin;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.manyorder.api.domain.customer.CustomerRepository;
import com.manyorder.api.domain.merchant.Merchant;
import com.manyorder.api.domain.merchant.MerchantRepository;
import com.manyorder.api.domain.order.OrderRepository;
import com.manyorder.api.domain.order.OrderStatus;
import com.manyorder.api.domain.product.ProductRepository;
import com.manyorder.api.domain.product.ProductService;
import com.manyorder.api.domain.user.User;
import com.manyorder.api.security.StoreAccessService;

/** Read side of the Platform Admin surface: cross-merchant list, drill-down, and metrics. */
@Service
public class AdminMerchantService {

    /** Revenue counts only money that actually landed: completed + delivered orders. */
    private static final List<OrderStatus> REVENUE_STATUSES = List.of(OrderStatus.COMPLETED, OrderStatus.DELIVERED);

    private final MerchantRepository merchantRepository;
    private final ProductRepository productRepository;
    private final OrderRepository orderRepository;
    private final CustomerRepository customerRepository;
    private final AdminAuditLogRepository auditLogRepository;
    private final StoreAccessService storeAccessService;

    public AdminMerchantService(MerchantRepository merchantRepository,
                                ProductRepository productRepository,
                                OrderRepository orderRepository,
                                CustomerRepository customerRepository,
                                AdminAuditLogRepository auditLogRepository,
                                StoreAccessService storeAccessService) {
        this.merchantRepository = merchantRepository;
        this.productRepository = productRepository;
        this.orderRepository = orderRepository;
        this.customerRepository = customerRepository;
        this.auditLogRepository = auditLogRepository;
        this.storeAccessService = storeAccessService;
    }

    @Transactional(readOnly = true)
    public List<AdminMerchantSummary> listMerchants() {
        return merchantRepository.findAllByOrderByCreatedAtDesc().stream().map(this::toSummary).toList();
    }

    /**
     * Filtered, sorted, paged merchants for the admin Merchants screen.
     * Search matches store name, slug, owner name and owner email (case-insensitive).
     * {@code sort} is one of newest (default), name, orders, latest; {@code page} is 1-based.
     */
    @Transactional(readOnly = true)
    public AdminMerchantPage searchMerchants(String q, String status, String currency,
                                             String businessType, String sort, int page, int size) {
        int pageSize = size < 1 ? 20 : size;
        String needle = q == null ? "" : q.trim().toLowerCase();

        List<Merchant> matched = merchantRepository.findAllByOrderByCreatedAtDesc().stream()
                .filter(m -> matches(m, needle, status, currency, businessType))
                .toList();

        Comparator<Merchant> order = switch (sort == null ? "" : sort) {
            case "name" -> Comparator.comparing(m -> m.getName() == null ? "" : m.getName().toLowerCase());
            case "orders" -> Comparator.comparingLong((Merchant m) -> orderRepository.countByMerchant(m)).reversed();
            case "latest" -> Comparator.comparing((Merchant m) -> orderRepository.findLastOrderAt(m),
                    Comparator.nullsLast(Comparator.reverseOrder()));
            default -> Comparator.comparing(Merchant::getCreatedAt,
                    Comparator.nullsLast(Comparator.reverseOrder())); // newest
        };
        List<Merchant> sorted = matched.stream().sorted(order).toList();

        long total = sorted.size();
        int totalPages = (int) Math.max(1, Math.ceil((double) total / pageSize));
        int current = Math.min(Math.max(page, 1), totalPages);
        int from = (current - 1) * pageSize;
        int to = (int) Math.min(from + (long) pageSize, total);
        List<AdminMerchantSummary> content = (from >= total ? List.<Merchant>of() : sorted.subList(from, to))
                .stream().map(this::toSummary).toList();

        return new AdminMerchantPage(content, total, totalPages, current);
    }

    private boolean matches(Merchant m, String needle, String status, String currency, String businessType) {
        if (!needle.isEmpty()
                && !contains(m.getName(), needle)
                && !contains(m.getSlug(), needle)
                && !contains(m.getOwner().getFullName(), needle)
                && !contains(m.getOwner().getEmail(), needle)) {
            return false;
        }
        if (status != null && !status.isBlank() && !statusOf(m).equalsIgnoreCase(status)) return false;
        if (currency != null && !currency.isBlank() && !currency.equalsIgnoreCase(m.getCurrency())) return false;
        if (businessType != null && !businessType.isBlank()
                && !businessType.equalsIgnoreCase(m.getBusinessType())) return false;
        return true;
    }

    private static boolean contains(String haystack, String lowerNeedle) {
        return haystack != null && haystack.toLowerCase().contains(lowerNeedle);
    }

    @Transactional(readOnly = true)
    public AdminMerchantSummary getMerchant(User admin, Long merchantId) {
        return toSummary(storeAccessService.requireStoreForAdmin(admin, merchantId));
    }

    @Transactional(readOnly = true)
    public AdminMetricsResponse metrics() {
        return new AdminMetricsResponse(
                merchantRepository.count(),
                merchantRepository.countByArchivedAtIsNullAndSuspendedAtIsNull(),
                merchantRepository.countBySuspendedAtIsNotNull(),
                merchantRepository.countByArchivedAtIsNotNull(),
                orderRepository.count(),
                customerRepository.count(),
                merchantRepository.countByCreatedAtAfter(LocalDateTime.now().minusDays(30)));
    }

    @Transactional(readOnly = true)
    public AdminStoreDetailResponse getStoreDetail(User admin, Long merchantId) {
        Merchant m = storeAccessService.requireStoreForAdmin(admin, merchantId);
        User owner = m.getOwner();

        var ownerDto = new AdminStoreDetailResponse.Owner(
                owner.getFullName(), owner.getEmail(), owner.isVerified(), owner.getCreatedAt());

        var profile = new AdminStoreDetailResponse.Profile(
                m.getEmail(), m.getPhoneNumber(), m.getBusinessType(),
                m.getStreetAddress(), m.getCity(), m.getPostalCode(),
                m.getStoreDescription(), m.getOperatingHours(), m.getPaymentInstruction(),
                m.getFulfilmentMode(), m.getDeliveryFee(), m.getFreeDeliveryThreshold(),
                m.getThemeColor(), m.getLogoUrl(), m.isWhatsappVerified(),
                m.isNotifyNewOrderEmail(), m.isNotifyLowStockEmail(),
                m.isNotifyNewOrderWhatsapp(), m.isNotifyUrgentWhatsapp(),
                m.isItemNotesEnabled(), m.getCreatedAt(), m.getSuspendedAt(),
                m.getArchivedAt(), m.getLastOrdersViewedAt());

        var activity = new AdminStoreDetailResponse.Activity(
                productRepository.countByMerchant(m),
                orderRepository.countByMerchant(m),
                customerRepository.countByMerchant(m),
                orderRepository.sumRevenue(m, REVENUE_STATUSES),
                m.getCurrency(),
                orderRepository.findLastOrderAt(m),
                productRepository.countByMerchantAndIsActiveTrueAndPreOrderFalseAndStockBetween(
                        m, 1, ProductService.LOW_STOCK_AT));

        List<AdminAuditLogResponse> recent = auditLogRepository
                .findTop20ByMerchantIdOrderByCreatedAtDesc(m.getId())
                .stream().map(AdminAuditLogResponse::from).toList();

        return new AdminStoreDetailResponse(
                m.getId(), m.getName(), m.getSlug(), statusOf(m), m.getCurrency(),
                ownerDto, profile, activity, recent);
    }

    private AdminMerchantSummary toSummary(Merchant m) {
        return new AdminMerchantSummary(
                m.getId(), m.getName(), m.getSlug(),
                m.getOwner().getFullName(), m.getOwner().getEmail(),
                statusOf(m), m.getCurrency(), m.getCreatedAt(),
                productRepository.countByMerchant(m),
                orderRepository.countByMerchant(m),
                customerRepository.countByMerchant(m));
    }

    private String statusOf(Merchant m) {
        return m.isSuspended() ? "SUSPENDED" : m.isArchived() ? "ARCHIVED" : "ACTIVE";
    }
}
