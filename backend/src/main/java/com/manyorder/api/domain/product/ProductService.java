package com.manyorder.api.domain.product;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.manyorder.api.domain.merchant.Merchant;
import com.manyorder.api.domain.merchant.MerchantRepository;

@Service
public class ProductService {

    private final ProductRepository productRepository;
    private final MerchantRepository merchantRepository;

    public ProductService(ProductRepository productRepository, MerchantRepository merchantRepository) {
        this.productRepository = productRepository;
        this.merchantRepository = merchantRepository;
    }

    public List<ProductResponse> getProducts(Merchant merchant) {
        return productRepository.findByMerchant(merchant)
                .stream().map(this::toResponse).toList();
    }

    public List<ProductResponse> getActiveProducts(Merchant merchant) {
        return productRepository.findByMerchantAndIsActiveTrue(merchant)
                .stream().map(this::toResponse).toList();
    }

    /** Public storefront path (no auth): id comes from the public URL. */
    public List<ProductResponse> getActiveProductsByMerchantId(Long merchantId) {
        Merchant merchant = merchantRepository.findById(merchantId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Store not found"));
        return getActiveProducts(merchant);
    }

    @Transactional
    public ProductResponse createProduct(Merchant merchant, CreateProductRequest request) {
        Product product = new Product(
                merchant,
                request.getName(),
                request.getDescription(),
                request.getPrice());
        return toResponse(productRepository.save(product));
    }

    @Transactional
    public ProductResponse updateProduct(Merchant merchant, Long productId, UpdateProductRequest request) {
        Product product = requireStoreProduct(merchant, productId);

        if (request.getName() != null && !request.getName().isBlank()) {
            product.setName(request.getName());
        }
        if (request.getDescription() != null) {
            product.setDescription(request.getDescription());
        }
        if (request.getPrice() != null) {
            product.setPrice(request.getPrice());
        }
        return toResponse(productRepository.save(product));
    }

    @Transactional
    public ProductResponse deactivateProduct(Merchant merchant, Long productId) {
        Product product = requireStoreProduct(merchant, productId);
        product.setIsActive(false);
        return toResponse(productRepository.save(product));
    }

    private Product requireStoreProduct(Merchant merchant, Long productId) {
        return productRepository.findByMerchantAndId(merchant, productId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Product not found"));
    }

    private ProductResponse toResponse(Product product) {
        return new ProductResponse(
                product.getId(),
                product.getMerchant().getId(),
                product.getName(),
                product.getDescription(),
                product.getPrice(),
                product.getIsActive(),
                product.getCreatedAt());
    }
}
