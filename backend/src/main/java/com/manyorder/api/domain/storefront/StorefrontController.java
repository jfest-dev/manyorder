package com.manyorder.api.domain.storefront;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.manyorder.api.domain.merchant.Merchant;
import com.manyorder.api.domain.merchant.MerchantRepository;
import com.manyorder.api.domain.product.ProductResponse;
import com.manyorder.api.domain.product.ProductService;

@RestController
@RequestMapping("/public")
public class StorefrontController {

    private final ProductService productService;
    private final MerchantRepository merchantRepository;

    public StorefrontController(ProductService productService,
                                MerchantRepository merchantRepository) {
        this.productService = productService;
        this.merchantRepository = merchantRepository;
    }

    /** Public store lookup by slug — powers the storefront and Sign In to Store branding. */
    @GetMapping("/stores/{slug}")
    public PublicStoreResponse getStoreBySlug(@PathVariable String slug) {
        Merchant merchant = merchantRepository.findBySlug(slug.toLowerCase())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Store not found"));
        return new PublicStoreResponse(merchant);
    }

    @GetMapping("/storefront/{merchantId}/products")
    public List<ProductResponse> getActiveProducts(@PathVariable Long merchantId) {
        return productService.getActiveProductsByMerchantId(merchantId);
    }
}
