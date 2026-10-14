package com.manyorder.api.domain.admin;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.manyorder.api.domain.admin.AdminOverviewResponse.AttentionGroup;
import com.manyorder.api.domain.admin.AdminOverviewResponse.CurrencyValue;
import com.manyorder.api.domain.admin.AdminOverviewResponse.DayCount;
import com.manyorder.api.domain.admin.AdminOverviewResponse.NeedsAttention;
import com.manyorder.api.domain.admin.AdminOverviewResponse.NewStore;
import com.manyorder.api.domain.admin.AdminOverviewResponse.StoreRef;
import com.manyorder.api.domain.admin.AdminOverviewResponse.TopStore;

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

    /** Distinct business-type values present across all stores (for the admin filter). */
    @Transactional(readOnly = true)
    public List<String> listBusinessTypes() {
        return merchantRepository.findDistinctBusinessTypes();
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

    /** How many stores to sample per "Needs attention" category (true totals are counted separately). */
    private static final int ATTENTION_SAMPLE = 5;
    /** A floor timestamp standing in for "all time" in the value-by-currency query. */
    private static final LocalDateTime ALL_TIME = LocalDateTime.of(1970, 1, 1, 0, 0);

    @Transactional(readOnly = true)
    public AdminOverviewResponse overview() {
        LocalDateTime since30 = LocalDateTime.now().minusDays(30);

        List<CurrencyValue> value30 = orderRepository.valueByCurrencySince(REVENUE_STATUSES, since30).stream()
                .map(r -> new CurrencyValue(r.getCurrency(), r.getTotal(), r.getOrders())).toList();
        List<CurrencyValue> valueAll = orderRepository.valueByCurrencySince(REVENUE_STATUSES, ALL_TIME).stream()
                .map(r -> new CurrencyValue(r.getCurrency(), r.getTotal(), r.getOrders())).toList();

        List<TopStore> topStores = orderRepository.topStoresSince(REVENUE_STATUSES, since30, PageRequest.of(0, 5)).stream()
                .map(r -> new TopStore(r.getId(), r.getName(), r.getSlug(), r.getCurrency(), r.getOrders(), r.getValue()))
                .toList();

        PageRequest sample = PageRequest.of(0, ATTENTION_SAMPLE);
        NeedsAttention attention = new NeedsAttention(
                group(merchantRepository.countUnverifiedOwnerStores(),
                        merchantRepository.findUnverifiedOwnerStores(sample)),
                group(merchantRepository.countStoresWithoutProducts(),
                        merchantRepository.findStoresWithoutProducts(sample)),
                group(merchantRepository.countActiveStoresWithoutRecentOrders(since30),
                        merchantRepository.findActiveStoresWithoutRecentOrders(since30, sample)),
                group(merchantRepository.countBySuspendedAtIsNotNull(),
                        merchantRepository.findTop5BySuspendedAtIsNotNullOrderBySuspendedAtDesc()));

        List<NewStore> newest = merchantRepository.findTop5ByOrderByCreatedAtDesc().stream()
                .map(m -> new NewStore(m.getId(), m.getName(), m.getSlug(), m.getOwner().getFullName(), m.getCreatedAt()))
                .toList();

        List<AdminAuditLogResponse> actions = auditLogRepository.findTop5ByOrderByCreatedAtDesc().stream()
                .map(AdminAuditLogResponse::from).toList();

        return new AdminOverviewResponse(value30, valueAll, ordersPerDay(), topStores, attention, newest, actions);
    }

    /** Orders placed on each of the last 30 calendar days (zero-filled), bucketed in memory. */
    private List<DayCount> ordersPerDay() {
        LocalDate start = LocalDate.now().minusDays(29);
        Map<LocalDate, Long> counts = orderRepository.createdAtSince(start.atStartOfDay()).stream()
                .collect(Collectors.groupingBy(LocalDateTime::toLocalDate, Collectors.counting()));
        List<DayCount> days = new ArrayList<>(30);
        for (int i = 0; i < 30; i++) {
            LocalDate d = start.plusDays(i);
            days.add(new DayCount(d, counts.getOrDefault(d, 0L)));
        }
        return days;
    }

    private AttentionGroup group(long count, List<Merchant> items) {
        return new AttentionGroup(count,
                items.stream().map(m -> new StoreRef(m.getId(), m.getName(), m.getSlug())).toList());
    }

    @Transactional(readOnly = true)
    public AdminStoreDetailResponse getStoreDetail(User admin, Long merchantId) {
        Merchant m = storeAccessService.requireStoreForAdmin(admin, merchantId);
        User owner = m.getOwner();

        var ownerDto = new AdminStoreDetailResponse.Owner(
                owner.getFullName(), owner.getEmail(), owner.getPhone(), owner.isVerified(), owner.getCreatedAt());

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
