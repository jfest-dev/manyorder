package com.manyorder.api.domain.admin;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.annotation.Transactional;

import com.manyorder.api.domain.admin.AdminAnalyticsResponse.CurrencyValue;
import com.manyorder.api.domain.admin.AdminAnalyticsResponse.DayCount;
import com.manyorder.api.domain.admin.AdminAnalyticsResponse.FunnelStep;
import com.manyorder.api.domain.merchant.Merchant;
import com.manyorder.api.domain.merchant.MerchantRepository;
import com.manyorder.api.domain.order.Order;
import com.manyorder.api.domain.order.OrderRepository;
import com.manyorder.api.domain.order.OrderSource;
import com.manyorder.api.domain.order.OrderStatus;
import com.manyorder.api.domain.order.OrderType;
import com.manyorder.api.domain.product.Product;
import com.manyorder.api.domain.product.ProductRepository;
import com.manyorder.api.domain.user.User;
import com.manyorder.api.domain.user.UserRepository;
import com.manyorder.api.domain.user.UserRole;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Range-scoped admin analytics over a seeded, historical custom window (March 2026).
 * A past custom range isolates the assertions in the shared test DB: every other test
 * creates its data at "now", so only this test's back-dated rows fall in the window.
 * Day boundaries are Asia/Singapore, so a late-UTC order counts on the next SGT day.
 */
@SpringBootTest
@Transactional
class AdminAnalyticsServiceTest {

    @Autowired AdminAnalyticsService service;
    @Autowired UserRepository userRepository;
    @Autowired MerchantRepository merchantRepository;
    @Autowired OrderRepository orderRepository;
    @Autowired ProductRepository productRepository;

    // Custom window: SGT 2026-03-01..2026-03-03 inclusive => UTC [02-28T16:00, 03-03T16:00).
    private static final LocalDate FROM = LocalDate.of(2026, 3, 1);
    private static final LocalDate TO = LocalDate.of(2026, 3, 3);

    private static final AtomicLong UNIQ = new AtomicLong();

    @Test
    void aggregatesOrdersByCurrencyStatusTypeSourceAndSgtDay() {
        seedDataset();

        AdminAnalyticsResponse r = service.analytics(null, FROM, TO, false);

        // Only the four in-window orders; the one a minute before `from` and the one
        // exactly at `to` are excluded (half-open on both ends).
        assertEquals(4, r.orders().total());

        // Per-currency revenue (COMPLETED/DELIVERED only), never mixed across currencies.
        Map<String, CurrencyValue> byCcy = index(r.orders().byCurrency());
        assertEquals(2, byCcy.get("SGD").orders());
        assertEquals(0, new BigDecimal("30.00").compareTo(byCcy.get("SGD").value()));
        assertEquals(0, new BigDecimal("15.00").compareTo(byCcy.get("SGD").averageOrderValue()));
        assertEquals(1, byCcy.get("IDR").orders());
        assertEquals(0, new BigDecimal("100000").compareTo(byCcy.get("IDR").value()));

        // Status / type / source / discount breakdowns.
        assertEquals(2L, r.orders().byStatus().get("DELIVERED"));
        assertEquals(1L, r.orders().byStatus().get("COMPLETED"));
        assertEquals(1L, r.orders().byStatus().get("CANCELLED"));
        assertEquals(2, r.orders().delivery());
        assertEquals(2, r.orders().pickup());
        assertEquals(2, r.orders().guest());       // the two STOREFRONT orders
        assertEquals(1, r.orders().cancelled());
        assertEquals(1, r.orders().withDiscount());

        // By-day buckets on SGT days: Mar 1 = 1, Mar 2 = 2, Mar 3 = 1.
        List<DayCount> byDay = r.orders().byDay();
        assertEquals(3, byDay.size());
        assertEquals(LocalDate.of(2026, 3, 1), byDay.get(0).date());
        assertEquals(1, byDay.get(0).count());
        assertEquals(2, byDay.get(1).count());
        assertEquals(1, byDay.get(2).count());

        // Top stores ranked by order count: store A (3) ahead of store B (1).
        assertTrue(r.orders().topStores().size() >= 2);
        assertEquals(3, r.orders().topStores().get(0).orders());
        assertEquals("SGD", r.orders().topStores().get(0).currency());

        // Window echoed back with resolved SGT dates and no comparison.
        assertEquals("custom", r.window().range());
        assertEquals(FROM, r.window().fromDate());
        assertEquals(TO, r.window().toDate());
        assertTrue(!r.window().compare());
        assertNull(r.orders().previousTotal());

        // Stores: two created in the window (A and F), first product/order in range.
        assertEquals(2, r.stores().newInRange());
        assertEquals(1, r.stores().firstProductInRange());
        assertEquals(2, r.stores().firstOrderInRange());
        assertTrue(r.stores().suspended() >= 1);
        assertTrue(r.stores().archived() >= 1);

        // Out-of-stock snapshot picks up the active, zero-stock product.
        assertTrue(r.snapshot().outOfStockProducts() >= 1);

        // Funnel over the three merchant accounts that signed up in the window.
        Map<String, FunnelStep> f = indexFunnel(r.funnel().steps());
        assertEquals(3, f.get("signed_up").count());
        assertEquals(2, f.get("verified").count());
        assertEquals(2, f.get("created_store").count());
        assertEquals(1, f.get("added_product").count());
        assertEquals(1, f.get("first_order").count());
        assertNull(f.get("signed_up").retentionFromPrev());
        assertEquals(0.5, f.get("added_product").retentionFromPrev(), 1e-9); // 1 of 2 stores
        assertEquals(1.0, f.get("first_order").retentionFromPrev(), 1e-9);   // 1 of 1 with a product
    }

    @Test
    void compareFillsTheEqualLengthPreviousWindow() {
        seedDataset();

        AdminAnalyticsResponse r = service.analytics(null, FROM, TO, true);

        assertTrue(r.window().compare());
        // Previous window SGT 2026-02-26..2026-02-28 holds the two back-dated prior orders.
        assertEquals(Long.valueOf(2), r.orders().previousTotal());
        // No stores were created in the previous window.
        assertEquals(Long.valueOf(0), r.stores().previousNewInRange());
    }

    @Test
    void secondIdenticalCallWithin60sIsServedFromCacheAndDoesNotRequery() {
        // A window no other test method uses, so these are the cache's first hits of it.
        // (The Caffeine cache bean is shared across methods; the key is what isolates us.)
        LocalDate from = LocalDate.of(2026, 4, 1);
        LocalDate to = LocalDate.of(2026, 4, 3);

        long before = service.computations();
        service.analytics(null, from, to, false);
        service.analytics(null, from, to, false); // identical key -> cache hit
        assertEquals(before + 1, service.computations(), "a repeat call does not recompute");

        service.analytics(null, from, to, true);   // compare=true is a different key
        assertEquals(before + 2, service.computations(), "a different range/compare recomputes");
    }

    // --- seeding ---

    private void seedDataset() {
        LocalDateTime in1 = LocalDateTime.of(2026, 3, 1, 16, 30); // SGT Mar 2 00:30
        LocalDateTime in2 = LocalDateTime.of(2026, 3, 2, 5, 0);   // SGT Mar 2 13:00
        LocalDateTime in3 = LocalDateTime.of(2026, 3, 2, 20, 0);  // SGT Mar 3 04:00
        LocalDateTime in4 = LocalDateTime.of(2026, 3, 1, 2, 0);   // SGT Mar 1 10:00
        LocalDateTime justBefore = LocalDateTime.of(2026, 2, 28, 15, 59); // < from (prev window)
        LocalDateTime atTo = LocalDateTime.of(2026, 3, 3, 16, 0);  // == to (excluded)
        LocalDateTime prev = LocalDateTime.of(2026, 2, 26, 0, 0);  // previous window
        LocalDateTime old = LocalDateTime.of(2026, 1, 1, 0, 0);    // before everything

        User u1 = owner(true, LocalDateTime.of(2026, 3, 1, 10, 0));
        User u2 = owner(false, LocalDateTime.of(2026, 3, 2, 0, 0));
        owner(true, LocalDateTime.of(2026, 3, 2, 1, 0));           // U3: verified, no store
        User outsider = owner(true, old);                          // not in the cohort

        Merchant a = store(u1, "SGD", LocalDateTime.of(2026, 3, 1, 10, 0)); // created in window
        Merchant b = store(outsider, "IDR", old);
        Merchant c = store(outsider, "SGD", old);
        store(u2, "SGD", LocalDateTime.of(2026, 3, 2, 0, 0));      // F: created in window, no product/order
        Merchant d = store(outsider, "SGD", old);
        d.setSuspendedAt(LocalDateTime.now());
        merchantRepository.save(d);
        Merchant e = store(outsider, "SGD", old);
        e.setArchivedAt(LocalDateTime.now());
        merchantRepository.save(e);

        order(a, OrderStatus.DELIVERED, OrderType.DELIVERY, OrderSource.STOREFRONT, "10.00", "SAVE", in1);
        order(a, OrderStatus.COMPLETED, OrderType.PICKUP, OrderSource.MANUAL, "20.00", null, in2);
        order(a, OrderStatus.CANCELLED, OrderType.DELIVERY, OrderSource.STOREFRONT, "5.00", null, in3);
        order(b, OrderStatus.DELIVERED, OrderType.PICKUP, OrderSource.MANUAL, "100000", null, in4);
        // Excluded from the current window; the two before `from` sit in the previous window.
        order(c, OrderStatus.DELIVERED, OrderType.PICKUP, OrderSource.MANUAL, "999", null, justBefore);
        order(c, OrderStatus.DELIVERED, OrderType.PICKUP, OrderSource.MANUAL, "888", null, atTo);
        order(c, OrderStatus.DELIVERED, OrderType.PICKUP, OrderSource.MANUAL, "50.00", null, prev);

        product(a, 0, true, false, LocalDateTime.of(2026, 3, 2, 8, 0)); // in-window, out of stock
        product(b, 7, true, false, old);
    }

    private User owner(boolean verified, LocalDateTime createdAt) {
        long n = UNIQ.incrementAndGet();
        User u = new User("Owner " + n, "an-" + n + "-" + System.nanoTime() + "@test.com", "x", UserRole.MERCHANT);
        u.setVerified(verified);
        ReflectionTestUtils.setField(u, "createdAt", createdAt);
        return userRepository.save(u);
    }

    private Merchant store(User owner, String currency, LocalDateTime createdAt) {
        long n = UNIQ.incrementAndGet();
        Merchant m = new Merchant(owner, "Store " + n, "an-slug-" + n + "-" + System.nanoTime(), owner.getEmail(), "90000000");
        m.setCurrency(currency);
        ReflectionTestUtils.setField(m, "createdAt", createdAt);
        return merchantRepository.save(m);
    }

    private Order order(Merchant m, OrderStatus status, OrderType type, OrderSource source,
                        String total, String discount, LocalDateTime createdAt) {
        Order o = new Order(m, type, "Cust", "90000000");
        o.setStatus(status);
        o.setSource(source);
        o.setTotalAmount(new BigDecimal(total));
        if (discount != null) o.setDiscountCode(discount);
        ReflectionTestUtils.setField(o, "createdAt", createdAt);
        return orderRepository.save(o);
    }

    private Product product(Merchant m, int stock, boolean active, boolean preOrder, LocalDateTime createdAt) {
        Product p = new Product(m, "Prod " + UNIQ.incrementAndGet(), "d", new BigDecimal("1.00"));
        p.setStock(stock);
        p.setIsActive(active);
        p.setPreOrder(preOrder);
        ReflectionTestUtils.setField(p, "createdAt", createdAt);
        return productRepository.save(p);
    }

    private static Map<String, CurrencyValue> index(List<CurrencyValue> rows) {
        return rows.stream().collect(java.util.stream.Collectors.toMap(CurrencyValue::currency, v -> v));
    }

    private static Map<String, FunnelStep> indexFunnel(List<FunnelStep> steps) {
        return steps.stream().collect(java.util.stream.Collectors.toMap(FunnelStep::step, s -> s));
    }
}
