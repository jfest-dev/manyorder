package com.manyorder.api.domain.admin;

import java.util.List;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.manyorder.api.domain.merchant.Merchant;
import com.manyorder.api.domain.product.ProductResponse;
import com.manyorder.api.domain.product.ProductService;
import com.manyorder.api.security.CurrentUserService;
import com.manyorder.api.security.StoreAccessService;

import jakarta.servlet.http.HttpServletRequest;

/**
 * Platform-admin surface for a merchant's products: VIEW, plus hide/unhide
 * (deactivate/activate) only. Admins cannot create, edit, reorder or delete
 * products - those stay with the merchant. URL-gated to PLATFORM_ADMIN by
 * SecurityConfig; the store is resolved via
 * {@link StoreAccessService#requireStoreForAdmin}.
 */
@RestController
@RequestMapping("/admin/merchants/{merchantId}/products")
public class AdminProductController {

    private final ProductService productService;
    private final CurrentUserService currentUserService;
    private final StoreAccessService storeAccessService;
    private final MerchantActionMailer merchantActionMailer;

    public AdminProductController(ProductService productService,
                                  CurrentUserService currentUserService,
                                  StoreAccessService storeAccessService,
                                  MerchantActionMailer merchantActionMailer) {
        this.productService = productService;
        this.currentUserService = currentUserService;
        this.storeAccessService = storeAccessService;
        this.merchantActionMailer = merchantActionMailer;
    }

    private Merchant store(Authentication auth, Long merchantId) {
        return storeAccessService.requireStoreForAdmin(currentUserService.require(auth), merchantId);
    }

    @GetMapping
    public List<ProductResponse> list(@PathVariable Long merchantId, Authentication auth) {
        return productService.getProducts(store(auth, merchantId));
    }

    @GetMapping("/{productId}")
    public ProductResponse get(@PathVariable Long merchantId, @PathVariable Long productId, Authentication auth) {
        return productService.getProduct(store(auth, merchantId), productId);
    }

    /** Hide (deactivate) a product. Restricting: reason required, always emails the owner. */
    @PatchMapping("/{productId}/deactivate")
    public ProductResponse deactivate(@PathVariable Long merchantId, @PathVariable Long productId,
                                      @RequestBody AdminReasonRequest body, Authentication auth,
                                      HttpServletRequest request) {
        String reason = body.validated();
        Merchant store = store(auth, merchantId);
        ProductResponse result = productService.deactivateProduct(store, productId);
        boolean sent = notify(store, MerchantActionMailer.Action.PRODUCT_HIDDEN, reason);
        request.setAttribute(AdminAuditInterceptor.DETAIL_ATTRIBUTE, reason);
        request.setAttribute(AdminAuditInterceptor.EMAIL_SENT_ATTRIBUTE, sent);
        request.setAttribute(AdminAuditInterceptor.STORE_NAME_ATTRIBUTE, store.getName());
        request.setAttribute(AdminAuditInterceptor.TARGET_LABEL_ATTRIBUTE, result.getName());
        return result;
    }

    /** Unhide (activate) a product. Restoring: reason optional, emails the owner by default. */
    @PatchMapping("/{productId}/activate")
    public ProductResponse activate(@PathVariable Long merchantId, @PathVariable Long productId,
                                    @RequestBody(required = false) AdminReasonRequest body, Authentication auth,
                                    HttpServletRequest request) {
        AdminReasonRequest req = body == null ? new AdminReasonRequest(null, null) : body;
        String reason = req.optionalReason();
        Merchant store = store(auth, merchantId);
        ProductResponse result = productService.activateProduct(store, productId);
        boolean sent = req.shouldEmail() && notify(store, MerchantActionMailer.Action.PRODUCT_SHOWN, reason);
        request.setAttribute(AdminAuditInterceptor.DETAIL_ATTRIBUTE, reason);
        request.setAttribute(AdminAuditInterceptor.EMAIL_SENT_ATTRIBUTE, sent);
        request.setAttribute(AdminAuditInterceptor.STORE_NAME_ATTRIBUTE, store.getName());
        request.setAttribute(AdminAuditInterceptor.TARGET_LABEL_ATTRIBUTE, result.getName());
        return result;
    }

    /** Email the owner, swallowing any failure (a failed notice never undoes the action). */
    private boolean notify(Merchant store, MerchantActionMailer.Action action, String reason) {
        try {
            return merchantActionMailer.notifyOwner(store, action, reason);
        } catch (Exception e) {
            return false;
        }
    }
}
