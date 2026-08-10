package com.manyorder.api.domain.merchant;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.manyorder.api.domain.discount.CreateDiscountRequest;
import com.manyorder.api.domain.discount.DiscountResponse;
import com.manyorder.api.domain.discount.DiscountService;
import com.manyorder.api.domain.discount.UpdateDiscountRequest;
import com.manyorder.api.domain.user.User;
import com.manyorder.api.security.CurrentUserService;
import com.manyorder.api.security.StoreAccessService;

import jakarta.validation.Valid;

/** Staff may view discount codes; only the owner may create, edit, or delete them. */
@RestController
@RequestMapping("/merchant/stores/{storeId}/discounts")
public class MerchantDiscountController {

    private final DiscountService discountService;
    private final CurrentUserService currentUserService;
    private final StoreAccessService storeAccessService;

    public MerchantDiscountController(DiscountService discountService,
                                      CurrentUserService currentUserService,
                                      StoreAccessService storeAccessService) {
        this.discountService = discountService;
        this.currentUserService = currentUserService;
        this.storeAccessService = storeAccessService;
    }

    @GetMapping
    public List<DiscountResponse> getDiscounts(@PathVariable Long storeId, Authentication authentication) {
        User user = currentUserService.require(authentication);
        Merchant merchant = storeAccessService.requireStoreMembership(user, storeId);
        return discountService.getDiscounts(merchant);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public DiscountResponse createDiscount(@PathVariable Long storeId,
                                           @Valid @RequestBody CreateDiscountRequest request,
                                           Authentication authentication) {
        User user = currentUserService.require(authentication);
        Merchant merchant = storeAccessService.requireOwnedStore(user, storeId);
        return discountService.createDiscount(merchant, request);
    }

    @PatchMapping("/{discountId}")
    public DiscountResponse updateDiscount(@PathVariable Long storeId,
                                           @PathVariable Long discountId,
                                           @Valid @RequestBody UpdateDiscountRequest request,
                                           Authentication authentication) {
        User user = currentUserService.require(authentication);
        Merchant merchant = storeAccessService.requireOwnedStore(user, storeId);
        return discountService.updateDiscount(merchant, discountId, request);
    }

    @DeleteMapping("/{discountId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteDiscount(@PathVariable Long storeId,
                               @PathVariable Long discountId,
                               Authentication authentication) {
        User user = currentUserService.require(authentication);
        Merchant merchant = storeAccessService.requireOwnedStore(user, storeId);
        discountService.deleteDiscount(merchant, discountId);
    }
}
