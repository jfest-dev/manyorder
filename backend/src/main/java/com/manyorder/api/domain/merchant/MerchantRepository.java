package com.manyorder.api.domain.merchant;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.manyorder.api.domain.user.User;

public interface MerchantRepository extends JpaRepository<Merchant, Long> {
    List<Merchant> findByOwnerOrderByCreatedAtAsc(User owner);
    long countByOwner(User owner);
    Optional<Merchant> findBySlug(String slug);
    boolean existsBySlug(String slug);
}
