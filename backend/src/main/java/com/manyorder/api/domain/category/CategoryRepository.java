package com.manyorder.api.domain.category;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.manyorder.api.domain.merchant.Merchant;

public interface CategoryRepository extends JpaRepository<Category, Long> {
    List<Category> findByMerchantOrderByDisplayOrderAscNameAsc(Merchant merchant);
    Optional<Category> findByMerchantAndId(Merchant merchant, Long id);
    boolean existsByMerchantAndNameIgnoreCase(Merchant merchant, String name);
}
