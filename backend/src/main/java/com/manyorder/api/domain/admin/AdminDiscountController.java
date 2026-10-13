package com.manyorder.api.domain.admin;

import java.util.List;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.manyorder.api.domain.discount.DiscountResponse;
import com.manyorder.api.domain.discount.DiscountService;
import com.manyorder.api.domain.merchant.Merchant;
import com.manyorder.api.security.CurrentUserService;
import com.manyorder.api.security.StoreAccessService;

import jakarta.servlet.http.HttpServletRequest;

/** Platform-admin VIEW of a merchant's discounts (read-only). PLATFORM_ADMIN-only via SecurityConfig. */
@RestController
@RequestMapping("/admin/merchants/{merchantId}/discounts")
public class AdminDiscountController {

    private final DiscountService discountService;
    private final CurrentUserService currentUserService;
    private final StoreAccessService storeAccessService;
    private final MerchantActionMailer merchantActionMailer;

    public AdminDiscountController(DiscountService discountService,
                                   CurrentUserService currentUserService,
                                   StoreAccessService storeAccessService,
                                   MerchantActionMailer merchantActionMailer) {
        this.discountService = discountService;
        this.currentUserService = currentUserService;
        this.storeAccessService = storeAccessService;
        this.merchantActionMailer = merchantActionMailer;
    }

    private Merchant store(Authentication auth, Long merchantId) {
        return storeAccessService.requireStoreForAdmin(currentUserService.require(auth), merchantId);
    }

    @GetMapping
    public List<DiscountResponse> list(@PathVariable Long merchantId, Authentication auth) {
        return discountService.getDiscounts(store(auth, merchantId));
    }

    // Switch a discount off/on only (the Active flag). No other field may be edited by admin.
    /** Switch a discount off. Requires a reason, saved to the audit log and emailed to the owner. */
    @PatchMapping("/{discountId}/deactivate")
    public DiscountResponse deactivate(@PathVariable Long merchantId, @PathVariable Long discountId,
                                       @RequestBody AdminReasonRequest body, Authentication auth,
                                       HttpServletRequest request) {
        String reason = body.validated();
        Merchant store = store(auth, merchantId);
        DiscountResponse result = discountService.deactivateDiscount(store, discountId);
        request.setAttribute(AdminAuditInterceptor.DETAIL_ATTRIBUTE, reason);
        try {
            merchantActionMailer.notifyOwner(store, MerchantActionMailer.Action.DISCOUNT_DISABLED, reason);
        } catch (Exception e) {
            // A failed notice must never undo the switch-off, which is already committed.
        }
        return result;
    }

    @PatchMapping("/{discountId}/activate")
    public DiscountResponse activate(@PathVariable Long merchantId, @PathVariable Long discountId, Authentication auth) {
        return discountService.activateDiscount(store(auth, merchantId), discountId);
    }
}
