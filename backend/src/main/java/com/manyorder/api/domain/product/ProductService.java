package com.manyorder.api.domain.product;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.manyorder.api.domain.category.Category;
import com.manyorder.api.domain.category.CategoryRepository;
import com.manyorder.api.domain.merchant.Merchant;
import com.manyorder.api.domain.merchant.MerchantRepository;
import com.manyorder.api.domain.order.OrderItemRepository;
import com.manyorder.api.domain.order.OrderStatus;
import com.manyorder.api.domain.upload.CloudinaryImageService;

@Service
public class ProductService {

    /** An item counts as "sold" once its order is completed or delivered. */
    private static final List<OrderStatus> SOLD_STATUSES =
            List.of(OrderStatus.COMPLETED, OrderStatus.DELIVERED);

    private final ProductRepository productRepository;
    private final MerchantRepository merchantRepository;
    private final OrderItemRepository orderItemRepository;
    private final CategoryRepository categoryRepository;
    private final CloudinaryImageService imageService;

    public ProductService(ProductRepository productRepository,
                          MerchantRepository merchantRepository,
                          OrderItemRepository orderItemRepository,
                          CategoryRepository categoryRepository,
                          CloudinaryImageService imageService) {
        this.productRepository = productRepository;
        this.merchantRepository = merchantRepository;
        this.orderItemRepository = orderItemRepository;
        this.categoryRepository = categoryRepository;
        this.imageService = imageService;
    }

    // Reads are transactional so the lazy Category can be resolved while mapping
    // the response (the ProductResponse extracts categoryName to a plain String).
    @Transactional(readOnly = true)
    public List<ProductResponse> getProducts(Merchant merchant) {
        return withUnitsSold(merchant, productRepository.findByMerchant(merchant));
    }

    @Transactional(readOnly = true)
    public List<ProductResponse> getActiveProducts(Merchant merchant) {
        return withUnitsSold(merchant, productRepository.findByMerchantAndIsActiveTrue(merchant));
    }

    /** Public storefront path (no auth): id comes from the public URL. */
    @Transactional(readOnly = true)
    public List<ProductResponse> getActiveProductsByMerchantId(Long merchantId) {
        Merchant merchant = merchantRepository.findById(merchantId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Store not found"));
        return getActiveProducts(merchant);
    }

    @Transactional(readOnly = true)
    public ProductResponse getProduct(Merchant merchant, Long productId) {
        return toResponse(requireStoreProduct(merchant, productId));
    }

    @Transactional
    public ProductResponse createProduct(Merchant merchant, CreateProductRequest request) {
        Product product = new Product(
                merchant,
                request.getName(),
                request.getDescription(),
                request.getPrice());
        product.setCategory(resolveCategory(merchant, request.getCategoryId()));
        product.setStock(request.getStock() != null ? request.getStock() : 0);
        product.setSku(request.getSku());
        product.setPhotoUrl(isBlank(request.getPhotoUrl()) ? null : request.getPhotoUrl());
        product.setPreOrder(request.isPreOrder());
        product.setPreOrderReadyDate(request.getPreOrderReadyDate());
        product.setPreOrderNote(request.getPreOrderNote());
        return toResponse(productRepository.save(product));
    }

    @Transactional
    public ProductResponse updateProduct(Merchant merchant, Long productId, UpdateProductRequest request) {
        Product product = requireStoreProduct(merchant, productId);

        if (request.getName() != null && !request.getName().isBlank()) {
            product.setName(request.getName());
        }
        if (request.getDescription() != null) product.setDescription(request.getDescription());
        if (request.getPrice() != null) product.setPrice(request.getPrice());
        // Category sentinel: null = unchanged, 0 = clear to none, >0 = set.
        if (request.getCategoryId() != null) {
            product.setCategory(request.getCategoryId() == 0L
                    ? null
                    : resolveCategory(merchant, request.getCategoryId()));
        }
        if (request.getStock() != null) product.setStock(request.getStock());
        if (request.getSku() != null) product.setSku(request.getSku());
        if (request.getPreOrder() != null) product.setPreOrder(request.getPreOrder());
        if (request.getPreOrderReadyDate() != null) product.setPreOrderReadyDate(request.getPreOrderReadyDate());
        if (request.getPreOrderNote() != null) product.setPreOrderNote(request.getPreOrderNote());

        // Photo: empty string clears, null leaves unchanged. Remember the old URL
        // to delete after commit when it's replaced or removed (mirrors the logo).
        String orphanedPhoto = null;
        if (request.getPhotoUrl() != null) {
            String newPhoto = request.getPhotoUrl().isBlank() ? null : request.getPhotoUrl();
            String oldPhoto = product.getPhotoUrl();
            if (!Objects.equals(newPhoto, oldPhoto)) {
                product.setPhotoUrl(newPhoto);
                orphanedPhoto = oldPhoto;
            }
        }

        productRepository.save(product);
        if (!isBlank(orphanedPhoto)) {
            imageService.deleteByUrl(orphanedPhoto);
        }
        return toResponse(product);
    }

    @Transactional
    public ProductResponse deactivateProduct(Merchant merchant, Long productId) {
        Product product = requireStoreProduct(merchant, productId);
        product.setIsActive(false);
        return toResponse(productRepository.save(product));
    }

    /** Resolve a product owned by this store, or 404. Used by the photo endpoint. */
    public Product requireOwnedProduct(Merchant merchant, Long productId) {
        return requireStoreProduct(merchant, productId);
    }

    private Product requireStoreProduct(Merchant merchant, Long productId) {
        return productRepository.findByMerchantAndId(merchant, productId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Product not found"));
    }

    /** null/0 -> no category; a positive id must reference a category in this store. */
    private Category resolveCategory(Merchant merchant, Long categoryId) {
        if (categoryId == null || categoryId == 0L) return null;
        return categoryRepository.findByMerchantAndId(merchant, categoryId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Category does not belong to this store"));
    }

    /** Map a product list to responses, folding in units-sold with a single query. */
    private List<ProductResponse> withUnitsSold(Merchant merchant, List<Product> products) {
        Map<Long, Long> sold = soldByProductId(merchant);
        return products.stream()
                .map(p -> new ProductResponse(p, sold.getOrDefault(p.getId(), 0L)))
                .toList();
    }

    private Map<Long, Long> soldByProductId(Merchant merchant) {
        Map<Long, Long> map = new HashMap<>();
        for (Object[] row : orderItemRepository.sumSoldByMerchant(merchant, SOLD_STATUSES)) {
            map.put((Long) row[0], ((Number) row[1]).longValue());
        }
        return map;
    }

    /** Single-product response (units-sold via one focused query). */
    private ProductResponse toResponse(Product product) {
        long unitsSold = orderItemRepository.sumSoldForProduct(product, SOLD_STATUSES);
        return new ProductResponse(product, unitsSold);
    }

    private static boolean isBlank(String s) {
        return s == null || s.trim().isEmpty();
    }
}
