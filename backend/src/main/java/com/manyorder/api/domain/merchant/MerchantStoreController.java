package com.manyorder.api.domain.merchant;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.manyorder.api.domain.user.User;
import com.manyorder.api.domain.user.UserRole;
import com.manyorder.api.security.CurrentUserService;
import com.manyorder.api.security.StoreAccessService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/merchant/stores")
public class MerchantStoreController {

    private final MerchantRepository merchantRepository;
    private final CurrentUserService currentUserService;
    private final StoreAccessService storeAccessService;

    public MerchantStoreController(MerchantRepository merchantRepository,
                                   CurrentUserService currentUserService,
                                   StoreAccessService storeAccessService) {
        this.merchantRepository = merchantRepository;
        this.currentUserService = currentUserService;
        this.storeAccessService = storeAccessService;
    }

    /** Store management is owner-only; a STAFF account gets its store from the login response. */
    @GetMapping
    public StoreListResponse myStores(Authentication authentication) {
        User user = requireMerchant(authentication);
        List<StoreResponse> stores = merchantRepository.findByOwnerOrderByCreatedAtAsc(user)
                .stream()
                .map(StoreResponse::new)
                .toList();
        return new StoreListResponse(stores, Merchant.MAX_STORES_PER_OWNER);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public StoreResponse createStore(@Valid @RequestBody CreateStoreRequest request,
                                     Authentication authentication) {
        User user = requireMerchant(authentication);

        long owned = merchantRepository.countByOwner(user);
        if (owned >= Merchant.MAX_STORES_PER_OWNER) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Store limit reached (" + Merchant.MAX_STORES_PER_OWNER + " of "
                            + Merchant.MAX_STORES_PER_OWNER + ")");
        }

        String slug = resolveSlug(request.getSlug(), request.getStoreName());

        Merchant merchant = new Merchant(user, request.getStoreName().trim(), slug,
                request.getStoreEmail(), request.getStorePhone());
        merchant.setBusinessType(request.getBusinessType());
        merchant.setCurrency(normalizeCurrency(request.getCurrency()));
        merchant.setThemeColor(request.getThemeColor());
        merchant.setStoreDescription(request.getStoreDescription());
        merchant.setPaymentInstruction(request.getPaymentInstruction());

        merchantRepository.save(merchant);
        return new StoreResponse(merchant);
    }

    /** Store settings (Module 11). Owner only; slug changes re-checked for uniqueness. */
    @PatchMapping("/{storeId}")
    public StoreResponse updateStore(@PathVariable Long storeId,
                                     @Valid @RequestBody UpdateStoreRequest request,
                                     Authentication authentication) {
        User user = requireMerchant(authentication);
        Merchant merchant = storeAccessService.requireOwnedStore(user, storeId);

        if (request.getStoreName() != null && !request.getStoreName().isBlank()) {
            merchant.setName(request.getStoreName().trim());
        }
        if (request.getSlug() != null && !request.getSlug().isBlank()) {
            String slug = request.getSlug().trim().toLowerCase();
            if (!slug.equals(merchant.getSlug()) && merchantRepository.existsBySlug(slug)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "Store link already taken. Please choose another.");
            }
            merchant.setSlug(slug);
        }
        if (request.getStoreEmail() != null) merchant.setEmail(request.getStoreEmail());
        if (request.getStorePhone() != null) merchant.setPhoneNumber(request.getStorePhone());
        if (request.getBusinessType() != null) merchant.setBusinessType(request.getBusinessType());
        if (request.getCurrency() != null) merchant.setCurrency(normalizeCurrency(request.getCurrency()));
        if (request.getThemeColor() != null) merchant.setThemeColor(request.getThemeColor());
        if (request.getStoreDescription() != null) merchant.setStoreDescription(request.getStoreDescription());
        if (request.getPaymentInstruction() != null) merchant.setPaymentInstruction(request.getPaymentInstruction());
        if (request.getStreetAddress() != null) merchant.setStreetAddress(request.getStreetAddress());
        if (request.getCity() != null) merchant.setCity(request.getCity());
        if (request.getPostalCode() != null) merchant.setPostalCode(request.getPostalCode());
        if (request.getNotifyNewOrderEmail() != null) merchant.setNotifyNewOrderEmail(request.getNotifyNewOrderEmail());
        if (request.getNotifyLowStockEmail() != null) merchant.setNotifyLowStockEmail(request.getNotifyLowStockEmail());
        if (request.getNotifyNewOrderWhatsapp() != null) merchant.setNotifyNewOrderWhatsapp(request.getNotifyNewOrderWhatsapp());
        if (request.getNotifyUrgentWhatsapp() != null) merchant.setNotifyUrgentWhatsapp(request.getNotifyUrgentWhatsapp());

        merchantRepository.save(merchant);
        return new StoreResponse(merchant);
    }

    /** Owner or assigned staff may read a store's details. */
    @GetMapping("/{storeId}")
    public StoreResponse getStore(@PathVariable Long storeId, Authentication authentication) {
        User user = currentUserService.require(authentication);
        Merchant merchant = storeAccessService.requireStoreMembership(user, storeId);
        return new StoreResponse(merchant);
    }

    private User requireMerchant(Authentication authentication) {
        User user = currentUserService.require(authentication);
        if (user.getRole() != UserRole.MERCHANT) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Merchant role required");
        }
        return user;
    }

    private String resolveSlug(String requested, String storeName) {
        String base = requested != null && !requested.isBlank()
                ? requested.trim().toLowerCase()
                : slugify(storeName);
        if (base.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Store link cannot be empty");
        }
        if (requested != null && !requested.isBlank()) {
            if (merchantRepository.existsBySlug(base)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "Store link already taken. Please choose another.");
            }
            return base;
        }
        String candidate = base;
        int suffix = 2;
        while (merchantRepository.existsBySlug(candidate)) {
            candidate = base + "-" + suffix++;
        }
        return candidate;
    }

    private String normalizeCurrency(String raw) {
        String value = raw == null ? "SGD" : raw.trim().toUpperCase();
        if (!value.equals("SGD") && !value.equals("IDR")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Currency must be SGD or IDR");
        }
        return value;
    }

    private String slugify(String input) {
        String s = input == null ? "" : input.toLowerCase().trim()
                .replaceAll("[^a-z0-9\\s-]", "")
                .replaceAll("\\s+", "-")
                .replaceAll("-+", "-");
        return s.replaceAll("^-|-$", "");
    }
}
