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

import com.manyorder.api.domain.merchant.Merchant;
import com.manyorder.api.domain.product.CreateProductRequest;
import com.manyorder.api.domain.product.ProductResponse;
import com.manyorder.api.domain.product.ProductService;
import com.manyorder.api.domain.product.ReorderProductsRequest;
import com.manyorder.api.domain.product.UpdateProductRequest;
import com.manyorder.api.domain.user.User;
import com.manyorder.api.security.CurrentUserService;
import com.manyorder.api.security.StoreAccessService;

import jakarta.validation.Valid;

/**
 * Platform-admin management of ANY merchant's products. Mirrors
 * MerchantProductController but resolves the store via
 * {@link StoreAccessService#requireStoreForAdmin} instead of ownership — so the
 * merchant-facing gate is untouched. URL-gated to PLATFORM_ADMIN by SecurityConfig.
 * (Photo upload is intentionally left to the merchant flow for now.)
 */
@RestController
@RequestMapping("/admin/merchants/{merchantId}/products")
public class AdminProductController {

    private final ProductService productService;
    private final CurrentUserService currentUserService;
    private final StoreAccessService storeAccessService;
    private final AdminAuditService adminAuditService;

    public AdminProductController(ProductService productService,
                                  CurrentUserService currentUserService,
                                  StoreAccessService storeAccessService,
                                  AdminAuditService adminAuditService) {
        this.productService = productService;
        this.currentUserService = currentUserService;
        this.storeAccessService = storeAccessService;
        this.adminAuditService = adminAuditService;
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

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ProductResponse create(@PathVariable Long merchantId, @Valid @RequestBody CreateProductRequest request,
                                  Authentication auth) {
        return productService.createProduct(store(auth, merchantId), request);
    }

    @PatchMapping("/reorder")
    public List<ProductResponse> reorder(@PathVariable Long merchantId, @Valid @RequestBody ReorderProductsRequest request,
                                         Authentication auth) {
        return productService.reorderProducts(store(auth, merchantId), request.getProductIds());
    }

    @PatchMapping("/{productId}")
    public ProductResponse update(@PathVariable Long merchantId, @PathVariable Long productId,
                                  @Valid @RequestBody UpdateProductRequest request, Authentication auth) {
        return productService.updateProduct(store(auth, merchantId), productId, request);
    }

    @PatchMapping("/{productId}/deactivate")
    public ProductResponse deactivate(@PathVariable Long merchantId, @PathVariable Long productId, Authentication auth) {
        return productService.deactivateProduct(store(auth, merchantId), productId);
    }

    @PatchMapping("/{productId}/activate")
    public ProductResponse activate(@PathVariable Long merchantId, @PathVariable Long productId, Authentication auth) {
        return productService.activateProduct(store(auth, merchantId), productId);
    }

    @DeleteMapping("/{productId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long merchantId, @PathVariable Long productId, Authentication auth) {
        User admin = currentUserService.require(auth);
        Merchant merchant = storeAccessService.requireStoreForAdmin(admin, merchantId);
        ProductResponse product = productService.getProduct(merchant, productId); // 404 if not this store's
        productService.deleteProduct(merchant, productId);
        adminAuditService.record(admin, "DELETE_PRODUCT", "PRODUCT", productId,
                product.getName() + " @ " + merchant.getName());
    }
}
