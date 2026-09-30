package com.manyorder.api.domain.admin;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.manyorder.api.domain.customer.CreateCustomerRequest;
import com.manyorder.api.domain.customer.CustomerResponse;
import com.manyorder.api.domain.customer.CustomerService;
import com.manyorder.api.domain.customer.UpdateCustomerRequest;
import com.manyorder.api.domain.merchant.Merchant;
import com.manyorder.api.domain.user.User;
import com.manyorder.api.security.CurrentUserService;
import com.manyorder.api.security.StoreAccessService;

import jakarta.validation.Valid;

/** Platform-admin management of ANY merchant's customers. PLATFORM_ADMIN-only via SecurityConfig. */
@RestController
@RequestMapping("/admin/merchants/{merchantId}/customers")
public class AdminCustomerController {

    private final CustomerService customerService;
    private final CurrentUserService currentUserService;
    private final StoreAccessService storeAccessService;
    private final AdminAuditService adminAuditService;

    public AdminCustomerController(CustomerService customerService,
                                   CurrentUserService currentUserService,
                                   StoreAccessService storeAccessService,
                                   AdminAuditService adminAuditService) {
        this.customerService = customerService;
        this.currentUserService = currentUserService;
        this.storeAccessService = storeAccessService;
        this.adminAuditService = adminAuditService;
    }

    private Merchant store(Authentication auth, Long merchantId) {
        return storeAccessService.requireStoreForAdmin(currentUserService.require(auth), merchantId);
    }

    @GetMapping
    public List<CustomerResponse> list(@PathVariable Long merchantId, Authentication auth) {
        return customerService.listForStore(store(auth, merchantId));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CustomerResponse create(@PathVariable Long merchantId, @Valid @RequestBody CreateCustomerRequest request,
                                   Authentication auth) {
        return customerService.createCustomer(store(auth, merchantId), request);
    }

    @PutMapping("/{customerId}")
    public CustomerResponse update(@PathVariable Long merchantId, @PathVariable Long customerId,
                                   @Valid @RequestBody UpdateCustomerRequest request, Authentication auth) {
        return customerService.updateCustomer(store(auth, merchantId), customerId, request);
    }

    @DeleteMapping("/{customerId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long merchantId, @PathVariable Long customerId, Authentication auth) {
        User admin = currentUserService.require(auth);
        Merchant merchant = storeAccessService.requireStoreForAdmin(admin, merchantId);
        customerService.deleteCustomer(merchant, customerId);
        adminAuditService.record(admin, "DELETE_CUSTOMER", "CUSTOMER", customerId, "@ " + merchant.getName());
    }
}
