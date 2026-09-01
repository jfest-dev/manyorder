package com.manyorder.api.domain.merchant;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.manyorder.api.domain.customer.CreateCustomerRequest;
import com.manyorder.api.domain.customer.CustomerResponse;
import com.manyorder.api.domain.customer.CustomerService;
import com.manyorder.api.domain.user.User;
import com.manyorder.api.security.CurrentUserService;
import com.manyorder.api.security.StoreAccessService;

import jakarta.validation.Valid;

/** Staff may view a store's customers; only the owner may add one manually. */
@RestController
@RequestMapping("/merchant/stores/{storeId}/customers")
public class MerchantCustomerController {

    private final CustomerService customerService;
    private final CurrentUserService currentUserService;
    private final StoreAccessService storeAccessService;

    public MerchantCustomerController(CustomerService customerService,
                                      CurrentUserService currentUserService,
                                      StoreAccessService storeAccessService) {
        this.customerService = customerService;
        this.currentUserService = currentUserService;
        this.storeAccessService = storeAccessService;
    }

    @GetMapping
    public List<CustomerResponse> getCustomers(@PathVariable Long storeId, Authentication authentication) {
        User user = currentUserService.require(authentication);
        Merchant merchant = storeAccessService.requireStoreMembership(user, storeId);
        return customerService.listForStore(merchant);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CustomerResponse createCustomer(@PathVariable Long storeId,
                                           @Valid @RequestBody CreateCustomerRequest request,
                                           Authentication authentication) {
        User user = currentUserService.require(authentication);
        Merchant merchant = storeAccessService.requireOwnedStore(user, storeId);
        return customerService.createCustomer(merchant, request);
    }
}
