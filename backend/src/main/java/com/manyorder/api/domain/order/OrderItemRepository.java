package com.manyorder.api.domain.order;

import java.util.Collection;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.manyorder.api.domain.merchant.Merchant;
import com.manyorder.api.domain.product.Product;

public interface OrderItemRepository extends JpaRepository<OrderItem, Long> {

    List<OrderItem> findByOrder(Order order);

    /**
     * Units sold per product for a store: total quantity across the given order
     * statuses (COMPLETED + DELIVERED). One query for the whole store, mapped to
     * a productId -> unitsSold map by the caller. Products with no sales are
     * simply absent (treated as 0).
     */
    @Query("""
            SELECT oi.product.id, SUM(oi.quantity)
            FROM OrderItem oi
            WHERE oi.order.merchant = :merchant AND oi.order.status IN :statuses
            GROUP BY oi.product.id
            """)
    List<Object[]> sumSoldByMerchant(@Param("merchant") Merchant merchant,
                                     @Param("statuses") Collection<OrderStatus> statuses);

    /** Units sold for a single product across the given statuses (0 when none). */
    @Query("""
            SELECT COALESCE(SUM(oi.quantity), 0)
            FROM OrderItem oi
            WHERE oi.product = :product AND oi.order.status IN :statuses
            """)
    long sumSoldForProduct(@Param("product") Product product,
                           @Param("statuses") Collection<OrderStatus> statuses);

    /** Total units sold across the whole store (all products, incl. now-inactive). */
    @Query("""
            SELECT COALESCE(SUM(oi.quantity), 0)
            FROM OrderItem oi
            WHERE oi.order.merchant = :merchant AND oi.order.status IN :statuses
            """)
    long sumAllSoldByMerchant(@Param("merchant") Merchant merchant,
                              @Param("statuses") Collection<OrderStatus> statuses);

    // --- Public (storefront-only) variants: exclude MANUAL orders so a merchant
    //     can't inflate the public "sold" numbers from their own dashboard. ---

    @Query("""
            SELECT oi.product.id, SUM(oi.quantity)
            FROM OrderItem oi
            WHERE oi.order.merchant = :merchant AND oi.order.status IN :statuses
              AND oi.order.source = :source
            GROUP BY oi.product.id
            """)
    List<Object[]> sumSoldByMerchantAndSource(@Param("merchant") Merchant merchant,
                                              @Param("statuses") Collection<OrderStatus> statuses,
                                              @Param("source") OrderSource source);

    @Query("""
            SELECT COALESCE(SUM(oi.quantity), 0)
            FROM OrderItem oi
            WHERE oi.order.merchant = :merchant AND oi.order.status IN :statuses
              AND oi.order.source = :source
            """)
    long sumAllSoldByMerchantAndSource(@Param("merchant") Merchant merchant,
                                       @Param("statuses") Collection<OrderStatus> statuses,
                                       @Param("source") OrderSource source);
}
