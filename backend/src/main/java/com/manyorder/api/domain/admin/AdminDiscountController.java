package com.manyorder.api.domain.admin;

import java.util.List;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.manyorder.api.domain.discount.DiscountResponse;
import com.manyorder.api.domain.discount.DiscountService;
import com.manyorder.api.domain.merchant.Merchant;
import com.manyorder.api.security.CurrentUserService;
import com.manyorder.api.security.StoreAccessService;

/** Platform-admin VIEW of a merchant's discounts (read-only). PLATFORM_ADMIN-only via SecurityConfig. */
@RestController
@RequestMapping("/admin/merchants/{merchantId}/discounts")
public class AdminDiscountController {

    private final DiscountService discountService;
    private final CurrentUserService currentUserService;
    private final StoreAccessService storeAccessService;

    public AdminDiscountController(DiscountService discountService,
                                   CurrentUserService currentUserService,
                                   StoreAccessService storeAccessService) {
        this.discountService = discountService;
        this.currentUserService = currentUserService;
        this.storeAccessService = storeAccessService;
    }

    private Merchant store(Authentication auth, Long merchantId) {
        return storeAccessService.requireStoreForAdmin(currentUserService.require(auth), merchantId);
    }

    @GetMapping
    public List<DiscountResponse> list(@PathVariable Long merchantId, Authentication auth) {
        return discountService.getDiscounts(store(auth, merchantId));
    }

    // Switch a discount off/on only (the Active flag). No other field may be edited by admin.
    @PatchMapping("/{discountId}/deactivate")
    public DiscountResponse deactivate(@PathVariable Long merchantId, @PathVariable Long discountId, Authentication auth) {
        return discountService.deactivateDiscount(store(auth, merchantId), discountId);
    }

    @PatchMapping("/{discountId}/activate")
    public DiscountResponse activate(@PathVariable Long merchantId, @PathVariable Long discountId, Authentication auth) {
        return discountService.activateDiscount(store(auth, merchantId), discountId);
    }
}
