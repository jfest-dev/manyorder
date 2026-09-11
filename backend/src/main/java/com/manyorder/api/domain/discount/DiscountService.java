package com.manyorder.api.domain.discount;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.manyorder.api.domain.merchant.Merchant;
import com.manyorder.api.domain.product.Product;
import com.manyorder.api.domain.product.ProductRepository;

@Service
public class DiscountService {

    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

    private final DiscountRepository discountRepository;
    private final ProductRepository productRepository;

    public DiscountService(DiscountRepository discountRepository, ProductRepository productRepository) {
        this.discountRepository = discountRepository;
        this.productRepository = productRepository;
    }

    /** One resolved cart line the discount is measured against: which product, and
     *  its priced line total (unit price plus modifiers, times quantity). */
    public record LineAmount(long productId, BigDecimal lineTotal) {}

    // ---------- merchant CRUD ----------

    @Transactional(readOnly = true)
    public List<DiscountResponse> getDiscounts(Merchant merchant) {
        return discountRepository.findByMerchantOrderByCreatedAtDesc(merchant)
                .stream().map(DiscountResponse::new).toList();
    }

    @Transactional
    public DiscountResponse createDiscount(Merchant merchant, CreateDiscountRequest request) {
        String code = normalizeCode(request.getCode());
        if (discountRepository.existsByMerchantAndCodeIgnoreCase(merchant, code)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "A discount with that code already exists.");
        }
        validateShape(request.getType(), request.getValue(), request.getStartsAt(), request.getEndsAt());

        Discount discount = new Discount(
                merchant, code, request.getType(), request.getValue(),
                request.getUsageLimit(), request.getStartsAt(), request.getEndsAt(),
                request.getActive() == null || request.getActive());
        discount.setName(request.getName());
        discount.setProductIds(validateProductScope(merchant, request.getProductIds()));
        return new DiscountResponse(discountRepository.save(discount));
    }

    @Transactional
    public DiscountResponse updateDiscount(Merchant merchant, Long discountId, UpdateDiscountRequest request) {
        Discount discount = requireOwned(merchant, discountId);

        if (request.getCode() != null && !request.getCode().isBlank()) {
            String code = normalizeCode(request.getCode());
            if (!code.equalsIgnoreCase(discount.getCode())
                    && discountRepository.existsByMerchantAndCodeIgnoreCase(merchant, code)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "A discount with that code already exists.");
            }
            discount.setCode(code);
        }
        if (request.getName() != null) discount.setName(request.getName());
        if (request.getType() != null) discount.setType(request.getType());
        if (request.getValue() != null) discount.setValue(request.getValue());
        if (request.getUsageLimit() != null) discount.setUsageLimit(request.getUsageLimit());
        if (request.getStartsAt() != null) discount.setStartsAt(request.getStartsAt());
        if (request.getEndsAt() != null) discount.setEndsAt(request.getEndsAt());
        if (request.getActive() != null) discount.setActive(request.getActive());
        // Null = leave scope unchanged; a list (even empty) replaces it.
        if (request.getProductIds() != null) {
            discount.setProductIds(validateProductScope(merchant, request.getProductIds()));
        }

        validateShape(discount.getType(), discount.getValue(), discount.getStartsAt(), discount.getEndsAt());
        return new DiscountResponse(discountRepository.save(discount));
    }

    @Transactional
    public void deleteDiscount(Merchant merchant, Long discountId) {
        discountRepository.delete(requireOwned(merchant, discountId));
    }

    // ---------- redemption (checkout + public validation) ----------

    /**
     * Resolve a redeemable discount for this store, or throw 400 with a
     * customer-facing reason. Does not mutate usedCount — the checkout increments
     * it once the order is actually placed.
     */
    @Transactional(readOnly = true)
    public Discount requireRedeemable(Merchant merchant, String code) {
        Discount discount = discountRepository
                .findByMerchantAndCodeIgnoreCase(merchant, normalizeCode(code))
                .orElseThrow(() -> reject("That discount code isn't valid."));

        if (!discount.isActive()) throw reject("That discount code is no longer active.");

        LocalDateTime now = LocalDateTime.now();
        if (discount.getStartsAt() != null && now.isBefore(discount.getStartsAt())) {
            throw reject("That discount code isn't active yet.");
        }
        if (discount.getEndsAt() != null && now.isAfter(discount.getEndsAt())) {
            throw reject("That discount code has expired.");
        }
        if (discount.getUsageLimit() != null && discount.getUsedCount() >= discount.getUsageLimit()) {
            throw reject("That discount code has reached its usage limit.");
        }
        return discount;
    }

    /**
     * Money off, given the discountable subtotal (the matching subtotal for a
     * product-specific code, or the whole subtotal for a store-wide one). A FIXED
     * amount is capped at that subtotal, so a fixed code larger than the matching
     * items' worth only takes off what those items are worth.
     */
    public BigDecimal computeAmount(Discount discount, BigDecimal discountableSubtotal) {
        BigDecimal amount = discount.getType() == DiscountType.PERCENTAGE
                ? discountableSubtotal.multiply(discount.getValue()).divide(HUNDRED, 2, RoundingMode.HALF_UP)
                : discount.getValue();
        return amount.min(discountableSubtotal).max(BigDecimal.ZERO);
    }

    /**
     * The portion of the cart the discount is measured against: every line for a
     * store-wide code, or only the lines whose product is in the code's set for a
     * product-specific one.
     */
    public BigDecimal matchingSubtotal(Discount discount, List<LineAmount> lines) {
        BigDecimal sum = BigDecimal.ZERO;
        for (LineAmount line : lines) {
            if (discount.isStoreWide() || discount.getProductIds().contains(line.productId())) {
                sum = sum.add(line.lineTotal());
            }
        }
        return sum;
    }

    /** Preview a code against the given cart lines without redeeming it (powers the
     *  checkout "Apply" button). Prices are the server-derived line totals. */
    @Transactional(readOnly = true)
    public Redemption previewForCheckout(Merchant merchant, String code, List<LineAmount> lines) {
        return resolve(requireRedeemable(merchant, code), lines);
    }

    /** Validate + redeem at checkout: computes the amount against the matching
     *  subtotal and increments usedCount. */
    @Transactional
    public Redemption redeemForCheckout(Merchant merchant, String code, List<LineAmount> lines) {
        Discount discount = requireRedeemable(merchant, code);
        Redemption redemption = resolve(discount, lines);
        discount.setUsedCount(discount.getUsedCount() + 1);
        discountRepository.save(discount);
        return redemption;
    }

    /** Shared amount + scope resolution. Rejects a product-specific code that
     *  matches nothing in the cart, so it can't apply as a silent zero. */
    private Redemption resolve(Discount discount, List<LineAmount> lines) {
        BigDecimal matching = matchingSubtotal(discount, lines);
        if (!discount.isStoreWide() && matching.signum() == 0) {
            throw reject("This code only applies to specific items, none of which are in your cart.");
        }
        BigDecimal amount = computeAmount(discount, matching);
        return new Redemption(discount.getCode(), amount, discount.isStoreWide(),
                Set.copyOf(discount.getProductIds()));
    }

    /**
     * Result of a redemption/preview: the canonical code, the money off, and the
     * scope (store-wide, or the specific product ids) so the caller can allocate
     * the amount across a split order by each bucket's matching share.
     */
    public record Redemption(String code, BigDecimal amount, boolean storeWide, Set<Long> productIds) {}

    // ---------- helpers ----------

    private Discount requireOwned(Merchant merchant, Long discountId) {
        return discountRepository.findByMerchantAndId(merchant, discountId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Discount not found"));
    }

    private String normalizeCode(String code) {
        return code.trim().toUpperCase();
    }

    /**
     * Resolve a requested product-scope list to a validated id set. Null/empty
     * means store-wide (empty set). Every id must be a product owned by this
     * store; a foreign or unknown id is rejected so a discount can't be scoped to
     * another merchant's catalogue.
     */
    private Set<Long> validateProductScope(Merchant merchant, List<Long> requested) {
        if (requested == null || requested.isEmpty()) return new HashSet<>();
        Set<Long> wanted = new HashSet<>(requested);
        Set<Long> owned = new HashSet<>();
        for (Product p : productRepository.findByMerchantAndIdIn(merchant, wanted)) {
            owned.add(p.getId());
        }
        if (!owned.containsAll(wanted)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "One or more selected products don't belong to this store.");
        }
        return wanted;
    }

    private void validateShape(DiscountType type, BigDecimal value, LocalDateTime startsAt, LocalDateTime endsAt) {
        if (type == DiscountType.PERCENTAGE && value.compareTo(HUNDRED) > 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A percentage discount cannot exceed 100%.");
        }
        if (startsAt != null && endsAt != null && startsAt.isAfter(endsAt)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The start date must be before the end date.");
        }
    }

    private ResponseStatusException reject(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
}
