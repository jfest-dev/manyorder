package com.manyorder.api.domain.category;

import java.util.List;

import jakarta.validation.constraints.NotEmpty;

/** The desired category order, as the full list of category ids top-to-bottom. */
public class ReorderCategoriesRequest {

    @NotEmpty
    private List<Long> categoryIds;

    public ReorderCategoriesRequest() {}

    public List<Long> getCategoryIds() { return categoryIds; }
    public void setCategoryIds(List<Long> categoryIds) { this.categoryIds = categoryIds; }
}
