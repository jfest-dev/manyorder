package com.manyorder.api.domain.customer;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.manyorder.api.domain.merchant.Merchant;

public interface CustomerRepository extends JpaRepository<Customer, Long> {

    List<Customer> findByMerchant(Merchant merchant);
    Optional<Customer> findByMerchantAndId(Merchant merchant, Long id);
    Optional<Customer> findByMerchantAndEmail(Merchant merchant, String email);

    /** Identity match on the digits-only phone, so formatting differences of the
     *  same number resolve to one customer. */
    Optional<Customer> findByMerchantAndPhoneNormalized(Merchant merchant, String phoneNormalized);

    /** Rows created before phoneNormalized existed (or otherwise unset), for the
     *  one-time backfill. */
    List<Customer> findByPhoneNormalizedIsNull();
}