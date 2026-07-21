package com.manyorder.api.domain.merchant;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.manyorder.api.domain.product.CreateProductRequest;
import com.manyorder.api.domain.product.ProductResponse;
import com.manyorder.api.domain.product.ProductService;
import com.manyorder.api.domain.product.UpdateProductRequest;
import com.manyorder.api.domain.user.User;
import com.manyorder.api.security.CurrentUserService;
import com.manyorder.api.security.StoreAccessService;

import jakarta.validation.Valid;

/** Staff may view products; only the owner may create, edit, or deactivate them. */
@RestController
@RequestMapping("/merchant/stores/{storeId}/products")
public class MerchantProductController {

    private final ProductService productService;
    private final CurrentUserService currentUserService;
    private final StoreAccessService storeAccessService;

    public MerchantProductController(ProductService productService,
                                     CurrentUserService currentUserService,
                                     StoreAccessService storeAccessService) {
        this.productService = productService;
        this.currentUserService = currentUserService;
        this.storeAccessService = storeAccessService;
    }

    @GetMapping
    public List<ProductResponse> getProducts(
            @PathVariable Long storeId,
            @RequestParam(required = false, defaultValue = "false") Boolean activeOnly,
            Authentication authentication) {
        User user = currentUserService.require(authentication);
        Merchant merchant = storeAccessService.requireStoreMembership(user, storeId);

        return activeOnly
                ? productService.getActiveProducts(merchant)
                : productService.getProducts(merchant);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ProductResponse createProduct(@PathVariable Long storeId,
                                         @Valid @RequestBody CreateProductRequest request,
                                         Authentication authentication) {
        User user = currentUserService.require(authentication);
        Merchant merchant = storeAccessService.requireOwnedStore(user, storeId);
        return productService.createProduct(merchant, request);
    }

    @PatchMapping("/{productId}")
    public ProductResponse updateProduct(@PathVariable Long storeId,
                                         @PathVariable Long productId,
                                         @Valid @RequestBody UpdateProductRequest request,
                                         Authentication authentication) {
        User user = currentUserService.require(authentication);
        Merchant merchant = storeAccessService.requireOwnedStore(user, storeId);
        return productService.updateProduct(merchant, productId, request);
    }

    @PatchMapping("/{productId}/deactivate")
    public ProductResponse deactivateProduct(@PathVariable Long storeId,
                                             @PathVariable Long productId,
                                             Authentication authentication) {
        User user = currentUserService.require(authentication);
        Merchant merchant = storeAccessService.requireOwnedStore(user, storeId);
        return productService.deactivateProduct(merchant, productId);
    }
}
