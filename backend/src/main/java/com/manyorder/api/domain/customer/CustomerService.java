package com.manyorder.api.domain.customer;

import java.math.BigDecimal;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import com.manyorder.api.domain.merchant.Merchant;
import com.manyorder.api.domain.order.OrderRepository;
import com.manyorder.api.domain.order.OrderStatus;

@Service
public class CustomerService {

    private final CustomerRepository customerRepository;
    private final OrderRepository orderRepository;

    public CustomerService(CustomerRepository customerRepository, OrderRepository orderRepository) {
        this.customerRepository = customerRepository;
        this.orderRepository = orderRepository;
    }

    /** A store's customers, each with derived order count, spend and first/last order. */
    public List<CustomerResponse> listForStore(Merchant merchant) {
        Map<Long, CustomerOrderStats> statsById = orderRepository
                .aggregateCustomerStats(merchant, OrderStatus.CANCELLED)
                .stream()
                .collect(Collectors.toMap(CustomerOrderStats::getCustomerId, Function.identity()));

        return customerRepository.findByMerchant(merchant).stream()
                .map(c -> {
                    CustomerOrderStats s = statsById.get(c.getId());
                    return s == null
                            ? new CustomerResponse(c, 0, BigDecimal.ZERO, null, null)
                            : new CustomerResponse(c, s.getOrderCount(), s.getTotalSpent(), s.getFirstOrderAt(), s.getLastOrderAt());
                })
                // Most active first, then most recently added.
                .sorted(Comparator.comparingLong(CustomerResponse::getOrdersCount).reversed()
                        .thenComparing(CustomerResponse::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();
    }

    /**
     * Add a customer manually. Dedupes on the same key as guest checkout and
     * manual orders (phone, then email) so the three creation paths never
     * produce two records for one person; a match is rejected as a conflict.
     */
    public CustomerResponse createCustomer(Merchant merchant, CreateCustomerRequest req) {
        String phone = req.getPhoneNumber();
        String email = req.getEmail();
        boolean exists =
                (phone != null && !phone.isBlank() && customerRepository.findByMerchantAndPhoneNumber(merchant, phone).isPresent())
                || (email != null && !email.isBlank() && customerRepository.findByMerchantAndEmail(merchant, email).isPresent());
        if (exists) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "A customer with this phone or email already exists.");
        }
        Customer saved = customerRepository.save(
                new Customer(merchant, req.getFullName(), email != null ? email : "", phone));
        return new CustomerResponse(saved, 0, BigDecimal.ZERO, null, null);
    }
}
