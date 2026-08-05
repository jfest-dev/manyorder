package com.manyorder.api.domain.category;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.manyorder.api.domain.merchant.Merchant;
import com.manyorder.api.domain.product.ProductRepository;

@Service
public class CategoryService {

    private final CategoryRepository categoryRepository;
    private final ProductRepository productRepository;

    public CategoryService(CategoryRepository categoryRepository, ProductRepository productRepository) {
        this.categoryRepository = categoryRepository;
        this.productRepository = productRepository;
    }

    @Transactional(readOnly = true)
    public List<CategoryResponse> getCategories(Merchant merchant) {
        Map<Long, Long> counts = productCounts(merchant);
        return categoryRepository.findByMerchantOrderByDisplayOrderAscNameAsc(merchant)
                .stream()
                .map(c -> new CategoryResponse(c, counts.getOrDefault(c.getId(), 0L)))
                .toList();
    }

    @Transactional
    public CategoryResponse createCategory(Merchant merchant, CreateCategoryRequest request) {
        String name = request.getName().trim();
        if (categoryRepository.existsByMerchantAndNameIgnoreCase(merchant, name)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "A category with that name already exists.");
        }
        Category category = new Category(merchant, name, request.getColor(), request.getDisplayOrder());
        return new CategoryResponse(categoryRepository.save(category), 0);
    }

    @Transactional
    public CategoryResponse updateCategory(Merchant merchant, Long categoryId, UpdateCategoryRequest request) {
        Category category = requireOwned(merchant, categoryId);
        if (request.getName() != null && !request.getName().isBlank()) {
            String name = request.getName().trim();
            if (!name.equalsIgnoreCase(category.getName())
                    && categoryRepository.existsByMerchantAndNameIgnoreCase(merchant, name)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "A category with that name already exists.");
            }
            category.setName(name);
        }
        if (request.getColor() != null) category.setColor(request.getColor());
        if (request.getDisplayOrder() != null) category.setDisplayOrder(request.getDisplayOrder());
        categoryRepository.save(category);
        long count = productCounts(merchant).getOrDefault(category.getId(), 0L);
        return new CategoryResponse(category, count);
    }

    /** Delete a category; its products are uncategorized (category set to null). */
    @Transactional
    public void deleteCategory(Merchant merchant, Long categoryId) {
        Category category = requireOwned(merchant, categoryId);
        productRepository.clearCategory(category);
        categoryRepository.delete(category);
    }

    private Category requireOwned(Merchant merchant, Long categoryId) {
        return categoryRepository.findByMerchantAndId(merchant, categoryId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Category not found"));
    }

    private Map<Long, Long> productCounts(Merchant merchant) {
        Map<Long, Long> map = new HashMap<>();
        for (Object[] row : productRepository.countByCategory(merchant)) {
            map.put((Long) row[0], ((Number) row[1]).longValue());
        }
        return map;
    }
}
