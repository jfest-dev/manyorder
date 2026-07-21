package com.manyorder.api.security;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import com.manyorder.api.domain.merchant.Merchant;
import com.manyorder.api.domain.merchant.MerchantRepository;
import com.manyorder.api.domain.user.User;
import com.manyorder.api.domain.user.UserRole;

/**
 * The single gate for store-scoped access. Every /merchant endpoint resolves
 * its Merchant through one of these methods — never through a client-supplied
 * merchantId that is trusted blindly. Missing OR foreign stores both return
 * 404 so callers cannot probe which store IDs exist.
 */
@Service
public class StoreAccessService {

    private final MerchantRepository merchantRepository;

    public StoreAccessService(MerchantRepository merchantRepository) {
        this.merchantRepository = merchantRepository;
    }

    /** MERCHANT-only actions on a store they own (create orders, manage products, settings...). */
    public Merchant requireOwnedStore(User user, Long storeId) {
        if (user.getRole() != UserRole.MERCHANT) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Merchant role required");
        }
        Merchant merchant = merchantRepository.findById(storeId)
                .orElseThrow(this::notFound);
        if (!merchant.getOwner().getId().equals(user.getId())) {
            throw notFound();
        }
        return merchant;
    }

    /** Owner OR assigned staff: read orders/products, update order + payment status. */
    public Merchant requireStoreMembership(User user, Long storeId) {
        if (user.getRole() == UserRole.MERCHANT) {
            return requireOwnedStore(user, storeId);
        }
        if (user.getRole() == UserRole.STAFF) {
            Merchant staffStore = user.getStaffStore();
            if (staffStore == null || !staffStore.getId().equals(storeId)) {
                throw notFound();
            }
            return merchantRepository.findById(storeId).orElseThrow(this::notFound);
        }
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not a store member");
    }

    private ResponseStatusException notFound() {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "Store not found");
    }
}
