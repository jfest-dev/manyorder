package com.manyorder.api.domain.order;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.manyorder.api.domain.customer.Customer;
import com.manyorder.api.domain.customer.CustomerOrderStats;
import com.manyorder.api.domain.merchant.Merchant;

public interface OrderRepository extends JpaRepository<Order, Long> {
    List<Order> findByMerchantOrderByCreatedAtDesc(Merchant merchant);
    Optional<Order> findByMerchantAndId(Merchant merchant, Long id);
    long countByMerchant(Merchant merchant);

    /** Total revenue for a store, counting only the given statuses (completed + delivered). */
    @Query("SELECT COALESCE(SUM(o.totalAmount), 0) FROM Order o WHERE o.merchant = :merchant AND o.status IN :statuses")
    BigDecimal sumRevenue(@Param("merchant") Merchant merchant, @Param("statuses") Collection<OrderStatus> statuses);

    /** When the store's most recent order was placed, or null if it has none. */
    @Query("SELECT MAX(o.createdAt) FROM Order o WHERE o.merchant = :merchant")
    LocalDateTime findLastOrderAt(@Param("merchant") Merchant merchant);

    /** All orders of a checkout, by its shared tracking token (empty if unknown). */
    List<Order> findByTrackingToken(String trackingToken);
    List<Order> findByMerchantAndOrderGroupIdOrderByIdAsc(Merchant merchant, String orderGroupId);
    List<Order> findByMerchantAndStatusOrderByCreatedAtDesc(Merchant merchant, OrderStatus status);
    List<Order> findByMerchantAndCreatedAtBetween(Merchant merchant, LocalDateTime start, LocalDateTime end);

    /** How many orders this customer has at the store, excluding one status
     *  (cancelled) - drives the "first order only" discount check. */
    long countByMerchantAndCustomerAndStatusNot(Merchant merchant, Customer customer, OrderStatus excludedStatus);

    /**
     * Unseen new-order count for the sidebar badge: storefront orders (not the
     * merchant's own manual entries), not cancelled, placed after {@code since}.
     * Caller passes a real timestamp for "never viewed" (a far-past epoch) rather
     * than null: a bare null bound into an "IS NULL" test has no inferable type on
     * Postgres ("could not determine data type of parameter"), even though H2
     * tolerates it — so the null branch is kept out of the SQL entirely.
     */
    @Query("""
            SELECT COUNT(o) FROM Order o
            WHERE o.merchant = :merchant
              AND o.source = :source
              AND o.status <> :excludedStatus
              AND o.createdAt > :since
            """)
    long countUnseen(@Param("merchant") Merchant merchant,
                     @Param("source") OrderSource source,
                     @Param("excludedStatus") OrderStatus excludedStatus,
                     @Param("since") LocalDateTime since);

    /** Null out the customer FK on this customer's orders before the customer row
     *  is deleted, so past orders survive (their contact snapshot stays intact),
     *  mirroring how deleting a product detaches its order lines. */
    @Modifying(flushAutomatically = true)
    @Query("UPDATE Order o SET o.customer = null WHERE o.customer = :customer")
    int detachCustomer(@Param("customer") Customer customer);

    /** Per-customer order aggregate for a store, excluding one status (cancelled). */
    @Query("""
        SELECT o.customer.id AS customerId, COUNT(o) AS orderCount,
               COALESCE(SUM(o.totalAmount), 0) AS totalSpent,
               MIN(o.createdAt) AS firstOrderAt, MAX(o.createdAt) AS lastOrderAt
        FROM Order o
        WHERE o.merchant = :merchant AND o.customer IS NOT NULL AND o.status <> :excludedStatus
        GROUP BY o.customer.id
        """)
    List<CustomerOrderStats> aggregateCustomerStats(@Param("merchant") Merchant merchant,
                                                     @Param("excludedStatus") OrderStatus excludedStatus);

    // Admin cross-store views (Module 12). Customer data itself stays store-scoped.
    List<Order> findByCustomer(Customer customer);
    List<Order> findByStatus(OrderStatus status);
    List<Order> findByCreatedAtBetween(LocalDateTime start, LocalDateTime end);

    // --- Admin Overview: grouped aggregates, never a per-store loop. ---

    /** Recorded order value grouped by store currency, for the given statuses since a cutoff. */
    @Query("""
            SELECT o.merchant.currency AS currency, COALESCE(SUM(o.totalAmount), 0) AS total, COUNT(o) AS orders
            FROM Order o
            WHERE o.status IN :statuses AND o.createdAt >= :since
            GROUP BY o.merchant.currency
            ORDER BY o.merchant.currency
            """)
    List<CurrencyValueRow> valueByCurrencySince(@Param("statuses") Collection<OrderStatus> statuses,
                                                @Param("since") LocalDateTime since);

    /** Timestamps of all orders since a cutoff, for bucketing into per-day counts in memory. */
    @Query("SELECT o.createdAt FROM Order o WHERE o.createdAt >= :since")
    List<LocalDateTime> createdAtSince(@Param("since") LocalDateTime since);

    /** Stores ranked by order count since a cutoff, with recorded value (given statuses only). */
    @Query("""
            SELECT o.merchant.id AS id, o.merchant.name AS name, o.merchant.slug AS slug,
                   o.merchant.currency AS currency, COUNT(o) AS orders,
                   COALESCE(SUM(CASE WHEN o.status IN :statuses THEN o.totalAmount ELSE 0 END), 0) AS value
            FROM Order o
            WHERE o.createdAt >= :since
            GROUP BY o.merchant.id, o.merchant.name, o.merchant.slug, o.merchant.currency
            ORDER BY COUNT(o) DESC
            """)
    List<TopStoreRow> topStoresSince(@Param("statuses") Collection<OrderStatus> statuses,
                                     @Param("since") LocalDateTime since,
                                     Pageable pageable);
}
