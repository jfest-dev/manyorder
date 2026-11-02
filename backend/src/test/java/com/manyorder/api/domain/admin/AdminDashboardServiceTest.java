package com.manyorder.api.domain.admin;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import java.util.concurrent.atomic.AtomicLong;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.annotation.Transactional;

import com.manyorder.api.domain.admin.AdminDashboardResponse.ActionItem;
import com.manyorder.api.domain.merchant.Merchant;
import com.manyorder.api.domain.merchant.MerchantRepository;
import com.manyorder.api.domain.order.Order;
import com.manyorder.api.domain.order.OrderRepository;
import com.manyorder.api.domain.order.OrderStatus;
import com.manyorder.api.domain.order.OrderType;
import com.manyorder.api.domain.product.Product;
import com.manyorder.api.domain.product.ProductRepository;
import com.manyorder.api.domain.user.User;
import com.manyorder.api.domain.user.UserRepository;
import com.manyorder.api.domain.user.UserRole;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** The redesigned admin dashboard: needs-action rules fire for the right backdated
 *  entities and name them, and "what happened" lists stores and latest orders for the range. */
@SpringBootTest
@Transactional
class AdminDashboardServiceTest {

    @Autowired AdminDashboardService service;
    @Autowired UserRepository userRepository;
    @Autowired MerchantRepository merchantRepository;
    @Autowired OrderRepository orderRepository;
    @Autowired ProductRepository productRepository;

    private static final AtomicLong UNIQ = new AtomicLong();

    @Test
    void needsActionNamesTheStoreOrPersonForEachRule() {
        LocalDateTime now = LocalDateTime.now();

        // Signed up 3 days ago, no store.
        User noStore = owner(true, now.minusDays(3));
        // A store with no products, created 4 days ago.
        Merchant noProducts = store(owner(true, now.minusDays(10)), now.minusDays(4));
        // A store with a product but no order in 10 days.
        Merchant quiet = store(owner(true, now.minusDays(20)), now.minusDays(20));
        product(quiet, now.minusDays(15));
        // A store with an order still pending from 2 days ago.
        Merchant waiting = store(owner(true, now.minusDays(20)), now.minusDays(20));
        order(waiting, OrderStatus.PENDING, now.minusDays(2));
        // A suspended store.
        Merchant suspended = store(owner(true, now.minusDays(20)), now.minusDays(20));
        suspended.setSuspendedAt(now);
        merchantRepository.save(suspended);

        List<ActionItem> actions = service.dashboard("today", null, null).needsAction();
        Set<String> kinds = actions.stream().map(ActionItem::kind).collect(java.util.stream.Collectors.toSet());
        assertTrue(kinds.contains("signed_up_no_store"));
        assertTrue(kinds.contains("store_no_products"));
        assertTrue(kinds.contains("store_no_recent_orders"));
        assertTrue(kinds.contains("order_waiting"));
        assertTrue(kinds.contains("store_suspended"));

        // Every row names the entity and carries an id to open it.
        assertTrue(actions.stream().allMatch(a -> a.name() != null && !a.name().isBlank()
                && (a.storeId() != null || a.userId() != null)));
        // The no-store row names the person.
        assertTrue(actions.stream().anyMatch(a -> a.kind().equals("signed_up_no_store") && noStore.getId().equals(a.userId())));
        // The no-products row names that store.
        assertTrue(actions.stream().anyMatch(a -> a.kind().equals("store_no_products") && noProducts.getId().equals(a.storeId())));
    }

    @Test
    void whatHappenedListsStoresAndLatestOrdersForTheRange() {
        // A historical custom window isolates these rows in the shared test DB.
        LocalDateTime in = LocalDateTime.of(2026, 7, 2, 5, 0); // SGT 2026-07-02 13:00
        Merchant a = store(owner(true, LocalDateTime.of(2026, 1, 1, 0, 0)), LocalDateTime.of(2026, 1, 1, 0, 0));
        order(a, OrderStatus.DELIVERED, in, "30.00");
        order(a, OrderStatus.PENDING, in.plusHours(1), "10.00");

        var r = service.dashboard(null, LocalDate.of(2026, 7, 1), LocalDate.of(2026, 7, 3));
        assertEquals("custom", r.window().range());
        assertEquals(2, r.happened().orders().current());
        assertTrue(r.happened().stores().stream().anyMatch(s -> s.id().equals(a.getId()) && s.orders() == 2
                && new BigDecimal("30.00").compareTo(s.sales()) == 0 && s.lastOrderAt() != null));
        assertTrue(r.happened().latestOrders().size() >= 2);
        // Latest first.
        assertTrue(r.happened().latestOrders().get(0).at().compareTo(r.happened().latestOrders().get(1).at()) >= 0);
    }

    // --- seeding helpers ---

    private User owner(boolean verified, LocalDateTime createdAt) {
        long n = UNIQ.incrementAndGet();
        User u = new User("Owner " + n, "ad-" + n + "-" + System.nanoTime() + "@test.com", "x", UserRole.MERCHANT);
        u.setVerified(verified);
        ReflectionTestUtils.setField(u, "createdAt", createdAt);
        return userRepository.save(u);
    }

    private Merchant store(User owner, LocalDateTime createdAt) {
        long n = UNIQ.incrementAndGet();
        Merchant m = new Merchant(owner, "Store " + n, "ad-slug-" + n + "-" + System.nanoTime(), owner.getEmail(), "90000000");
        m.setCurrency("SGD");
        ReflectionTestUtils.setField(m, "createdAt", createdAt);
        return merchantRepository.save(m);
    }

    private Order order(Merchant m, OrderStatus status, LocalDateTime createdAt) {
        return order(m, status, createdAt, "5.00");
    }

    private Order order(Merchant m, OrderStatus status, LocalDateTime createdAt, String total) {
        Order o = new Order(m, OrderType.PICKUP, "Cust", "90000000");
        o.setStatus(status);
        o.setTotalAmount(new BigDecimal(total));
        ReflectionTestUtils.setField(o, "createdAt", createdAt);
        return orderRepository.save(o);
    }

    private Product product(Merchant m, LocalDateTime createdAt) {
        Product p = new Product(m, "Prod " + UNIQ.incrementAndGet(), "d", new BigDecimal("1.00"));
        p.setStock(5);
        p.setIsActive(true);
        p.setPreOrder(false);
        ReflectionTestUtils.setField(p, "createdAt", createdAt);
        return productRepository.save(p);
    }
}
