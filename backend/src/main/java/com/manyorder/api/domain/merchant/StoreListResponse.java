package com.manyorder.api.domain.merchant;

import java.util.List;

public class StoreListResponse {

    private List<StoreResponse> stores;
    private int count;
    private int limit;

    public StoreListResponse(List<StoreResponse> stores, int limit) {
        this.stores = stores;
        this.count = stores.size();
        this.limit = limit;
    }

    public List<StoreResponse> getStores() { return stores; }
    public int getCount() { return count; }
    public int getLimit() { return limit; }
}
