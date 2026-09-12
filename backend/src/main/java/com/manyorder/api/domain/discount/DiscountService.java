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

    /** One resolved cart line the discount is measured against: which product, its
     *  priced line total (effective unit price plus modifiers, times quantity), and
     *  whether that product is on sale (so a non-stacking code can skip it). */
    public record LineAmount(long productId, BigDecimal lineTotal, boolean onSale) {}

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
        // A free-delivery voucher has no percentage/amount value and no product
        // scope (it waives delivery, not products) - normalise both away.
        boolean freeDelivery = request.getType() == DiscountType.FREE_DELIVERY;
        BigDecimal value = freeDelivery ? BigDecimal.ZERO : request.getValue();

        Discount discount = new Discount(
                merchant, code, request.getType(), value,
                request.getUsageLimit(), request.getStartsAt(), request.getEndsAt(),
                request.getActive() == null || request.getActive());
        discount.setName(request.getName());
        discount.setProductIds(freeDelivery ? new HashSet<>() : validateProductScope(merchant, request.getProductIds()));
        discount.setMinSpend(request.getMinSpend());
        discount.setFirstOrderOnly(request.getFirstOrderOnly() != null && request.getFirstOrderOnly());
        discount.setCanStackWithSale(request.getCanStackWithSale() != null && request.getCanStackWithSale());
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
        // Null = leave the minimum unchanged; 0 clears it; a positive value sets it.
        if (request.getMinSpend() != null) {
            discount.setMinSpend(request.getMinSpend().signum() == 0 ? null : request.getMinSpend());
        }
        if (request.getFirstOrderOnly() != null) discount.setFirstOrderOnly(request.getFirstOrderOnly());
        if (request.getCanStackWithSale() != null) discount.setCanStackWithSale(request.getCanStackWithSale());
        // A free-delivery code carries no value or product scope, whichever way it
        // was set - normalise so a type flip to FREE_DELIVERY can't leave stale data.
        if (discount.getType() == DiscountType.FREE_DELIVERY) {
            discount.setValue(BigDecimal.ZERO);
            discount.setProductIds(new HashSet<>());
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

    /** The order's delivery situation, needed to resolve a FREE_DELIVERY code:
     *  whether it's a delivery order, the fee that would apply, and whether that
     *  fee is still to-be-confirmed (the store had none configured). */
    public record DeliveryContext(boolean delivery, BigDecimal fee, boolean pending) {}

    /** Preview a code against the given cart lines without redeeming it (powers the
     *  checkout "Apply" button). Prices are the server-derived line totals.
     *  {@code firstOrder} says whether the shopper has no prior order (assume true
     *  when unknown, e.g. no contact entered yet - enforced for real at submit). */
    @Transactional(readOnly = true)
    public Redemption previewForCheckout(Merchant merchant, String code, List<LineAmount> lines,
                                         DeliveryContext delivery, boolean firstOrder) {
        return resolve(requireRedeemable(merchant, code), lines, delivery, firstOrder);
    }

    /** Validate + redeem at checkout: resolves the amount (or delivery waiver) and
     *  increments usedCount. {@code firstOrder} is computed from the customer's
     *  prior (non-cancelled) orders, counted before the new order is persisted. */
    @Transactional
    public Redemption redeemForCheckout(Merchant merchant, String code, List<LineAmount> lines,
                                        DeliveryContext delivery, boolean firstOrder) {
        Discount discount = requireRedeemable(merchant, code);
        Redemption redemption = resolve(discount, lines, delivery, firstOrder);
        discount.setUsedCount(discount.getUsedCount() + 1);
        discountRepository.save(discount);
        return redemption;
    }

    /** Shared resolution. Applies the first-order and minimum-spend gates (all
     *  types), then either the free-delivery waiver or the product-discount
     *  amount. Rejections happen here, before usedCount is bumped, so a rejected
     *  code is never counted. */
    private Redemption resolve(Discount discount, List<LineAmount> lines, DeliveryContext delivery, boolean firstOrder) {
        // First-order-only: valid only when the customer has no prior order.
        if (discount.isFirstOrderOnly() && !firstOrder) {
            throw reject("This code is valid on your first order only.");
        }

        // Minimum spend gates on the WHOLE cart subtotal (all lines), independent
        // of any product scope, so it's checked first for every discount type.
        if (discount.getMinSpend() != null) {
            BigDecimal fullSubtotal = BigDecimal.ZERO;
            for (LineAmount line : lines) fullSubtotal = fullSubtotal.add(line.lineTotal());
            if (fullSubtotal.compareTo(discount.getMinSpend()) < 0) {
                throw reject("Spend at least " + money(discount) + " to use this code.");
            }
        }

        if (discount.getType() == DiscountType.FREE_DELIVERY) {
            return resolveFreeDelivery(discount, delivery);
        }

        // In-scope subtotal (store-wide = all lines; product-specific = matching
        // lines). The discountable subtotal further excludes on-sale lines unless
        // this code may stack with a sale.
        BigDecimal inScope = BigDecimal.ZERO;
        BigDecimal discountable = BigDecimal.ZERO;
        boolean excludedSaleLine = false;
        for (LineAmount line : lines) {
            if (!(discount.isStoreWide() || discount.getProductIds().contains(line.productId()))) continue;
            inScope = inScope.add(line.lineTotal());
            if (line.onSale() && !discount.isCanStackWithSale()) { excludedSaleLine = true; continue; }
            discountable = discountable.add(line.lineTotal());
        }
        if (!discount.isStoreWide() && inScope.signum() == 0) {
            throw reject("This code only applies to specific items, none of which are in your cart.");
        }
        if (discountable.signum() == 0 && excludedSaleLine) {
            throw reject("This code can't be combined with sale-priced items.");
        }
        BigDecimal amount = computeAmount(discount, discountable);
        return new Redemption(discount.getCode(), amount, discount.isStoreWide(),
                Set.copyOf(discount.getProductIds()), false, BigDecimal.ZERO, discount.isCanStackWithSale());
    }

    /**
     * Resolve a FREE_DELIVERY code against the order's delivery situation. Rejects
     * a pickup order (nothing to waive) and an order whose delivery is already
     * free. A to-be-confirmed fee is forced to free (nothing quantifiable to
     * waive yet). Otherwise the applicable fee is the waived amount.
     */
    private Redemption resolveFreeDelivery(Discount discount, DeliveryContext delivery) {
        if (delivery == null || !delivery.delivery()) {
            throw reject("This code applies to delivery orders only.");
        }
        if (!delivery.pending() && delivery.fee().signum() == 0) {
            throw reject("Delivery is already free on this order.");
        }
        BigDecimal waived = delivery.pending() ? BigDecimal.ZERO : delivery.fee();
        return new Redemption(discount.getCode(), BigDecimal.ZERO, true, Set.of(), true, waived,
                discount.isCanStackWithSale());
    }

    /** Format the discount's minimum spend in the store's currency, for the
     *  customer-facing reject message (SGD "$30.00", IDR "Rp 30000"). */
    private String money(Discount discount) {
        String currency = discount.getMerchant().getCurrency();
        String symbol = "IDR".equalsIgnoreCase(currency) ? "Rp " : "$";
        return symbol + discount.getMinSpend().toPlainString();
    }

    /**
     * Result of a redemption/preview: the canonical code, the product money off,
     * the scope (store-wide, or the specific product ids) so the caller can
     * allocate the amount across a split order by matching share, and - for a
     * free-delivery code - a flag plus the delivery fee it waives.
     */
    public record Redemption(String code, BigDecimal amount, boolean storeWide, Set<Long> productIds,
                             boolean freeDelivery, BigDecimal deliveryDiscount, boolean canStackWithSale) {}

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
        // A percentage/fixed code needs a positive value; a free-delivery code has none.
        if (type != DiscountType.FREE_DELIVERY) {
            if (value == null || value.signum() <= 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Enter a value greater than 0.");
            }
            if (type == DiscountType.PERCENTAGE && value.compareTo(HUNDRED) > 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A percentage discount cannot exceed 100%.");
            }
        }
        if (startsAt != null && endsAt != null && startsAt.isAfter(endsAt)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The start date must be before the end date.");
        }
    }

    private ResponseStatusException reject(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
}
