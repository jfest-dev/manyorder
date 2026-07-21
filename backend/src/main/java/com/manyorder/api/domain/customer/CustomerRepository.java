package com.manyorder.api.domain.customer;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.manyorder.api.domain.merchant.Merchant;

public interface CustomerRepository extends JpaRepository<Customer, Long> {

    List<Customer> findByMerchant(Merchant merchant);
    Optional<Customer> findByMerchantAndId(Merchant merchant, Long id);
    Optional<Customer> findByMerchantAndEmail(Merchant merchant, String email);
    Optional<Customer> findByMerchantAndPhoneNumber(Merchant merchant, String phoneNumber);
}