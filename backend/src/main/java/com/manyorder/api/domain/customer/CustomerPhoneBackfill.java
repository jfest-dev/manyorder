package com.manyorder.api.domain.customer;

import java.util.List;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * One-time, idempotent backfill: populate phoneNormalized for customers created
 * before that column existed, so identity matching works against old data too.
 * Only rows where it is still null are touched, so re-runs (and fresh installs,
 * where there are none) are no-ops.
 */
@Component
public class CustomerPhoneBackfill implements ApplicationRunner {

    private final CustomerRepository customerRepository;

    public CustomerPhoneBackfill(CustomerRepository customerRepository) {
        this.customerRepository = customerRepository;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        List<Customer> pending = customerRepository.findByPhoneNormalizedIsNull();
        for (Customer c : pending) c.refreshPhoneNormalized();
        if (!pending.isEmpty()) customerRepository.saveAll(pending);
    }
}
