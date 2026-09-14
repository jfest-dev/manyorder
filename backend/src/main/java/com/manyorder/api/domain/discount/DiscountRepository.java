package com.manyorder.api.domain.discount;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.manyorder.api.domain.merchant.Merchant;

public interface DiscountRepository extends JpaRepository<Discount, Long> {

    List<Discount> findByMerchantOrderByCreatedAtDesc(Merchant merchant);

    /** Public offers for a store (newest first). Explicit JPQL to reference the
     *  isPublic attribute unambiguously; further "live" filtering (window, usage)
     *  happens in the service. */
    @Query("SELECT d FROM Discount d WHERE d.merchant = :merchant AND d.isPublic = true ORDER BY d.createdAt DESC")
    List<Discount> findPublicByMerchant(@Param("merchant") Merchant merchant);

    Optional<Discount> findByMerchantAndId(Merchant merchant, Long id);

    Optional<Discount> findByMerchantAndCodeIgnoreCase(Merchant merchant, String code);

    boolean existsByMerchantAndCodeIgnoreCase(Merchant merchant, String code);
}
