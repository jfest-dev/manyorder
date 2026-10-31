package com.manyorder.api.domain.admin;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;

import org.springframework.stereotype.Service;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.manyorder.api.domain.admin.AdminAnalyticsResponse.CurrencyValue;
import com.manyorder.api.domain.admin.AdminAnalyticsResponse.DayCount;
import com.manyorder.api.domain.admin.AdminAnalyticsResponse.Funnel;
import com.manyorder.api.domain.admin.AdminAnalyticsResponse.FunnelStep;
import com.manyorder.api.domain.admin.AdminAnalyticsResponse.Orders;
import com.manyorder.api.domain.admin.AdminAnalyticsResponse.Snapshot;
import com.manyorder.api.domain.admin.AdminAnalyticsResponse.Stores;
import com.manyorder.api.domain.admin.AdminAnalyticsResponse.TopStore;
import com.manyorder.api.domain.admin.AdminMetricsRange.Named;
import com.manyorder.api.domain.admin.AdminMetricsRange.Window;
import com.manyorder.api.domain.merchant.MerchantRepository;
import com.manyorder.api.domain.order.OrderFactRow;
import com.manyorder.api.domain.order.OrderRepository;
import com.manyorder.api.domain.order.OrderStatus;
import com.manyorder.api.domain.order.OrderType;
import com.manyorder.api.domain.product.ProductRepository;
import com.manyorder.api.domain.user.UserRepository;
import com.manyorder.api.domain.user.UserRole;

/**
 * Read-only range-scoped analytics for the platform admin. Everything is grouped
 * from a single order range-scan plus a handful of counts; nothing loops per store.
 * Results are cached for 60 seconds per (range, compare) key to collapse the admin
 * dashboard's bursty refreshes. The admin never writes here.
 */
@Service
public class AdminAnalyticsService {

    /** Only completed/delivered orders count as recorded value (matches the Overview). */
    private static final List<OrderStatus> REVENUE_STATUSES = List.of(OrderStatus.COMPLETED, OrderStatus.DELIVERED);
    /** Above this many days we skip the daily series (e.g. "All time"): a decades-long
     *  per-day array is meaningless and large. Custom ranges are already capped at 366. */
    private static final long MAX_DAILY_SERIES_DAYS = 400;

    private final OrderRepository orderRepository;
    private final MerchantRepository merchantRepository;
    private final ProductRepository productRepository;
    private final UserRepository userRepository;

    /** 60-second response cache, keyed by the resolved range + compare flag. */
    private final Cache<String, AdminAnalyticsResponse> cache =
            Caffeine.newBuilder().expireAfterWrite(60, TimeUnit.SECONDS).maximumSize(256).build();
    /** Incremented on every full (uncached) computation, so a test can assert a cache hit. */
    private final AtomicLong computeCount = new AtomicLong();

    public AdminAnalyticsService(OrderRepository orderRepository, MerchantRepository merchantRepository,
                                 ProductRepository productRepository, UserRepository userRepository) {
        this.orderRepository = orderRepository;
        this.merchantRepository = merchantRepository;
        this.productRepository = productRepository;
        this.userRepository = userRepository;
    }

    /** For tests: how many times a full computation ran (a cache hit does not add to this). */
    public long computations() {
        return computeCount.get();
    }

    /**
     * Resolve the range and return its analytics. {@code range} is a named token
     * (today|yesterday|7d|30d|all); when it is null/"custom", {@code from}/{@code to}
     * are the inclusive SGT calendar dates of a custom range.
     */
    public AdminAnalyticsResponse analytics(String range, LocalDate from, LocalDate to, boolean compare) {
        boolean custom = range == null || range.isBlank() || range.equalsIgnoreCase("custom");
        Window window = custom
                ? AdminMetricsRange.resolveCustom(from, to)
                : AdminMetricsRange.resolve(AdminMetricsRange.parse(range), Instant.now());
        String label = custom ? "custom" : range.trim().toLowerCase();
        boolean doCompare = compare && window.hasPrevious();

        String key = label + '|' + window.fromUtc() + '|' + window.toUtc() + '|' + doCompare;
        return cache.get(key, k -> compute(label, window, doCompare));
    }

    private AdminAnalyticsResponse compute(String label, Window window, boolean compare) {
        computeCount.incrementAndGet();
        Map<String, Long> timings = new LinkedHashMap<>();
        long t0 = System.nanoTime();

        long m0 = System.nanoTime();
        OrdersAgg current = aggregateOrders(window.fromUtc(), window.toUtc());
        OrdersAgg previous = compare ? aggregateOrders(window.prevFromUtc(), window.prevToUtc()) : null;
        timings.put("orders", millisSince(m0));

        long m1 = System.nanoTime();
        Stores stores = buildStores(window, compare);
        timings.put("stores", millisSince(m1));

        long m2 = System.nanoTime();
        Funnel funnel = buildFunnel(window.fromUtc(), window.toUtc());
        timings.put("funnel", millisSince(m2));

        long m3 = System.nanoTime();
        Snapshot snapshot = new Snapshot(productRepository.countByIsActiveTrueAndPreOrderFalseAndStock(0));
        timings.put("snapshot", millisSince(m3));

        Orders orders = buildOrders(window, current, previous);
        timings.put("total", millisSince(t0));

        return new AdminAnalyticsResponse(describe(label, window, compare), orders, stores, funnel, snapshot, timings);
    }

    // --- Orders ---

    private Orders buildOrders(Window window, OrdersAgg cur, OrdersAgg prev) {
        List<CurrencyValue> byCurrency = new ArrayList<>();
        for (Map.Entry<String, long[]> e : cur.revenueByCurrency.entrySet()) {
            String ccy = e.getKey();
            long orders = e.getValue()[0];
            BigDecimal value = cur.revenueValue.getOrDefault(ccy, BigDecimal.ZERO);
            Long prevOrders = null;
            BigDecimal prevValue = null;
            if (prev != null) {
                long[] p = prev.revenueByCurrency.get(ccy);
                prevOrders = p != null ? p[0] : 0L;
                prevValue = prev.revenueValue.getOrDefault(ccy, BigDecimal.ZERO);
            }
            byCurrency.add(new CurrencyValue(ccy, orders, value, averageOrderValue(value, orders), prevOrders, prevValue));
        }
        List<DayCount> byDay = buildByDay(window, cur);
        return new Orders(
                cur.total, prev != null ? prev.total : null,
                byCurrency, byDay, cur.byStatus,
                cur.delivery, cur.pickup, cur.guest, cur.cancelled, cur.withDiscount,
                cur.topStores());
    }

    /** Group the range's orders in one pass. */
    private OrdersAgg aggregateOrders(LocalDateTime from, LocalDateTime to) {
        OrdersAgg agg = new OrdersAgg();
        for (OrderFactRow r : orderRepository.findOrderFactsBetween(from, to)) {
            agg.total++;
            OrderStatus status = r.getStatus();
            agg.byStatus.merge(status.name(), 1L, Long::sum);
            if (r.getOrderType() == OrderType.DELIVERY) agg.delivery++; else agg.pickup++;
            if (r.getSource() != null && r.getSource().name().equals("STOREFRONT")) agg.guest++;
            if (status == OrderStatus.CANCELLED) agg.cancelled++;
            if (r.getDiscountCode() != null && !r.getDiscountCode().isBlank()) agg.withDiscount++;

            LocalDate sgtDay = toSgtDate(r.getCreatedAt());
            agg.perDay.merge(sgtDay, 1L, Long::sum);

            String ccy = r.getCurrency();
            boolean revenue = REVENUE_STATUSES.contains(status);
            if (revenue) {
                agg.revenueByCurrency.computeIfAbsent(ccy, c -> new long[1])[0]++;
                agg.revenueValue.merge(ccy, nz(r.getTotalAmount()), BigDecimal::add);
            }

            StoreAgg s = agg.stores.computeIfAbsent(r.getMerchantId(),
                    id -> new StoreAgg(id, r.getMerchantName(), r.getMerchantSlug(), ccy));
            s.orders++;
            if (revenue) s.value = s.value.add(nz(r.getTotalAmount()));
        }
        return agg;
    }

    private List<DayCount> buildByDay(Window window, OrdersAgg agg) {
        LocalDate first = toSgtDate(window.fromUtc());
        LocalDate lastExclusive = toSgtDate(window.toUtc());
        long days = ChronoUnit.DAYS.between(first, lastExclusive);
        if (days <= 0 || days > MAX_DAILY_SERIES_DAYS) return List.of();
        List<DayCount> out = new ArrayList<>((int) days);
        for (LocalDate d = first; d.isBefore(lastExclusive); d = d.plusDays(1)) {
            out.add(new DayCount(d, agg.perDay.getOrDefault(d, 0L)));
        }
        return out;
    }

    // --- Stores ---

    private Stores buildStores(Window window, boolean compare) {
        long newInRange = merchantRepository
                .countByCreatedAtGreaterThanEqualAndCreatedAtLessThan(window.fromUtc(), window.toUtc());
        Long prevNew = compare
                ? merchantRepository.countByCreatedAtGreaterThanEqualAndCreatedAtLessThan(window.prevFromUtc(), window.prevToUtc())
                : null;
        return new Stores(
                newInRange, prevNew,
                merchantRepository.countByArchivedAtIsNullAndSuspendedAtIsNull(),
                merchantRepository.countBySuspendedAtIsNotNull(),
                merchantRepository.countByArchivedAtIsNotNull(),
                merchantRepository.countWithFirstProductBetween(window.fromUtc(), window.toUtc()),
                merchantRepository.countWithFirstOrderBetween(window.fromUtc(), window.toUtc()));
    }

    // --- Funnel (cohort of merchant accounts that signed up within the range) ---

    private Funnel buildFunnel(LocalDateTime from, LocalDateTime to) {
        long signedUp = userRepository.countByRoleAndCreatedAtGreaterThanEqualAndCreatedAtLessThan(UserRole.MERCHANT, from, to);
        long verified = userRepository.countByRoleAndVerifiedTrueAndCreatedAtGreaterThanEqualAndCreatedAtLessThan(UserRole.MERCHANT, from, to);
        long store = userRepository.countCohortWithStore(UserRole.MERCHANT, from, to);
        long product = userRepository.countCohortWithProduct(UserRole.MERCHANT, from, to);
        long order = userRepository.countCohortWithOrder(UserRole.MERCHANT, from, to);
        List<FunnelStep> steps = new ArrayList<>(5);
        steps.add(new FunnelStep("signed_up", signedUp, null));
        steps.add(new FunnelStep("verified", verified, retention(verified, signedUp)));
        steps.add(new FunnelStep("created_store", store, retention(store, signedUp)));
        steps.add(new FunnelStep("added_product", product, retention(product, store)));
        steps.add(new FunnelStep("first_order", order, retention(order, product)));
        return new Funnel(steps);
    }

    // --- helpers ---

    private static AdminAnalyticsResponse.Window describe(String label, Window w, boolean compare) {
        return new AdminAnalyticsResponse.Window(
                label, toSgtDate(w.fromUtc()), toSgtDate(w.toUtc()).minusDays(1),
                iso(w.fromUtc()), iso(w.toUtc()),
                compare, compare ? iso(w.prevFromUtc()) : null, compare ? iso(w.prevToUtc()) : null);
    }

    private static LocalDate toSgtDate(LocalDateTime utc) {
        return utc.atOffset(ZoneOffset.UTC).atZoneSameInstant(AdminMetricsRange.SGT).toLocalDate();
    }

    private static String iso(LocalDateTime utc) {
        return utc.atOffset(ZoneOffset.UTC).toInstant().toString();
    }

    private static Double retention(long count, long base) {
        if (base <= 0) return null;
        return BigDecimal.valueOf(count).divide(BigDecimal.valueOf(base), 4, RoundingMode.HALF_UP).doubleValue();
    }

    private static BigDecimal averageOrderValue(BigDecimal value, long orders) {
        if (orders <= 0) return BigDecimal.ZERO;
        return value.divide(BigDecimal.valueOf(orders), 2, RoundingMode.HALF_UP);
    }

    private static BigDecimal nz(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }

    private static long millisSince(long startNanos) {
        return (System.nanoTime() - startNanos) / 1_000_000;
    }

    /** Mutable accumulator for one window's orders. */
    private static final class OrdersAgg {
        long total;
        long delivery;
        long pickup;
        long guest;
        long cancelled;
        long withDiscount;
        final Map<String, Long> byStatus = new LinkedHashMap<>();
        final Map<LocalDate, Long> perDay = new java.util.HashMap<>();
        final Map<String, long[]> revenueByCurrency = new LinkedHashMap<>(); // ccy -> [orders]
        final Map<String, BigDecimal> revenueValue = new LinkedHashMap<>();  // ccy -> value
        final Map<Long, StoreAgg> stores = new java.util.HashMap<>();

        List<TopStore> topStores() {
            return stores.values().stream()
                    .sorted((a, b) -> Long.compare(b.orders, a.orders))
                    .limit(5)
                    .map(s -> new TopStore(s.id, s.name, s.slug, s.currency, s.orders, s.value))
                    .toList();
        }
    }

    private static final class StoreAgg {
        final Long id;
        final String name;
        final String slug;
        final String currency;
        long orders;
        BigDecimal value = BigDecimal.ZERO;

        StoreAgg(Long id, String name, String slug, String currency) {
            this.id = id;
            this.name = name;
            this.slug = slug;
            this.currency = currency;
        }
    }
}
