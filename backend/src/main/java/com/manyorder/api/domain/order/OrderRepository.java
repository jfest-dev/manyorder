package com.manyorder.api.domain.order;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.manyorder.api.domain.customer.Customer;
import com.manyorder.api.domain.customer.CustomerOrderStats;
import com.manyorder.api.domain.merchant.Merchant;

public interface OrderRepository extends JpaRepository<Order, Long> {
    List<Order> findByMerchantOrderByCreatedAtDesc(Merchant merchant);
    Optional<Order> findByMerchantAndId(Merchant merchant, Long id);
    List<Order> findByMerchantAndOrderGroupIdOrderByIdAsc(Merchant merchant, String orderGroupId);
    List<Order> findByMerchantAndStatusOrderByCreatedAtDesc(Merchant merchant, OrderStatus status);
    List<Order> findByMerchantAndCreatedAtBetween(Merchant merchant, LocalDateTime start, LocalDateTime end);

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
}
