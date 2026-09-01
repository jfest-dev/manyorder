package com.manyorder.api.domain.discount;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.manyorder.api.domain.merchant.Merchant;

@Service
public class DiscountService {

    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

    private final DiscountRepository discountRepository;

    public DiscountService(DiscountRepository discountRepository) {
        this.discountRepository = discountRepository;
    }

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

    /** Money off, given the order subtotal. Never exceeds the subtotal. */
    public BigDecimal computeAmount(Discount discount, BigDecimal subtotal) {
        BigDecimal amount = discount.getType() == DiscountType.PERCENTAGE
                ? subtotal.multiply(discount.getValue()).divide(HUNDRED, 2, RoundingMode.HALF_UP)
                : discount.getValue();
        return amount.min(subtotal).max(BigDecimal.ZERO);
    }

    /** Preview a code without redeeming it (powers the checkout "Apply" button). */
    @Transactional(readOnly = true)
    public BigDecimal previewAmount(Merchant merchant, String code, BigDecimal subtotal) {
        return computeAmount(requireRedeemable(merchant, code), subtotal);
    }

    /** Validate + redeem at checkout: computes the amount and increments usedCount. */
    @Transactional
    public Redemption redeemForCheckout(Merchant merchant, String code, BigDecimal subtotal) {
        Discount discount = requireRedeemable(merchant, code);
        BigDecimal amount = computeAmount(discount, subtotal);
        discount.setUsedCount(discount.getUsedCount() + 1);
        discountRepository.save(discount);
        return new Redemption(discount.getCode(), amount);
    }

    /** Canonical code snapshot + money off, from a successful redemption. */
    public record Redemption(String code, BigDecimal amount) {}

    // ---------- helpers ----------

    private Discount requireOwned(Merchant merchant, Long discountId) {
        return discountRepository.findByMerchantAndId(merchant, discountId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Discount not found"));
    }

    private String normalizeCode(String code) {
        return code.trim().toUpperCase();
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
