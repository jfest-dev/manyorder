package com.manyorder.api.domain.admin;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import com.manyorder.api.domain.admin.AdminDashboardResponse.ActionItem;
import com.manyorder.api.domain.admin.AdminDashboardResponse.CurrencySales;
import com.manyorder.api.domain.admin.AdminDashboardResponse.DropStep;
import com.manyorder.api.domain.admin.AdminDashboardResponse.Entity;
import com.manyorder.api.domain.admin.AdminDashboardResponse.Happened;
import com.manyorder.api.domain.admin.AdminDashboardResponse.OrderRow;
import com.manyorder.api.domain.admin.AdminDashboardResponse.RightNow;
import com.manyorder.api.domain.admin.AdminDashboardResponse.StoreRow;
import com.manyorder.api.domain.admin.AdminDashboardResponse.Trend;
import com.manyorder.api.domain.admin.AdminMetricsRange.Window;
import com.manyorder.api.domain.authevent.AuthEventRepository;
import com.manyorder.api.domain.authevent.AuthEventType;
import com.manyorder.api.domain.merchant.MerchantRepository;
import com.manyorder.api.domain.order.OrderFactRow;
import com.manyorder.api.domain.order.OrderRepository;
import com.manyorder.api.domain.order.OrderStatus;
import com.manyorder.api.domain.user.UserRepository;
import com.manyorder.api.domain.user.UserRole;

/**
 * Read side of the redesigned admin dashboard. Everything is grouped from a single order
 * range-scan plus a handful of counts and small named lists; nothing loops per store. The
 * admin never writes here. All the thresholds for "needs action" live as named constants
 * below, in one place.
 */
@Service
public class AdminDashboardService {

    private static final List<OrderStatus> REVENUE_STATUSES = List.of(OrderStatus.COMPLETED, OrderStatus.DELIVERED);

    // Needs-action rules (one place).
    static final int NO_STORE_AFTER_DAYS = 2;
    static final int NO_PRODUCTS_AFTER_DAYS = 3;
    static final int NO_ORDERS_WITHIN_DAYS = 7;
    static final int ORDER_WAITING_HOURS = 24;

    private static final int STORES_LIMIT = 10;
    private static final int LATEST_ORDERS_LIMIT = 10;
    private static final int LIST_LIMIT = 50;

    private final OrderRepository orderRepository;
    private final MerchantRepository merchantRepository;
    private final UserRepository userRepository;
    private final AuthEventRepository authEventRepository;

    public AdminDashboardService(OrderRepository orderRepository, MerchantRepository merchantRepository,
                                 UserRepository userRepository, AuthEventRepository authEventRepository) {
        this.orderRepository = orderRepository;
        this.merchantRepository = merchantRepository;
        this.userRepository = userRepository;
        this.authEventRepository = authEventRepository;
    }

    public AdminDashboardResponse dashboard(String range, LocalDate from, LocalDate to) {
        boolean custom = (range != null && range.equalsIgnoreCase("custom")) || (from != null && to != null && (range == null || range.isBlank()));
        Window window;
        String label;
        if (custom) {
            window = AdminMetricsRange.resolveCustom(from, to);
            label = "custom";
        } else {
            // The screen opens on Today when nothing is chosen.
            String token = (range == null || range.isBlank()) ? "today" : range.trim().toLowerCase();
            window = AdminMetricsRange.resolve(AdminMetricsRange.parse(token), Instant.now());
            label = token;
        }

        Map<String, Long> timings = new LinkedHashMap<>();
        long t0 = System.nanoTime();

        long m0 = System.nanoTime();
        Happened happened = buildHappened(window);
        timings.put("whatHappened", millis(m0));

        long m1 = System.nanoTime();
        List<ActionItem> needsAction = buildNeedsAction();
        timings.put("needsAction", millis(m1));

        long m2 = System.nanoTime();
        List<DropStep> dropOff = buildDropOff(window);
        timings.put("dropOff", millis(m2));

        long m3 = System.nanoTime();
        RightNow rightNow = buildRightNow();
        timings.put("rightNow", millis(m3));

        timings.put("total", millis(t0));
        return new AdminDashboardResponse(describe(label, window), happened, needsAction, dropOff, rightNow, timings);
    }

    // --- Section 1: what happened ---

    private Happened buildHappened(Window w) {
        List<OrderFactRow> rows = orderRepository.findOrderFactsBetween(w.fromUtc(), w.toUtc());
        List<OrderFactRow> prevRows = w.hasPrevious()
                ? orderRepository.findOrderFactsBetween(w.prevFromUtc(), w.prevToUtc()) : List.of();

        Trend orders = new Trend(rows.size(), w.hasPrevious() ? (long) prevRows.size() : null);
        List<CurrencySales> sales = salesByCurrency(rows, prevRows, w.hasPrevious());

        long signUpsCur = userRepository.countByRoleAndCreatedAtGreaterThanEqualAndCreatedAtLessThan(UserRole.MERCHANT, w.fromUtc(), w.toUtc());
        Long signUpsPrev = w.hasPrevious() ? userRepository.countByRoleAndCreatedAtGreaterThanEqualAndCreatedAtLessThan(UserRole.MERCHANT, w.prevFromUtc(), w.prevToUtc()) : null;
        long signInsCur = authEventRepository.countDistinctUsers(AuthEventType.LOGIN, w.fromUtc(), w.toUtc());
        Long signInsPrev = w.hasPrevious() ? authEventRepository.countDistinctUsers(AuthEventType.LOGIN, w.prevFromUtc(), w.prevToUtc()) : null;

        return new Happened(orders, sales, new Trend(signUpsCur, signUpsPrev), new Trend(signInsCur, signInsPrev),
                topStores(rows), latestOrders(rows));
    }

    private List<CurrencySales> salesByCurrency(List<OrderFactRow> rows, List<OrderFactRow> prevRows, boolean compare) {
        Map<String, BigDecimal> cur = revenueByCurrency(rows);
        Map<String, BigDecimal> prev = compare ? revenueByCurrency(prevRows) : Map.of();
        List<CurrencySales> out = new ArrayList<>();
        for (Map.Entry<String, BigDecimal> e : cur.entrySet()) {
            out.add(new CurrencySales(e.getKey(), e.getValue(), compare ? prev.getOrDefault(e.getKey(), BigDecimal.ZERO) : null));
        }
        return out;
    }

    private Map<String, BigDecimal> revenueByCurrency(List<OrderFactRow> rows) {
        Map<String, BigDecimal> m = new LinkedHashMap<>();
        for (OrderFactRow r : rows) {
            if (REVENUE_STATUSES.contains(r.getStatus())) {
                m.merge(r.getCurrency(), nz(r.getTotalAmount()), BigDecimal::add);
            }
        }
        return m;
    }

    private List<StoreRow> topStores(List<OrderFactRow> rows) {
        Map<Long, long[]> count = new java.util.HashMap<>();
        Map<Long, BigDecimal> sales = new java.util.HashMap<>();
        Map<Long, LocalDateTime> last = new java.util.HashMap<>();
        Map<Long, String[]> meta = new java.util.HashMap<>(); // name, slug, currency
        for (OrderFactRow r : rows) {
            Long id = r.getMerchantId();
            count.computeIfAbsent(id, k -> new long[1])[0]++;
            if (REVENUE_STATUSES.contains(r.getStatus())) sales.merge(id, nz(r.getTotalAmount()), BigDecimal::add);
            last.merge(id, r.getCreatedAt(), (a, b) -> b.isAfter(a) ? b : a);
            meta.putIfAbsent(id, new String[]{ r.getMerchantName(), r.getMerchantSlug(), r.getCurrency() });
        }
        return count.keySet().stream()
                .map(id -> new StoreRow(id, meta.get(id)[0], meta.get(id)[1], meta.get(id)[2],
                        count.get(id)[0], sales.getOrDefault(id, BigDecimal.ZERO), iso(last.get(id))))
                .sorted(Comparator.comparing(StoreRow::sales).reversed())
                .limit(STORES_LIMIT)
                .toList();
    }

    private List<OrderRow> latestOrders(List<OrderFactRow> rows) {
        return rows.stream()
                .sorted(Comparator.comparing(OrderFactRow::getCreatedAt).reversed())
                .limit(LATEST_ORDERS_LIMIT)
                .map(r -> new OrderRow(r.getId(), r.getMerchantId(), r.getMerchantName(), iso(r.getCreatedAt()),
                        nz(r.getTotalAmount()), r.getCurrency(), r.getStatus().name()))
                .toList();
    }

    // --- Section 2: needs action ---

    private List<ActionItem> buildNeedsAction() {
        LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC);
        var limit = PageRequest.of(0, LIST_LIMIT);
        List<ActionItem> out = new ArrayList<>();
        userRepository.findMerchantsWithNoStoreBefore(UserRole.MERCHANT, now.minusDays(NO_STORE_AFTER_DAYS), limit)
                .forEach(u -> out.add(new ActionItem("signed_up_no_store", u.getName(), null, u.getId())));
        merchantRepository.findActiveStoresWithoutProductsBefore(now.minusDays(NO_PRODUCTS_AFTER_DAYS), limit)
                .forEach(m -> out.add(new ActionItem("store_no_products", m.getName(), m.getId(), null)));
        merchantRepository.findActiveStoresWithProductsButNoOrderSince(now.minusDays(NO_ORDERS_WITHIN_DAYS), limit)
                .forEach(m -> out.add(new ActionItem("store_no_recent_orders", m.getName(), m.getId(), null)));
        orderRepository.findOrdersWaitingSince(now.minusHours(ORDER_WAITING_HOURS), limit)
                .forEach(o -> out.add(new ActionItem("order_waiting", o.getMerchantName(), o.getMerchantId(), null)));
        merchantRepository.findSuspendedStores(limit)
                .forEach(m -> out.add(new ActionItem("store_suspended", m.getName(), m.getId(), null)));
        // "failed emails" would go here, but the data is not recorded yet (needs new tracking).
        return out;
    }

    // --- Section 3: where people drop off ---

    private List<DropStep> buildDropOff(Window w) {
        LocalDateTime from = w.fromUtc();
        LocalDateTime to = w.toUtc();
        var limit = PageRequest.of(0, LIST_LIMIT);
        long signedUp = userRepository.countByRoleAndCreatedAtGreaterThanEqualAndCreatedAtLessThan(UserRole.MERCHANT, from, to);
        long verified = userRepository.countByRoleAndVerifiedTrueAndCreatedAtGreaterThanEqualAndCreatedAtLessThan(UserRole.MERCHANT, from, to);
        long store = userRepository.countCohortWithStore(UserRole.MERCHANT, from, to);
        long product = userRepository.countCohortWithProduct(UserRole.MERCHANT, from, to);
        long order = userRepository.countCohortWithOrder(UserRole.MERCHANT, from, to);

        List<DropStep> steps = new ArrayList<>(5);
        steps.add(new DropStep("signed_up", signedUp, people(userRepository.findCohortNotVerified(UserRole.MERCHANT, from, to, limit))));
        steps.add(new DropStep("verified", verified, people(userRepository.findCohortWithoutStore(UserRole.MERCHANT, from, to, limit))));
        steps.add(new DropStep("created_store", store, stores(merchantRepository.findStoresInRangeWithoutProducts(from, to, limit))));
        steps.add(new DropStep("added_product", product, stores(merchantRepository.findStoresInRangeWithProductsButNoOrder(from, to, limit))));
        steps.add(new DropStep("first_order", order, List.of()));
        return steps;
    }

    private static List<Entity> people(List<NamedRef> refs) {
        return refs.stream().map(r -> new Entity("person", r.getId(), r.getName())).toList();
    }

    private static List<Entity> stores(List<NamedRef> refs) {
        return refs.stream().map(r -> new Entity("store", r.getId(), r.getName())).toList();
    }

    // --- Section 4: right now ---

    private RightNow buildRightNow() {
        LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC);
        return new RightNow(
                merchantRepository.countByArchivedAtIsNullAndSuspendedAtIsNull(),
                merchantRepository.countBySuspendedAtIsNotNull(),
                merchantRepository.countByProtectedFromDeletionTrue(),
                authEventRepository.countDistinctUsers(AuthEventType.LOGIN, now.minusDays(7), now),
                authEventRepository.countDistinctUsers(AuthEventType.LOGIN, now.minusDays(30), now));
    }

    // --- helpers ---

    private static AdminDashboardResponse.Window describe(String label, Window w) {
        return new AdminDashboardResponse.Window(label, sgtDate(w.fromUtc()).toString(), sgtDate(w.toUtc()).minusDays(1).toString(),
                iso(w.fromUtc()), iso(w.toUtc()),
                w.hasPrevious() ? iso(w.prevFromUtc()) : null, w.hasPrevious() ? iso(w.prevToUtc()) : null);
    }

    private static LocalDate sgtDate(LocalDateTime utc) {
        return utc.atOffset(ZoneOffset.UTC).atZoneSameInstant(AdminMetricsRange.SGT).toLocalDate();
    }

    private static String iso(LocalDateTime utc) {
        return utc == null ? null : utc.atOffset(ZoneOffset.UTC).toInstant().toString();
    }

    private static BigDecimal nz(BigDecimal v) { return v == null ? BigDecimal.ZERO : v; }

    private static long millis(long startNanos) { return (System.nanoTime() - startNanos) / 1_000_000; }
}
