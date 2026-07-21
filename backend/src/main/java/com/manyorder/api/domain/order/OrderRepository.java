package com.manyorder.api.domain.order;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.manyorder.api.domain.customer.Customer;
import com.manyorder.api.domain.merchant.Merchant;

public interface OrderRepository extends JpaRepository<Order, Long> {
    List<Order> findByMerchantOrderByCreatedAtDesc(Merchant merchant);
    Optional<Order> findByMerchantAndId(Merchant merchant, Long id);
    List<Order> findByMerchantAndStatusOrderByCreatedAtDesc(Merchant merchant, OrderStatus status);
    List<Order> findByMerchantAndCreatedAtBetween(Merchant merchant, LocalDateTime start, LocalDateTime end);

    // Admin cross-store views (Module 12). Customer data itself stays store-scoped.
    List<Order> findByCustomer(Customer customer);
    List<Order> findByStatus(OrderStatus status);
    List<Order> findByCreatedAtBetween(LocalDateTime start, LocalDateTime end);
}
