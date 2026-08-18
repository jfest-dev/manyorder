package com.manyorder.api.domain.merchant;

import java.util.List;

import java.time.LocalDateTime;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.manyorder.api.common.MoneyValidation;
import com.manyorder.api.domain.upload.CloudinaryImageService;
import com.manyorder.api.domain.user.User;
import com.manyorder.api.domain.user.UserRole;
import com.manyorder.api.security.CurrentUserService;
import com.manyorder.api.security.StoreAccessService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/merchant/stores")
public class MerchantStoreController {

    /**
     * Slugs that would shadow an app route (the storefront lives at the root path
     * {@code manyorder.app/{slug}}). Reserved so a store link can never collide
     * with a real page. Existing store slugs were checked and none collide.
     */
    private static final java.util.Set<String> RESERVED_SLUGS = java.util.Set.of(
            "signin", "register", "login", "logout", "forgot-password", "reset-password",
            "app", "admin", "api", "public", "storefront", "assets", "static");

    private final MerchantRepository merchantRepository;
    private final CurrentUserService currentUserService;
    private final StoreAccessService storeAccessService;
    private final PasswordEncoder passwordEncoder;
    private final StoreLimitService storeLimitService;
    private final CloudinaryImageService imageService;

    public MerchantStoreController(MerchantRepository merchantRepository,
                                   CurrentUserService currentUserService,
                                   StoreAccessService storeAccessService,
                                   PasswordEncoder passwordEncoder,
                                   StoreLimitService storeLimitService,
                                   CloudinaryImageService imageService) {
        this.merchantRepository = merchantRepository;
        this.currentUserService = currentUserService;
        this.storeAccessService = storeAccessService;
        this.passwordEncoder = passwordEncoder;
        this.storeLimitService = storeLimitService;
        this.imageService = imageService;
    }

    /** Store management is owner-only; a STAFF account gets its store from the login response. */
    @GetMapping
    public StoreListResponse myStores(Authentication authentication) {
        User user = requireMerchant(authentication);
        List<StoreResponse> stores = merchantRepository.findByOwnerAndArchivedAtIsNullOrderByCreatedAtAsc(user)
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

        if (storeLimitService.isAtActiveStoreLimit(user)) {
            int max = storeLimitService.maxActiveStores(user);
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Store limit reached (" + max + " of " + max + ")");
        }

        String slug = resolveSlug(request.getSlug(), request.getStoreName());

        Merchant merchant = new Merchant(user, request.getStoreName().trim(), slug,
                request.getStoreEmail(), request.getStorePhone());
        merchant.setBusinessType(request.getBusinessType());
        merchant.setCurrency(normalizeCurrency(request.getCurrency()));
        merchant.setThemeColor(request.getThemeColor());
        merchant.setLogoUrl(request.getLogoUrl());
        merchant.setStoreDescription(request.getStoreDescription());
        merchant.setOperatingHours(request.getOperatingHours());
        merchant.setStreetAddress(request.getStreetAddress());
        merchant.setCity(request.getCity());
        merchant.setPostalCode(request.getPostalCode());
        merchant.setPaymentInstruction(request.getPaymentInstruction());
        merchant.setDeliveryFee(request.getDeliveryFee());
        merchant.setFreeDeliveryThreshold(request.getFreeDeliveryThreshold());

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
            ensureSlugAllowed(slug);
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
        // Empty string clears the logo (Remove affordance); null leaves it unchanged.
        // When the logo is cleared or replaced we remember the old URL so its now-
        // orphaned file can be deleted from the image host after the save commits.
        String orphanedLogo = null;
        if (request.getLogoUrl() != null) {
            String newLogo = request.getLogoUrl().isBlank() ? null : request.getLogoUrl();
            String oldLogo = merchant.getLogoUrl();
            if (!java.util.Objects.equals(newLogo, oldLogo)) {
                merchant.setLogoUrl(newLogo);
                orphanedLogo = oldLogo; // null when there was no prior logo
            }
        }
        if (request.getStoreDescription() != null) merchant.setStoreDescription(request.getStoreDescription());
        if (request.getOperatingHours() != null) merchant.setOperatingHours(request.getOperatingHours());
        if (request.getPaymentInstruction() != null) merchant.setPaymentInstruction(request.getPaymentInstruction());
        if (request.getDeliveryFee() != null) merchant.setDeliveryFee(request.getDeliveryFee());
        if (request.getStreetAddress() != null) merchant.setStreetAddress(request.getStreetAddress());
        if (request.getCity() != null) merchant.setCity(request.getCity());
        if (request.getPostalCode() != null) merchant.setPostalCode(request.getPostalCode());
        if (request.getNotifyNewOrderEmail() != null) merchant.setNotifyNewOrderEmail(request.getNotifyNewOrderEmail());
        if (request.getNotifyLowStockEmail() != null) merchant.setNotifyLowStockEmail(request.getNotifyLowStockEmail());
        if (request.getNotifyNewOrderWhatsapp() != null) merchant.setNotifyNewOrderWhatsapp(request.getNotifyNewOrderWhatsapp());
        if (request.getNotifyUrgentWhatsapp() != null) merchant.setNotifyUrgentWhatsapp(request.getNotifyUrgentWhatsapp());

        merchantRepository.save(merchant);

        // Delete the replaced/removed logo only after the new state is committed,
        // so a failed save never strands us without the file we still reference.
        if (orphanedLogo != null && !orphanedLogo.isBlank()) {
            imageService.deleteByUrl(orphanedLogo);
        }

        return new StoreResponse(merchant);
    }

    /**
     * Soft-delete (archive) a store. Owner-only, and the owner must re-enter
     * their account password — verified here so a wrong password archives
     * nothing. Archiving is atomic with verification: we resolve the owned
     * store first (404 if missing/foreign/already-archived), then check the
     * password (403 on mismatch), then set the archive marker. The row and all
     * its orders/products/customers are preserved; the slug stays reserved.
     */
    @PostMapping("/{storeId}/archive")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void archiveStore(@PathVariable Long storeId,
                             @Valid @RequestBody ArchiveStoreRequest request,
                             Authentication authentication) {
        User user = requireMerchant(authentication);
        Merchant merchant = storeAccessService.requireOwnedStore(user, storeId);

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Incorrect password");
        }

        merchant.setArchivedAt(LocalDateTime.now());
        merchantRepository.save(merchant);
    }

    /**
     * Delivery configuration (dedicated Delivery screen). Owner-only, absolute
     * semantics: a null deliveryFee means "to be confirmed by seller"; a null
     * threshold means no free-delivery threshold.
     */
    @PatchMapping("/{storeId}/delivery")
    public StoreResponse updateDelivery(@PathVariable Long storeId,
                                        @Valid @RequestBody DeliverySettingsRequest request,
                                        Authentication authentication) {
        User user = requireMerchant(authentication);
        Merchant merchant = storeAccessService.requireOwnedStore(user, storeId);
        MoneyValidation.requireValidScale(request.getDeliveryFee(), merchant.getCurrency(), "Delivery fee");
        MoneyValidation.requireValidScale(request.getFreeDeliveryThreshold(), merchant.getCurrency(), "Free-delivery amount");
        merchant.setDeliveryFee(request.getDeliveryFee());
        merchant.setFreeDeliveryThreshold(request.getFreeDeliveryThreshold());
        String tbcMessage = request.getDeliveryToBeConfirmedMessage();
        merchant.setDeliveryToBeConfirmedMessage(tbcMessage != null && tbcMessage.isBlank() ? null : tbcMessage);
        if (request.getFulfilmentMode() != null) {
            String mode = request.getFulfilmentMode();
            if (!mode.equals("BOTH") && !mode.equals("PICKUP_ONLY") && !mode.equals("DELIVERY_ONLY")) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid fulfilment mode: " + mode);
            }
            merchant.setFulfilmentMode(mode);
        }
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
            ensureSlugAllowed(base);
            if (merchantRepository.existsBySlug(base)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "Store link already taken. Please choose another.");
            }
            return base;
        }
        // Auto-derived from the name: skip reserved words too, and de-dupe.
        String candidate = base;
        int suffix = 2;
        while (merchantRepository.existsBySlug(candidate) || RESERVED_SLUGS.contains(candidate)) {
            candidate = base + "-" + suffix++;
        }
        return candidate;
    }

    /** Reject a slug that would shadow an app route (see {@link #RESERVED_SLUGS}). */
    private void ensureSlugAllowed(String slug) {
        if (RESERVED_SLUGS.contains(slug)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "That store link is reserved. Please choose another.");
        }
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
