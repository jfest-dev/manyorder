package com.manyorder.api.domain.merchant;

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

import com.manyorder.api.domain.category.CategoryResponse;
import com.manyorder.api.domain.category.CategoryService;
import com.manyorder.api.domain.category.CreateCategoryRequest;
import com.manyorder.api.domain.category.ReorderCategoriesRequest;
import com.manyorder.api.domain.category.UpdateCategoryRequest;
import com.manyorder.api.domain.user.User;
import com.manyorder.api.security.CurrentUserService;
import com.manyorder.api.security.StoreAccessService;

import jakarta.validation.Valid;

/** Staff may view categories; only the owner may create, edit, or delete them. */
@RestController
@RequestMapping("/merchant/stores/{storeId}/categories")
public class MerchantCategoryController {

    private final CategoryService categoryService;
    private final CurrentUserService currentUserService;
    private final StoreAccessService storeAccessService;

    public MerchantCategoryController(CategoryService categoryService,
                                      CurrentUserService currentUserService,
                                      StoreAccessService storeAccessService) {
        this.categoryService = categoryService;
        this.currentUserService = currentUserService;
        this.storeAccessService = storeAccessService;
    }

    @GetMapping
    public List<CategoryResponse> getCategories(@PathVariable Long storeId, Authentication authentication) {
        User user = currentUserService.require(authentication);
        Merchant merchant = storeAccessService.requireStoreMembership(user, storeId);
        return categoryService.getCategories(merchant);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CategoryResponse createCategory(@PathVariable Long storeId,
                                           @Valid @RequestBody CreateCategoryRequest request,
                                           Authentication authentication) {
        User user = currentUserService.require(authentication);
        Merchant merchant = storeAccessService.requireOwnedStore(user, storeId);
        return categoryService.createCategory(merchant, request);
    }

    @PatchMapping("/reorder")
    public List<CategoryResponse> reorderCategories(@PathVariable Long storeId,
                                                    @Valid @RequestBody ReorderCategoriesRequest request,
                                                    Authentication authentication) {
        User user = currentUserService.require(authentication);
        Merchant merchant = storeAccessService.requireOwnedStore(user, storeId);
        return categoryService.reorderCategories(merchant, request.getCategoryIds());
    }

    @PatchMapping("/{categoryId}")
    public CategoryResponse updateCategory(@PathVariable Long storeId,
                                           @PathVariable Long categoryId,
                                           @Valid @RequestBody UpdateCategoryRequest request,
                                           Authentication authentication) {
        User user = currentUserService.require(authentication);
        Merchant merchant = storeAccessService.requireOwnedStore(user, storeId);
        return categoryService.updateCategory(merchant, categoryId, request);
    }

    @DeleteMapping("/{categoryId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteCategory(@PathVariable Long storeId,
                               @PathVariable Long categoryId,
                               Authentication authentication) {
        User user = currentUserService.require(authentication);
        Merchant merchant = storeAccessService.requireOwnedStore(user, storeId);
        categoryService.deleteCategory(merchant, categoryId);
    }
}
