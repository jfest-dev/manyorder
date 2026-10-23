package com.manyorder.api.domain.merchant;

import java.util.Set;
import java.util.regex.Pattern;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/**
 * One place for store-slug rules: normalization, format, maximum length, the
 * reserved list, and availability. The create path, the rename path, and the
 * public availability endpoint all go through here so they agree exactly.
 *
 * <p>Reserved slugs are names that would shadow an app route (the storefront lives
 * at {@code manyorder.app/{slug}}) or a backend/static path, so a store link can
 * never collide with a real page. Existing stores created before a name was
 * reserved keep their slug; only new creates and renames are checked.
 */
@Service
public class SlugService {

    public static final int MAX_LENGTH = 50;

    private static final Pattern FORMAT = Pattern.compile("^[a-z0-9]+(-[a-z0-9]+)*$");

    public static final Set<String> RESERVED = Set.of(
            "signin", "register", "login", "logout", "forgot-password", "reset-password",
            "verify-email", "confirm-store-email", "track", "app", "admin", "api", "auth",
            "public", "merchant", "orders", "marketing", "settings", "dashboard", "products",
            "customers", "static", "assets", "favicon.ico", "robots.txt", "sitemap.xml",
            "well-known", "health", "actuator", "v3", "swagger", "www", "support", "help",
            "try", "demo", "status", "privacy", "terms",
            // Marketing site, product surfaces, brand and placeholder names.
            "pricing", "blog", "about", "contact", "features", "pos", "docs", "shops",
            "explore", "discover", "marketplace", "store", "stores", "cart", "checkout",
            "order", "pay", "payments", "billing", "legal", "security", "careers", "press",
            "partners", "developers", "download", "qr", "manyorder", "many-order", "official",
            "team", "test", "sandbox", "null", "undefined", "alternatives", "policy",
            "platform", "cdn");

    private final MerchantRepository merchantRepository;

    public SlugService(MerchantRepository merchantRepository) {
        this.merchantRepository = merchantRepository;
    }

    /** Trim and lower-case; never null. The same normalization create, rename and
     *  the availability check all apply before any comparison. */
    public String normalize(String raw) {
        return raw == null ? "" : raw.trim().toLowerCase();
    }

    /** Well-formed and within the length cap (lowercase letters, numbers, single
     *  hyphens, no leading/trailing/double hyphen). */
    public boolean hasValidFormat(String slug) {
        return slug != null && !slug.isEmpty() && slug.length() <= MAX_LENGTH
                && FORMAT.matcher(slug).matches();
    }

    public boolean isReserved(String slug) {
        return RESERVED.contains(slug);
    }

    /** Taken by any store, including archived ones, so a freed slug stays reserved. */
    public boolean isTaken(String slug) {
        return merchantRepository.existsBySlug(slug);
    }

    /**
     * True only when the normalized value is well-formed, not reserved, and not
     * taken. Used by the public availability endpoint, which returns the SAME
     * neutral answer for taken, reserved and invalid so it leaks nothing.
     */
    public boolean isAvailable(String raw) {
        String slug = normalize(raw);
        return hasValidFormat(slug) && !isReserved(slug) && !isTaken(slug);
    }

    /**
     * Validate a requested slug for create/rename. Throws 400 for a bad format,
     * an over-length value, or a reserved name. The caller checks "taken" itself
     * (409) so it can allow a store to keep its own current slug.
     */
    public void requireAssignableFormat(String slug) {
        if (!hasValidFormat(slug)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Store link must be 1 to " + MAX_LENGTH
                            + " characters: lowercase letters, numbers and hyphens.");
        }
        if (isReserved(slug)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "That store link is reserved. Please choose another.");
        }
    }

    /** Trim a base (auto-derived from the store name) to the length cap, keeping
     *  room for a {@code -N} de-dupe suffix and never ending on a hyphen. */
    public String capBase(String base, int suffixLength) {
        int max = MAX_LENGTH - suffixLength;
        String s = base.length() > max ? base.substring(0, Math.max(0, max)) : base;
        return s.replaceAll("-+$", "");
    }
}
