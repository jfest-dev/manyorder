package com.manyorder.api.domain.admin;

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
import com.manyorder.api.domain.discount.ReorderDiscountsRequest;
import com.manyorder.api.domain.discount.UpdateDiscountRequest;
import com.manyorder.api.domain.merchant.Merchant;
import com.manyorder.api.domain.user.User;
import com.manyorder.api.security.CurrentUserService;
import com.manyorder.api.security.StoreAccessService;

import jakarta.validation.Valid;

/** Platform-admin management of ANY merchant's discounts. PLATFORM_ADMIN-only via SecurityConfig. */
@RestController
@RequestMapping("/admin/merchants/{merchantId}/discounts")
public class AdminDiscountController {

    private final DiscountService discountService;
    private final CurrentUserService currentUserService;
    private final StoreAccessService storeAccessService;
    private final AdminAuditService adminAuditService;

    public AdminDiscountController(DiscountService discountService,
                                   CurrentUserService currentUserService,
                                   StoreAccessService storeAccessService,
                                   AdminAuditService adminAuditService) {
        this.discountService = discountService;
        this.currentUserService = currentUserService;
        this.storeAccessService = storeAccessService;
        this.adminAuditService = adminAuditService;
    }

    private Merchant store(Authentication auth, Long merchantId) {
        return storeAccessService.requireStoreForAdmin(currentUserService.require(auth), merchantId);
    }

    @GetMapping
    public List<DiscountResponse> list(@PathVariable Long merchantId, Authentication auth) {
        return discountService.getDiscounts(store(auth, merchantId));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public DiscountResponse create(@PathVariable Long merchantId, @Valid @RequestBody CreateDiscountRequest request,
                                   Authentication auth) {
        return discountService.createDiscount(store(auth, merchantId), request);
    }

    @PatchMapping("/reorder")
    public List<DiscountResponse> reorder(@PathVariable Long merchantId, @Valid @RequestBody ReorderDiscountsRequest request,
                                          Authentication auth) {
        return discountService.reorderDiscounts(store(auth, merchantId), request.getDiscountIds());
    }

    @PatchMapping("/{discountId}")
    public DiscountResponse update(@PathVariable Long merchantId, @PathVariable Long discountId,
                                   @Valid @RequestBody UpdateDiscountRequest request, Authentication auth) {
        return discountService.updateDiscount(store(auth, merchantId), discountId, request);
    }

    @DeleteMapping("/{discountId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long merchantId, @PathVariable Long discountId, Authentication auth) {
        User admin = currentUserService.require(auth);
        Merchant merchant = storeAccessService.requireStoreForAdmin(admin, merchantId);
        discountService.deleteDiscount(merchant, discountId);
        adminAuditService.record(admin, "DELETE_DISCOUNT", "DISCOUNT", discountId, "@ " + merchant.getName());
    }
}
