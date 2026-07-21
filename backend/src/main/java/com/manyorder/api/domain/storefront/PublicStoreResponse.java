package com.manyorder.api.domain.storefront;

import com.manyorder.api.domain.merchant.Merchant;

/** Safe public projection of a store for the storefront + Sign In to Store branding. */
public class PublicStoreResponse {

    private Long id;
    private String name;
    private String slug;
    private String storeDescription;
    private String currency;
    private String themeColor;

    public PublicStoreResponse(Merchant m) {
        this.id = m.getId();
        this.name = m.getName();
        this.slug = m.getSlug();
        this.storeDescription = m.getStoreDescription();
        this.currency = m.getCurrency();
        this.themeColor = m.getThemeColor();
    }

    public Long getId() { return id; }
    public String getName() { return name; }
    public String getSlug() { return slug; }
    public String getStoreDescription() { return storeDescription; }
    public String getCurrency() { return currency; }
    public String getThemeColor() { return themeColor; }
}
