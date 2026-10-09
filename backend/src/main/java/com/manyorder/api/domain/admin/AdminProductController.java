package com.manyorder.api.domain.admin;

import java.util.List;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.manyorder.api.domain.merchant.Merchant;
import com.manyorder.api.domain.product.ProductResponse;
import com.manyorder.api.domain.product.ProductService;
import com.manyorder.api.security.CurrentUserService;
import com.manyorder.api.security.StoreAccessService;

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

    public AdminProductController(ProductService productService,
                                  CurrentUserService currentUserService,
                                  StoreAccessService storeAccessService) {
        this.productService = productService;
        this.currentUserService = currentUserService;
        this.storeAccessService = storeAccessService;
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

    @PatchMapping("/{productId}/deactivate")
    public ProductResponse deactivate(@PathVariable Long merchantId, @PathVariable Long productId, Authentication auth) {
        return productService.deactivateProduct(store(auth, merchantId), productId);
    }

    @PatchMapping("/{productId}/activate")
    public ProductResponse activate(@PathVariable Long merchantId, @PathVariable Long productId, Authentication auth) {
        return productService.activateProduct(store(auth, merchantId), productId);
    }
}
