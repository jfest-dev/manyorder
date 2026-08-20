package com.manyorder.api.domain.product;

import java.util.ArrayList;
import java.util.List;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;

/**
 * A named set of choices attached to a product (e.g. "Sauce Selection"), with
 * min/max selectable bounds. "Required" is simply {@code minSelect >= 1};
 * "choose one" is {@code maxSelect == 1}. Options are owned by the group and
 * cascade with it so a product save can replace the whole set.
 */
@Entity
@Table(name = "modifier_groups")
public class ModifierGroup {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @Column(nullable = false)
    private String name;

    /** Minimum options that must be chosen. 0 = optional; >= 1 = required. */
    @Column(nullable = false, columnDefinition = "integer default 0 not null")
    private int minSelect = 0;

    /** Maximum options that may be chosen. Null = unlimited. */
    private Integer maxSelect;

    @Column(nullable = false, columnDefinition = "integer default 0 not null")
    private int sortOrder = 0;

    @OneToMany(mappedBy = "group", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("sortOrder ASC")
    private List<ModifierOption> options = new ArrayList<>();

    protected ModifierGroup() { /* JPA */ }

    public ModifierGroup(Product product, String name, int minSelect, Integer maxSelect, int sortOrder) {
        this.product = product;
        this.name = name;
        this.minSelect = minSelect;
        this.maxSelect = maxSelect;
        this.sortOrder = sortOrder;
    }

    public void addOption(ModifierOption option) { options.add(option); }

    public boolean isRequired() { return minSelect >= 1; }

    public Long getId() { return id; }
    public Product getProduct() { return product; }
    public String getName() { return name; }
    public int getMinSelect() { return minSelect; }
    public Integer getMaxSelect() { return maxSelect; }
    public int getSortOrder() { return sortOrder; }
    public List<ModifierOption> getOptions() { return options; }
}
