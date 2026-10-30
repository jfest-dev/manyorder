package com.manyorder.api.domain.discount;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import com.manyorder.api.domain.discount.DiscountService.DeliveryContext;
import com.manyorder.api.domain.discount.DiscountService.EvalStatus;
import com.manyorder.api.domain.discount.DiscountService.Evaluation;
import com.manyorder.api.domain.discount.DiscountService.LineAmount;
import com.manyorder.api.domain.merchant.Merchant;
import com.manyorder.api.domain.product.Product;
import com.manyorder.api.domain.product.ProductRepository;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Unit-tests the non-throwing {@link DiscountService#evaluate} gate collector: each
 * reason on its own, several at once, the pickup<->delivery switch both ways, hidden
 * (unknown) codes, rounding, and that the real redeem path still throws (the server
 * stays the final check). Currency WORDING ("S$12.50" / "Rp 12.500") is asserted in
 * the frontend test; here we assert the structured reason + numeric remaining.
 */
class DiscountEvaluationTest {

    private final DiscountRepository discountRepository = mock(DiscountRepository.class);
    private final ProductRepository productRepository = mock(ProductRepository.class);
    private final DiscountService service = new DiscountService(discountRepository, productRepository);
    private final Merchant merchant = mock(Merchant.class);

    private Discount discount(DiscountType type, String value) {
        return new Discount(merchant, "CODE", type,
                value == null ? BigDecimal.ZERO : new BigDecimal(value),
                null, null, null, true);
    }

    private void stub(Discount d) {
        when(discountRepository.findByMerchantAndCodeIgnoreCase(eq(merchant), any()))
                .thenReturn(Optional.of(d));
    }

    private static LineAmount line(long productId, String total, boolean onSale) {
        return new LineAmount(productId, new BigDecimal(total), onSale);
    }

    private static final DeliveryContext PICKUP = new DeliveryContext(false, BigDecimal.ZERO, false);
    private static DeliveryContext delivery(String fee, boolean pending) {
        return new DeliveryContext(true, new BigDecimal(fee), pending);
    }

    // ---- unknown / lifecycle ----

    @Test
    void unknownCode_isInvalid_withNoReasons() {
        when(discountRepository.findByMerchantAndCodeIgnoreCase(eq(merchant), any())).thenReturn(Optional.empty());
        Evaluation e = service.evaluate(merchant, "NOPE", List.of(line(1, "10.00", false)), PICKUP, true);
        assertEquals(EvalStatus.INVALID, e.status());
        assertTrue(e.reasons().isEmpty(), "an unknown code reveals nothing");
    }

    @Test
    void expiredCode_singleTerminalReason() {
        Discount d = discount(DiscountType.PERCENTAGE, "10");
        d.setEndsAt(LocalDateTime.now().minusDays(1));
        stub(d);
        Evaluation e = service.evaluate(merchant, "CODE", List.of(line(1, "10.00", false)), PICKUP, true);
        assertEquals(EvalStatus.NOT_AVAILABLE, e.status());
        assertEquals(List.of(DiscountReasonCode.EXPIRED), codes(e));
    }

    @Test
    void notStarted_andUsageLimit_areTerminal() {
        Discount future = discount(DiscountType.PERCENTAGE, "10");
        future.setStartsAt(LocalDateTime.now().plusDays(1));
        stub(future);
        assertEquals(List.of(DiscountReasonCode.NOT_STARTED),
                codes(service.evaluate(merchant, "CODE", List.of(line(1, "10.00", false)), PICKUP, true)));

        Discount usedUp = discount(DiscountType.PERCENTAGE, "10");
        usedUp.setUsageLimit(1);
        usedUp.setUsedCount(1);
        stub(usedUp);
        assertEquals(List.of(DiscountReasonCode.USAGE_LIMIT),
                codes(service.evaluate(merchant, "CODE", List.of(line(1, "10.00", false)), PICKUP, true)));
    }

    // ---- eligibility reasons ----

    @Test
    void minSpend_notMet_carriesRemainingAmount() {
        Discount d = discount(DiscountType.PERCENTAGE, "10");
        d.setMinSpend(new BigDecimal("30.00"));
        stub(d);
        Evaluation e = service.evaluate(merchant, "CODE", List.of(line(1, "17.50", false)), PICKUP, true);
        assertEquals(EvalStatus.NOT_AVAILABLE, e.status());
        assertEquals(DiscountReasonCode.MIN_SPEND, e.reasons().get(0).code());
        assertEquals(0, new BigDecimal("12.50").compareTo(e.reasons().get(0).amount()), "remaining to spend");
    }

    @Test
    void firstOrderOnly_whenNotFirstOrder() {
        Discount d = discount(DiscountType.PERCENTAGE, "10");
        d.setFirstOrderOnly(true);
        stub(d);
        assertEquals(List.of(DiscountReasonCode.FIRST_ORDER_ONLY),
                codes(service.evaluate(merchant, "CODE", List.of(line(1, "10.00", false)), PICKUP, false)));
    }

    @Test
    void severalReasonsAtOnce_minSpendAndFirstOrder() {
        Discount d = discount(DiscountType.PERCENTAGE, "10");
        d.setMinSpend(new BigDecimal("30.00"));
        d.setFirstOrderOnly(true);
        stub(d);
        Evaluation e = service.evaluate(merchant, "CODE", List.of(line(1, "10.00", false)), PICKUP, false);
        assertEquals(EvalStatus.NOT_AVAILABLE, e.status());
        assertTrue(codes(e).contains(DiscountReasonCode.FIRST_ORDER_ONLY));
        assertTrue(codes(e).contains(DiscountReasonCode.MIN_SPEND));
        assertEquals(2, e.reasons().size());
    }

    @Test
    void productScope_whenMatchingItemMissing_carriesLabel() {
        Discount d = discount(DiscountType.PERCENTAGE, "10");
        d.setProductIds(Set.of(99L));
        stub(d);
        Product scoped = new Product(merchant, "Iced Latte", "d", new BigDecimal("6.00"));
        when(productRepository.findByMerchantAndIdIn(eq(merchant), any())).thenReturn(List.of(scoped));
        Evaluation e = service.evaluate(merchant, "CODE", List.of(line(1, "10.00", false)), PICKUP, true);
        assertEquals(DiscountReasonCode.PRODUCT_SCOPE, e.reasons().get(0).code());
        assertEquals("Iced Latte", e.reasons().get(0).productName());
    }

    @Test
    void saleConflict_whenAllMatchingLinesOnSaleAndNoStacking() {
        Discount d = discount(DiscountType.PERCENTAGE, "10"); // store-wide, canStackWithSale=false by default
        stub(d);
        Evaluation e = service.evaluate(merchant, "CODE", List.of(line(1, "10.00", true)), PICKUP, true);
        assertEquals(List.of(DiscountReasonCode.SALE_CONFLICT), codes(e));
    }

    // ---- delivery, and the pickup<->delivery switch both ways ----

    @Test
    void deliveryCode_onPickup_isDeliveryOnly_butAppliesOnDelivery() {
        Discount d = discount(DiscountType.FREE_DELIVERY, null);
        stub(d);
        // pickup: not available, delivery-only
        assertEquals(List.of(DiscountReasonCode.DELIVERY_ONLY),
                codes(service.evaluate(merchant, "CODE", List.of(line(1, "10.00", false)), PICKUP, true)));
        // switch to delivery with a real fee: applies and waives the fee
        Evaluation e = service.evaluate(merchant, "CODE", List.of(line(1, "10.00", false)), delivery("5.00", false), true);
        assertEquals(EvalStatus.APPLIED, e.status());
        assertTrue(e.freeDelivery());
        assertEquals(0, new BigDecimal("5.00").compareTo(e.deliveryDiscount()));
    }

    @Test
    void partialDeliveryCode_pendingFee_isNotAvailable() {
        Discount d = discount(DiscountType.PERCENTAGE, "20");
        d.setAppliesToDelivery(true);
        stub(d);
        assertEquals(List.of(DiscountReasonCode.DELIVERY_PENDING),
                codes(service.evaluate(merchant, "CODE", List.of(line(1, "10.00", false)), delivery("0", true), true)));
    }

    // ---- applied + rounding ----

    @Test
    void applied_percentage_roundsHalfUp() {
        Discount d = discount(DiscountType.PERCENTAGE, "33");
        stub(d);
        Evaluation e = service.evaluate(merchant, "CODE", List.of(line(1, "10.00", false)), PICKUP, true);
        assertEquals(EvalStatus.APPLIED, e.status());
        // 33% of 10.00 = 3.30
        assertEquals(0, new BigDecimal("3.30").compareTo(e.amount()));
    }

    @Test
    void applied_whenAllGatesPass() {
        Discount d = discount(DiscountType.FIXED, "5");
        d.setMinSpend(new BigDecimal("10.00"));
        stub(d);
        Evaluation e = service.evaluate(merchant, "CODE", List.of(line(1, "20.00", false)), PICKUP, true);
        assertEquals(EvalStatus.APPLIED, e.status());
        assertEquals(0, new BigDecimal("5").compareTo(e.amount()));
        assertTrue(e.reasons().isEmpty());
    }

    // ---- the server stays the final check ----

    @Test
    void redeem_stillThrows_whenConditionUnmet() {
        Discount d = discount(DiscountType.PERCENTAGE, "10");
        d.setMinSpend(new BigDecimal("30.00"));
        stub(d);
        // evaluate() reports it politely...
        assertEquals(EvalStatus.NOT_AVAILABLE,
                service.evaluate(merchant, "CODE", List.of(line(1, "10.00", false)), PICKUP, true).status());
        // ...but the actual redeem rejects, so a tampered client can't slip it through.
        assertThrows(ResponseStatusException.class, () ->
                service.redeemForCheckout(merchant, "CODE", List.of(line(1, "10.00", false)), PICKUP, true));
    }

    private static List<DiscountReasonCode> codes(Evaluation e) {
        return e.reasons().stream().map(DiscountService.Reason::code).toList();
    }
}
