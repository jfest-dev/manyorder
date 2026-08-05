package com.manyorder.api.domain.product;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.manyorder.api.domain.category.Category;
import com.manyorder.api.domain.merchant.Merchant;

public interface ProductRepository extends JpaRepository<Product, Long> {
    List<Product> findByMerchant(Merchant merchant);
    List<Product> findByMerchantAndIsActiveTrue(Merchant merchant);
    Optional<Product> findByMerchantAndId(Merchant merchant, Long id);

    /** Product counts per category for a store: [categoryId, count]. */
    @Query("""
            SELECT p.category.id, COUNT(p)
            FROM Product p
            WHERE p.merchant = :merchant AND p.category IS NOT NULL
            GROUP BY p.category.id
            """)
    List<Object[]> countByCategory(@Param("merchant") Merchant merchant);

    /** Uncategorize every product in a category (used when the category is deleted). */
    @Modifying
    @Query("UPDATE Product p SET p.category = null WHERE p.category = :category")
    int clearCategory(@Param("category") Category category);
}
