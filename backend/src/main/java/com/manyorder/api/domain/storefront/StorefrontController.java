package com.manyorder.api.domain.storefront;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.manyorder.api.domain.discount.DiscountService;
import com.manyorder.api.domain.discount.PublicOfferResponse;
import com.manyorder.api.domain.merchant.Merchant;
import com.manyorder.api.domain.merchant.MerchantRepository;
import com.manyorder.api.domain.order.OrderItemRepository;
import com.manyorder.api.domain.order.OrderSource;
import com.manyorder.api.domain.order.OrderStatus;
import com.manyorder.api.domain.product.ProductResponse;
import com.manyorder.api.domain.product.ProductService;

@RestController
@RequestMapping("/public")
public class StorefrontController {

    /** An item counts as "sold" once its order is completed or delivered (matches ProductService). */
    private static final List<OrderStatus> SOLD_STATUSES =
            List.of(OrderStatus.COMPLETED, OrderStatus.DELIVERED);

    private final ProductService productService;
    private final MerchantRepository merchantRepository;
    private final OrderItemRepository orderItemRepository;
    private final DiscountService discountService;

    public StorefrontController(ProductService productService,
                                MerchantRepository merchantRepository,
                                OrderItemRepository orderItemRepository,
                                DiscountService discountService) {
        this.productService = productService;
        this.merchantRepository = merchantRepository;
        this.orderItemRepository = orderItemRepository;
        this.discountService = discountService;
    }

    /** Public store lookup by slug — powers the storefront and Sign In to Store branding. */
    @GetMapping("/stores/{slug}")
    public PublicStoreResponse getStoreBySlug(@PathVariable String slug) {
        Merchant merchant = merchantRepository.findBySlugAndArchivedAtIsNull(slug.toLowerCase())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Store not found"));
        // Public "sold" tally counts STOREFRONT orders only (manual dashboard
        // orders don't inflate the number a customer sees).
        long totalItemsSold = orderItemRepository.sumAllSoldByMerchantAndSource(
                merchant, SOLD_STATUSES, OrderSource.STOREFRONT);
        return new PublicStoreResponse(merchant, totalItemsSold);
    }

    @GetMapping("/storefront/{merchantId}/products")
    public List<ProductResponse> getActiveProducts(@PathVariable Long merchantId) {
        return productService.getActiveProductsByMerchantId(merchantId);
    }

    /** Public, one-tap-applicable offers for a store. Only discounts the merchant
     *  marked public and that are currently live; private codes never appear. */
    @GetMapping("/storefront/{merchantId}/offers")
    public List<PublicOfferResponse> getPublicOffers(@PathVariable Long merchantId) {
        Merchant merchant = merchantRepository.findById(merchantId)
                .filter(m -> !m.isArchived())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Store not found"));
        return discountService.listPublicOffers(merchant);
    }
}
