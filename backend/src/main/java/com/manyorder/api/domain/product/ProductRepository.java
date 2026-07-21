package com.manyorder.api.domain.product;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.manyorder.api.domain.merchant.Merchant;

public interface ProductRepository extends JpaRepository<Product, Long> {
    List<Product> findByMerchant(Merchant merchant);
    List<Product> findByMerchantAndIsActiveTrue(Merchant merchant);
    Optional<Product> findByMerchantAndId(Merchant merchant, Long id);
}