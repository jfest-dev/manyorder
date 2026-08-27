package com.manyorder.api.domain.product;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import java.time.LocalDate;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.manyorder.api.common.MoneyValidation;
import com.manyorder.api.domain.category.Category;
import com.manyorder.api.domain.category.CategoryRepository;
import com.manyorder.api.domain.merchant.Merchant;
import com.manyorder.api.domain.merchant.MerchantRepository;
import com.manyorder.api.domain.order.OrderItemRepository;
import com.manyorder.api.domain.order.OrderSource;
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
        return withUnitsSold(merchant, productRepository.findByMerchantOrderByDisplayOrderAscIdAsc(merchant));
    }

    @Transactional(readOnly = true)
    public List<ProductResponse> getActiveProducts(Merchant merchant) {
        return withUnitsSold(merchant, productRepository.findByMerchantAndIsActiveTrueOrderByDisplayOrderAscIdAsc(merchant));
    }

    /**
     * Public storefront path (no auth): id comes from the public URL. Public
     * "sold" counts include STOREFRONT orders only, so a merchant can't inflate
     * the numbers with manual dashboard orders. The merchant's own list keeps
     * counting all sources (see {@link #withUnitsSold}).
     */
    @Transactional(readOnly = true)
    public List<ProductResponse> getActiveProductsByMerchantId(Long merchantId) {
        Merchant merchant = merchantRepository.findById(merchantId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Store not found"));
        return withStorefrontUnitsSold(merchant, productRepository.findByMerchantAndIsActiveTrueOrderByDisplayOrderAscIdAsc(merchant));
    }

    @Transactional(readOnly = true)
    public ProductResponse getProduct(Merchant merchant, Long productId) {
        return toResponse(requireStoreProduct(merchant, productId));
    }

    @Transactional
    public ProductResponse createProduct(Merchant merchant, CreateProductRequest request) {
        MoneyValidation.requireValidScale(request.getPrice(), merchant.getCurrency(), "Price");
        Product product = new Product(
                merchant,
                request.getName(),
                request.getDescription(),
                request.getPrice());
        product.setCategory(resolveCategory(merchant, request.getCategoryId()));
        product.setStock(request.getStock() != null ? request.getStock() : 0);
        product.setDisplayOrder(nextDisplayOrder(merchant)); // append to the end of the list
        product.setSku(request.getSku());
        product.setPhotoUrl(isBlank(request.getPhotoUrl()) ? null : request.getPhotoUrl());
        requireValidPreOrderDate(request.isPreOrder(), request.getPreOrderReadyDate());
        product.setPreOrder(request.isPreOrder());
        product.setPreOrderReadyDate(request.getPreOrderReadyDate());
        product.setPreOrderReadyTimeStart(request.getPreOrderReadyTimeStart());
        product.setPreOrderReadyTimeEnd(request.getPreOrderReadyTimeEnd());
        product.setPreOrderNote(request.getPreOrderNote());
        // A new product always takes the sent modifier set (empty when omitted).
        applyModifierGroups(product, request.getModifierGroups(), merchant.getCurrency());
        return toResponse(productRepository.save(product));
    }

    /**
     * Persist a new order for the merchant's products. Every id must belong to the
     * merchant; displayOrder is set to each id's position in the list.
     */
    @Transactional
    public List<ProductResponse> reorderProducts(Merchant merchant, List<Long> productIds) {
        int i = 0;
        for (Long id : productIds) {
            requireStoreProduct(merchant, id).setDisplayOrder(i++);
        }
        return getProducts(merchant);
    }

    @Transactional
    public ProductResponse updateProduct(Merchant merchant, Long productId, UpdateProductRequest request) {
        Product product = requireStoreProduct(merchant, productId);

        if (request.getName() != null && !request.getName().isBlank()) {
            product.setName(request.getName());
        }
        if (request.getDescription() != null) product.setDescription(request.getDescription());
        if (request.getPrice() != null) {
            MoneyValidation.requireValidScale(request.getPrice(), merchant.getCurrency(), "Price");
            product.setPrice(request.getPrice());
        }
        // Category sentinel: null = unchanged, 0 = clear to none, >0 = set.
        if (request.getCategoryId() != null) {
            product.setCategory(request.getCategoryId() == 0L
                    ? null
                    : resolveCategory(merchant, request.getCategoryId()));
        }
        if (request.getStock() != null) product.setStock(request.getStock());
        if (request.getSku() != null) product.setSku(request.getSku());

        // The pre-order schedule is owned by the preOrder flag, so it's applied
        // as a unit: when the request carries the flag (the edit form always
        // sends it, alongside every sub-field), the date/time/note are set
        // ABSOLUTELY — a null/omitted sub-field clears it, instead of the old
        // "null = leave unchanged" that made a cleared time impossible to save.
        // Turning pre-order off wipes the schedule so no stale ready-info lingers.
        // A partial PATCH that omits preOrder (e.g. the photo-only save) leaves
        // all of this untouched.
        if (request.getPreOrder() != null) {
            boolean preOrder = request.getPreOrder();
            requireValidPreOrderDate(preOrder, request.getPreOrderReadyDate());
            product.setPreOrder(preOrder);
            if (preOrder) {
                product.setPreOrderReadyDate(request.getPreOrderReadyDate());
                product.setPreOrderReadyTimeStart(request.getPreOrderReadyTimeStart());
                product.setPreOrderReadyTimeEnd(request.getPreOrderReadyTimeEnd());
                product.setPreOrderNote(request.getPreOrderNote());
            } else {
                product.setPreOrderReadyDate(null);
                product.setPreOrderReadyTimeStart(null);
                product.setPreOrderReadyTimeEnd(null);
                product.setPreOrderNote(null);
            }
        }

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

        // Modifiers: null = leave unchanged, non-null = replace the whole set.
        if (request.getModifierGroups() != null) {
            applyModifierGroups(product, request.getModifierGroups(), merchant.getCurrency());
        }

        productRepository.save(product);
        if (!isBlank(orphanedPhoto)) {
            imageService.deleteByUrl(orphanedPhoto);
        }
        return toResponse(product);
    }

    /**
     * Reconciles the product's modifier groups/options against the request,
     * preserving the ids of groups and options that still exist (matched by the
     * id the client sends back) instead of deleting and recreating them. This
     * keeps option ids STABLE across an edit or reorder, so a customer's cart
     * line that references an option id isn't orphaned by a merchant save (and
     * historical OrderItemModifier.sourceOptionId stays valid). Groups/options
     * absent from the request are removed (orphanRemoval cascades the delete);
     * ones with no/unknown id are created. Validates min/max sanity + price scale.
     */
    private void applyModifierGroups(Product product, List<ModifierGroupRequest> groupRequests, String currency) {
        List<ModifierGroup> groups = product.getModifierGroups(); // managed, mutable
        Map<Long, ModifierGroup> existingById = new HashMap<>();
        for (ModifierGroup g : groups) {
            if (g.getId() != null) existingById.put(g.getId(), g);
        }

        List<ModifierGroup> keep = new ArrayList<>();
        int groupOrder = 0;
        for (ModifierGroupRequest gr : groupRequests != null ? groupRequests : List.<ModifierGroupRequest>of()) {
            List<ModifierGroupRequest.ModifierOptionRequest> optionRequests =
                    gr.getOptions() != null ? gr.getOptions() : List.of();
            if (gr.getMaxSelect() != null && (gr.getMaxSelect() < 1 || gr.getMaxSelect() < gr.getMinSelect())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "\"" + gr.getName() + "\": max selectable must be at least 1 and no less than min.");
            }
            if (gr.getMinSelect() > optionRequests.size()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "\"" + gr.getName() + "\": needs at least " + gr.getMinSelect() + " option(s) to require that many.");
            }

            // Reuse the existing group when the client sends a matching id, else create one.
            ModifierGroup group = gr.getId() != null ? existingById.get(gr.getId()) : null;
            if (group != null) {
                group.setName(gr.getName().trim());
                group.setMinSelect(gr.getMinSelect());
                group.setMaxSelect(gr.getMaxSelect());
                group.setSortOrder(groupOrder);
            } else {
                group = new ModifierGroup(product, gr.getName().trim(), gr.getMinSelect(), gr.getMaxSelect(), groupOrder);
                groups.add(group);
            }
            groupOrder++;
            reconcileOptions(group, optionRequests, currency);
            keep.add(group);
        }

        // Delete groups no longer present (orphanRemoval cascades to their options).
        groups.removeIf(g -> !keep.contains(g));
        // Keep the in-memory order consistent with sortOrder so the response built
        // this same transaction matches what a fresh @OrderBy load would return.
        groups.sort(Comparator.comparingInt(ModifierGroup::getSortOrder));
    }

    /** Reconcile one group's options in place, preserving ids matched by the client. */
    private void reconcileOptions(ModifierGroup group,
                                  List<ModifierGroupRequest.ModifierOptionRequest> optionRequests, String currency) {
        List<ModifierOption> options = group.getOptions(); // managed, mutable
        Map<Long, ModifierOption> existingById = new HashMap<>();
        for (ModifierOption o : options) {
            if (o.getId() != null) existingById.put(o.getId(), o);
        }

        List<ModifierOption> keep = new ArrayList<>();
        int optionOrder = 0;
        for (ModifierGroupRequest.ModifierOptionRequest or : optionRequests) {
            BigDecimal delta = or.getPriceDelta() != null ? or.getPriceDelta() : BigDecimal.ZERO;
            MoneyValidation.requireValidScale(delta, currency, "Modifier price");
            // Match only within THIS group's options, so a foreign id can't be adopted.
            ModifierOption option = or.getId() != null ? existingById.get(or.getId()) : null;
            if (option != null) {
                option.setName(or.getName().trim());
                option.setPriceDelta(delta);
                option.setSortOrder(optionOrder);
            } else {
                option = new ModifierOption(group, or.getName().trim(), delta, optionOrder);
                options.add(option);
            }
            optionOrder++;
            keep.add(option);
        }

        options.removeIf(o -> !keep.contains(o));
        options.sort(Comparator.comparingInt(ModifierOption::getSortOrder));
    }

    @Transactional
    public ProductResponse deactivateProduct(Merchant merchant, Long productId) {
        Product product = requireStoreProduct(merchant, productId);
        product.setIsActive(false);
        return toResponse(productRepository.save(product));
    }

    /**
     * Permanently delete a product. Past order lines are detached (their name and
     * price are snapshotted on the line, so order history survives); the product
     * and its owned modifier groups are removed; and the hosted photo is deleted
     * so it is not orphaned.
     */
    @Transactional
    public void deleteProduct(Merchant merchant, Long productId) {
        Product product = requireStoreProduct(merchant, productId);
        String orphanedPhoto = product.getPhotoUrl();
        orderItemRepository.detachProduct(product); // null out product_id on any order lines
        productRepository.delete(product);          // cascades its modifier groups/options
        if (orphanedPhoto != null && !orphanedPhoto.isBlank()) {
            imageService.deleteByUrl(orphanedPhoto);
        }
    }

    /** Resolve a product owned by this store, or 404. Used by the photo endpoint. */
    public Product requireOwnedProduct(Merchant merchant, Long productId) {
        return requireStoreProduct(merchant, productId);
    }

    private Product requireStoreProduct(Merchant merchant, Long productId) {
        return productRepository.findByMerchantAndId(merchant, productId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Product not found"));
    }

    /** A pre-order's ready date must be today or later; same-day is allowed. */
    private void requireValidPreOrderDate(boolean preOrder, LocalDate readyDate) {
        if (preOrder && readyDate != null && readyDate.isBefore(LocalDate.now())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Pre-order ready date can't be in the past.");
        }
    }

    /** One past the current highest displayOrder, so a new product appends to the end. */
    private int nextDisplayOrder(Merchant merchant) {
        return productRepository.findByMerchantOrderByDisplayOrderAscIdAsc(merchant).stream()
                .map(Product::getDisplayOrder)
                .filter(java.util.Objects::nonNull)
                .mapToInt(Integer::intValue)
                .max()
                .orElse(-1) + 1;
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

    /** Public variant: fold in units-sold counting STOREFRONT orders only. */
    private List<ProductResponse> withStorefrontUnitsSold(Merchant merchant, List<Product> products) {
        Map<Long, Long> sold = new HashMap<>();
        for (Object[] row : orderItemRepository.sumSoldByMerchantAndSource(merchant, SOLD_STATUSES, OrderSource.STOREFRONT)) {
            sold.put((Long) row[0], ((Number) row[1]).longValue());
        }
        return products.stream()
                .map(p -> new ProductResponse(p, sold.getOrDefault(p.getId(), 0L)))
                .toList();
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
