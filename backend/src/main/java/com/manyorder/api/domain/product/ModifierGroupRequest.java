package com.manyorder.api.domain.product;

import java.math.BigDecimal;
import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.PositiveOrZero;

/**
 * A modifier group in a create/update product payload. The whole set is sent as
 * the desired state and replaces the product's existing groups on save.
 */
public class ModifierGroupRequest {

    /** Existing group id, so a save reconciles (updates in place) instead of
     *  recreating; null/unknown = a new group. */
    private Long id;

    @NotBlank
    private String name;

    @PositiveOrZero
    private int minSelect = 0;

    /** Null = unlimited. */
    private Integer maxSelect;

    private int sortOrder = 0;

    @Valid
    private List<ModifierOptionRequest> options;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public int getMinSelect() { return minSelect; }
    public void setMinSelect(int minSelect) { this.minSelect = minSelect; }
    public Integer getMaxSelect() { return maxSelect; }
    public void setMaxSelect(Integer maxSelect) { this.maxSelect = maxSelect; }
    public int getSortOrder() { return sortOrder; }
    public void setSortOrder(int sortOrder) { this.sortOrder = sortOrder; }
    public List<ModifierOptionRequest> getOptions() { return options; }
    public void setOptions(List<ModifierOptionRequest> options) { this.options = options; }

    public static class ModifierOptionRequest {
        /** Existing option id, so a save keeps its id stable (see the group id above). */
        private Long id;

        @NotBlank
        private String name;

        @PositiveOrZero
        private BigDecimal priceDelta = BigDecimal.ZERO;

        private int sortOrder = 0;

        public Long getId() { return id; }
        public void setId(Long id) { this.id = id; }
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public BigDecimal getPriceDelta() { return priceDelta; }
        public void setPriceDelta(BigDecimal priceDelta) { this.priceDelta = priceDelta; }
        public int getSortOrder() { return sortOrder; }
        public void setSortOrder(int sortOrder) { this.sortOrder = sortOrder; }
    }
}
