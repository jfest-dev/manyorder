package com.manyorder.api.domain.admin;

import java.util.List;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.manyorder.api.domain.customer.CustomerResponse;
import com.manyorder.api.domain.customer.CustomerService;
import com.manyorder.api.domain.merchant.Merchant;
import com.manyorder.api.security.CurrentUserService;
import com.manyorder.api.security.StoreAccessService;

/** Platform-admin VIEW of a merchant's customers (read-only). PLATFORM_ADMIN-only via SecurityConfig. */
@RestController
@RequestMapping("/admin/merchants/{merchantId}/customers")
public class AdminCustomerController {

    private final CustomerService customerService;
    private final CurrentUserService currentUserService;
    private final StoreAccessService storeAccessService;

    public AdminCustomerController(CustomerService customerService,
                                   CurrentUserService currentUserService,
                                   StoreAccessService storeAccessService) {
        this.customerService = customerService;
        this.currentUserService = currentUserService;
        this.storeAccessService = storeAccessService;
    }

    private Merchant store(Authentication auth, Long merchantId) {
        return storeAccessService.requireStoreForAdmin(currentUserService.require(auth), merchantId);
    }

    @GetMapping
    public List<CustomerResponse> list(@PathVariable Long merchantId, Authentication auth) {
        return customerService.listForStore(store(auth, merchantId));
    }
}
