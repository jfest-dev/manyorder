package com.manyorder.api.domain.category;

import jakarta.validation.constraints.NotBlank;

public class CreateCategoryRequest {

    @NotBlank
    private String name;

    private String color;
    private Integer displayOrder;

    public CreateCategoryRequest() {}

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getColor() { return color; }
    public void setColor(String color) { this.color = color; }
    public Integer getDisplayOrder() { return displayOrder; }
    public void setDisplayOrder(Integer displayOrder) { this.displayOrder = displayOrder; }
}
