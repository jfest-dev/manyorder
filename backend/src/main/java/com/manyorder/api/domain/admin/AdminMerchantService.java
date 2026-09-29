package com.manyorder.api.domain.admin;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.manyorder.api.domain.customer.CustomerRepository;
import com.manyorder.api.domain.merchant.Merchant;
import com.manyorder.api.domain.merchant.MerchantRepository;
import com.manyorder.api.domain.order.OrderRepository;
import com.manyorder.api.domain.product.ProductRepository;
import com.manyorder.api.domain.user.User;
import com.manyorder.api.security.StoreAccessService;

/** Read side of the Platform Admin surface: cross-merchant list, drill-down, and metrics. */
@Service
public class AdminMerchantService {

    private final MerchantRepository merchantRepository;
    private final ProductRepository productRepository;
    private final OrderRepository orderRepository;
    private final CustomerRepository customerRepository;
    private final StoreAccessService storeAccessService;

    public AdminMerchantService(MerchantRepository merchantRepository,
                                ProductRepository productRepository,
                                OrderRepository orderRepository,
                                CustomerRepository customerRepository,
                                StoreAccessService storeAccessService) {
        this.merchantRepository = merchantRepository;
        this.productRepository = productRepository;
        this.orderRepository = orderRepository;
        this.customerRepository = customerRepository;
        this.storeAccessService = storeAccessService;
    }

    @Transactional(readOnly = true)
    public List<AdminMerchantSummary> listMerchants() {
        return merchantRepository.findAllByOrderByCreatedAtDesc().stream().map(this::toSummary).toList();
    }

    @Transactional(readOnly = true)
    public AdminMerchantSummary getMerchant(User admin, Long merchantId) {
        return toSummary(storeAccessService.requireStoreForAdmin(admin, merchantId));
    }

    @Transactional(readOnly = true)
    public AdminMetricsResponse metrics() {
        return new AdminMetricsResponse(
                merchantRepository.count(),
                merchantRepository.countByArchivedAtIsNullAndSuspendedAtIsNull(),
                merchantRepository.countBySuspendedAtIsNotNull(),
                merchantRepository.countByArchivedAtIsNotNull(),
                orderRepository.count(),
                customerRepository.count(),
                merchantRepository.countByCreatedAtAfter(LocalDateTime.now().minusDays(30)));
    }

    private AdminMerchantSummary toSummary(Merchant m) {
        String status = m.isSuspended() ? "SUSPENDED" : m.isArchived() ? "ARCHIVED" : "ACTIVE";
        return new AdminMerchantSummary(
                m.getId(), m.getName(), m.getSlug(),
                m.getOwner().getFullName(), m.getOwner().getEmail(),
                status, m.getCurrency(), m.getCreatedAt(),
                productRepository.countByMerchant(m),
                orderRepository.countByMerchant(m),
                customerRepository.countByMerchant(m));
    }
}
