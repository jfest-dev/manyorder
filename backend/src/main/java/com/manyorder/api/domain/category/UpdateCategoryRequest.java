package com.manyorder.api.domain.category;

/** PATCH semantics: null fields are left unchanged. */
public class UpdateCategoryRequest {

    private String name;
    private String color;
    private Integer displayOrder;

    public UpdateCategoryRequest() {}

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getColor() { return color; }
    public void setColor(String color) { this.color = color; }
    public Integer getDisplayOrder() { return displayOrder; }
    public void setDisplayOrder(Integer displayOrder) { this.displayOrder = displayOrder; }
}
