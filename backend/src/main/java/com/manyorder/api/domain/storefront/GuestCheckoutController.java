package com.manyorder.api.domain.storefront;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.manyorder.api.domain.customer.Customer;
import com.manyorder.api.domain.discount.DiscountService;
import com.manyorder.api.domain.merchant.Merchant;
import com.manyorder.api.domain.merchant.MerchantRepository;
import com.manyorder.api.domain.order.Order;
import com.manyorder.api.domain.order.OrderItem;
import com.manyorder.api.domain.order.OrderItemRepository;
import com.manyorder.api.domain.order.OrderRepository;
import com.manyorder.api.domain.order.OrderService;
import com.manyorder.api.domain.order.OrderSource;
import com.manyorder.api.domain.order.OrderType;
import com.manyorder.api.domain.product.Product;
import com.manyorder.api.domain.product.ProductRepository;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/public")
public class GuestCheckoutController {

    private final MerchantRepository merchantRepository;
    private final ProductRepository productRepository;
    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final OrderService orderService;
    private final DiscountService discountService;

    public GuestCheckoutController(
            MerchantRepository merchantRepository,
            ProductRepository productRepository,
            OrderRepository orderRepository,
            OrderItemRepository orderItemRepository,
            OrderService orderService,
            DiscountService discountService) {
        this.merchantRepository = merchantRepository;
        this.productRepository = productRepository;
        this.orderRepository = orderRepository;
        this.orderItemRepository = orderItemRepository;
        this.orderService = orderService;
        this.discountService = discountService;
    }

    @PostMapping("/checkout")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public GuestCheckoutResponse checkout(@Valid @RequestBody GuestCheckoutRequest request) {

        Merchant merchant = merchantRepository.findById(request.getMerchantId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Store not found"));
        // Archived stores are closed to new orders.
        if (merchant.isArchived()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Store not found");
        }

        // Repeat guests are matched by phone/email within THIS store only —
        // customer identity never crosses store boundaries.
        Customer customer = orderService.findOrCreateCustomer(
                merchant, request.getCustomerName(), request.getCustomerEmail(), request.getCustomerPhone());

        OrderType orderType = "DELIVERY".equalsIgnoreCase(request.getFulfilmentMethod())
                ? OrderType.DELIVERY
                : OrderType.PICKUP;

        // 1) Resolve + classify each line into ready (in-stock) vs pre-order, and
        //    tally the combined subtotal (discount is computed against the whole cart).
        List<Line> ready = new ArrayList<>();
        List<Line> preorder = new ArrayList<>();
        BigDecimal combinedSubtotal = BigDecimal.ZERO;
        for (GuestCheckoutRequest.ItemRequest itemReq : request.getItems()) {
            Product product = productRepository.findByMerchantAndId(merchant, itemReq.getProductId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                            "Product not found in this store: " + itemReq.getProductId()));
            BigDecimal lineTotal = product.getPrice().multiply(BigDecimal.valueOf(itemReq.getQuantity()));
            (product.isPreOrder() ? preorder : ready).add(new Line(product, itemReq.getQuantity(), lineTotal));
            combinedSubtotal = combinedSubtotal.add(lineTotal);
        }

        // 2) Delivery fee — charged once for the whole checkout (delivery orders only).
        BigDecimal deliveryFee = (orderType == OrderType.DELIVERY && merchant.getDeliveryFee() != null)
                ? merchant.getDeliveryFee()
                : BigDecimal.ZERO;

        // 3) Discount — validated + redeemed once against the combined subtotal.
        BigDecimal combinedDiscount = BigDecimal.ZERO;
        String discountCode = null;
        if (request.getDiscountCode() != null && !request.getDiscountCode().isBlank()) {
            DiscountService.Redemption redemption =
                    discountService.redeemForCheckout(merchant, request.getDiscountCode(), combinedSubtotal);
            combinedDiscount = redemption.amount();
            discountCode = redemption.code();
        }

        // 4) One order, or a split into two linked orders when the cart mixes
        //    ready and pre-order items. On a split the delivery fee sits on the
        //    ready order and the discount is allocated by subtotal share.
        boolean split = !ready.isEmpty() && !preorder.isEmpty();
        List<GuestCheckoutResponse.OrderSummary> summaries = new ArrayList<>();
        Order primary;

        if (split) {
            String groupId = UUID.randomUUID().toString();
            BigDecimal readySubtotal = sumLines(ready);
            BigDecimal readyDiscount = combinedDiscount.signum() == 0
                    ? BigDecimal.ZERO
                    : combinedDiscount.multiply(readySubtotal).divide(combinedSubtotal, 2, RoundingMode.HALF_UP);
            BigDecimal preDiscount = combinedDiscount.subtract(readyDiscount); // remainder, so shares sum exactly

            Order readyOrder = persistOrder(merchant, customer, orderType, request, groupId,
                    ready, readySubtotal, deliveryFee, readyDiscount, discountCode);
            Order preOrder = persistOrder(merchant, customer, orderType, request, groupId,
                    preorder, sumLines(preorder), BigDecimal.ZERO, preDiscount, discountCode);

            summaries.add(summaryOf(readyOrder, "READY", ready));
            summaries.add(summaryOf(preOrder, "PREORDER", preorder));
            primary = readyOrder;
        } else {
            List<Line> all = ready.isEmpty() ? preorder : ready; // exactly one bucket is non-empty
            Order single = persistOrder(merchant, customer, orderType, request, null,
                    all, combinedSubtotal, deliveryFee, combinedDiscount, discountCode);
            summaries.add(summaryOf(single, "STANDARD", all));
            primary = single;
        }

        BigDecimal combinedTotal = combinedSubtotal.add(deliveryFee).subtract(combinedDiscount).max(BigDecimal.ZERO);
        List<GuestCheckoutResponse.ItemSummary> allItems = new ArrayList<>();
        for (Line l : ready) allItems.add(l.toSummary());
        for (Line l : preorder) allItems.add(l.toSummary());

        return new GuestCheckoutResponse(
                primary.getOrderGroupId(),
                primary.getId(),
                merchant.getName(),
                merchant.getPhoneNumber(),
                merchant.getPaymentInstruction(),
                primary.getPaymentMethod(),
                request.getCustomerName(),
                orderType.name(),
                primary.getDeliveryAddress(),
                primary.getNotes(),
                primary.getStatus().name(),
                primary.getPaymentStatus().name(),
                combinedSubtotal,
                deliveryFee,
                combinedDiscount,
                discountCode,
                combinedTotal,
                primary.getCreatedAt(),
                allItems,
                summaries);
    }

    /** Persist one order + its items with the given money breakdown. */
    private Order persistOrder(Merchant merchant, Customer customer, OrderType orderType,
                               GuestCheckoutRequest request, String groupId, List<Line> lines,
                               BigDecimal subtotal, BigDecimal deliveryFee, BigDecimal discount, String discountCode) {
        Order order = new Order(customer, merchant, orderType,
                request.getCustomerName(), request.getCustomerPhone());
        order.setSource(OrderSource.STOREFRONT);
        order.setContactEmail(request.getCustomerEmail());
        order.setOrderGroupId(groupId);
        if (request.getNotes() != null && !request.getNotes().isBlank()) {
            order.setNotes(request.getNotes().trim());
        }
        if (request.getPaymentMethod() != null && !request.getPaymentMethod().isBlank()) {
            order.setPaymentMethod(request.getPaymentMethod().trim());
        }
        if (orderType == OrderType.DELIVERY && request.getDeliveryAddress() != null) {
            order.setDeliveryAddress(request.getDeliveryAddress());
        }
        orderRepository.save(order);

        for (Line l : lines) {
            orderItemRepository.save(new OrderItem(order, l.product(), l.quantity(), l.product().getPrice()));
        }

        order.setSubtotal(subtotal);
        order.setDeliveryFee(deliveryFee);
        order.setDiscountAmount(discount);
        if (discount.signum() > 0) order.setDiscountCode(discountCode);
        order.setTotalAmount(subtotal.add(deliveryFee).subtract(discount).max(BigDecimal.ZERO));
        return orderRepository.save(order);
    }

    private GuestCheckoutResponse.OrderSummary summaryOf(Order order, String kind, List<Line> lines) {
        List<GuestCheckoutResponse.ItemSummary> items = new ArrayList<>();
        for (Line l : lines) items.add(l.toSummary());
        return new GuestCheckoutResponse.OrderSummary(
                order.getId(), kind, order.getStatus().name(), order.getPaymentStatus().name(),
                order.getSubtotal(), order.getDeliveryFee(), order.getDiscountAmount(),
                order.getTotalAmount(), items);
    }

    private static BigDecimal sumLines(List<Line> lines) {
        BigDecimal sum = BigDecimal.ZERO;
        for (Line l : lines) sum = sum.add(l.lineTotal());
        return sum;
    }

    /** A resolved cart line (product + quantity + its line total). */
    private record Line(Product product, int quantity, BigDecimal lineTotal) {
        GuestCheckoutResponse.ItemSummary toSummary() {
            return new GuestCheckoutResponse.ItemSummary(
                    product.getName(), quantity, product.getPrice(), lineTotal);
        }
    }

    /** Live check of a voucher code before submit; 400 with a reason when not valid. */
    @PostMapping("/discounts/validate")
    public DiscountValidationResponse validateDiscount(@Valid @RequestBody DiscountValidationRequest request) {
        Merchant merchant = merchantRepository.findById(request.getMerchantId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Store not found"));
        if (merchant.isArchived()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Store not found");
        }
        BigDecimal subtotal = request.getSubtotal() != null ? request.getSubtotal() : BigDecimal.ZERO;
        BigDecimal amount = discountService.previewAmount(merchant, request.getCode(), subtotal);
        return new DiscountValidationResponse(request.getCode().trim().toUpperCase(), amount);
    }

    public static class DiscountValidationRequest {
        private Long merchantId;
        private String code;
        private BigDecimal subtotal;

        public Long getMerchantId() { return merchantId; }
        public void setMerchantId(Long merchantId) { this.merchantId = merchantId; }
        public String getCode() { return code; }
        public void setCode(String code) { this.code = code; }
        public BigDecimal getSubtotal() { return subtotal; }
        public void setSubtotal(BigDecimal subtotal) { this.subtotal = subtotal; }
    }

    public record DiscountValidationResponse(String code, BigDecimal discountAmount) {}
}
