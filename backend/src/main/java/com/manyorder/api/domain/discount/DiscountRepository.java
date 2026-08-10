package com.manyorder.api.domain.discount;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.manyorder.api.domain.merchant.Merchant;

public interface DiscountRepository extends JpaRepository<Discount, Long> {

    List<Discount> findByMerchantOrderByCreatedAtDesc(Merchant merchant);

    Optional<Discount> findByMerchantAndId(Merchant merchant, Long id);

    Optional<Discount> findByMerchantAndCodeIgnoreCase(Merchant merchant, String code);

    boolean existsByMerchantAndCodeIgnoreCase(Merchant merchant, String code);
}
