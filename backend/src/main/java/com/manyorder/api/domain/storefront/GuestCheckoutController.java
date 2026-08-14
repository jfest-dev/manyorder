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
        //    No fee configured (null) → "to be confirmed by seller": fee 0 + pending
        //    flag, resolved off-platform. A set fee is waived at/above the free-
        //    delivery threshold; an explicit 0 is genuinely free.
        BigDecimal deliveryFee = BigDecimal.ZERO;
        boolean deliveryFeePending = false;
        if (orderType == OrderType.DELIVERY) {
            if (merchant.getDeliveryFee() == null) {
                deliveryFeePending = true;
            } else {
                BigDecimal threshold = merchant.getFreeDeliveryThreshold();
                boolean freeByThreshold = threshold != null && combinedSubtotal.compareTo(threshold) >= 0;
                deliveryFee = freeByThreshold ? BigDecimal.ZERO : merchant.getDeliveryFee();
            }
        }

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
        //    ready and pre-order items. On a split the delivery fee (and its
        //    pending flag) sit on the ready order, and the discount is allocated
        //    by subtotal share. The response is built from the persisted orders
        //    by a shared mapper, so lookup and checkout render identically.
        boolean split = !ready.isEmpty() && !preorder.isEmpty();
        List<Order> orders = new ArrayList<>();

        if (split) {
            String groupId = UUID.randomUUID().toString();
            BigDecimal readySubtotal = sumLines(ready);
            BigDecimal readyDiscount = combinedDiscount.signum() == 0
                    ? BigDecimal.ZERO
                    : combinedDiscount.multiply(readySubtotal).divide(combinedSubtotal, 2, RoundingMode.HALF_UP);
            BigDecimal preDiscount = combinedDiscount.subtract(readyDiscount); // remainder, so shares sum exactly

            orders.add(persistOrder(merchant, customer, orderType, request, groupId,
                    ready, readySubtotal, deliveryFee, deliveryFeePending, readyDiscount, discountCode));
            orders.add(persistOrder(merchant, customer, orderType, request, groupId,
                    preorder, sumLines(preorder), BigDecimal.ZERO, false, preDiscount, discountCode));
        } else {
            List<Line> all = ready.isEmpty() ? preorder : ready; // exactly one bucket is non-empty
            orders.add(persistOrder(merchant, customer, orderType, request, null,
                    all, combinedSubtotal, deliveryFee, deliveryFeePending, combinedDiscount, discountCode));
        }

        return mapResponse(merchant, orders);
    }

    /** Persist one order + its items with the given money breakdown. */
    private Order persistOrder(Merchant merchant, Customer customer, OrderType orderType,
                               GuestCheckoutRequest request, String groupId, List<Line> lines,
                               BigDecimal subtotal, BigDecimal deliveryFee, boolean deliveryFeePending,
                               BigDecimal discount, String discountCode) {
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
        order.setDeliveryFeePending(deliveryFeePending);
        order.setDiscountAmount(discount);
        if (discount.signum() > 0) order.setDiscountCode(discountCode);
        order.setTotalAmount(subtotal.add(deliveryFee).subtract(discount).max(BigDecimal.ZERO));
        return orderRepository.save(order);
    }

    /**
     * Build the response from persisted order(s) — the single source of truth for
     * both checkout and order-lookup. Orders are ordered ready-first; combined
     * money fields sum across the group; the primary (first) order supplies the
     * shared contact/fulfilment/payment fields.
     */
    private GuestCheckoutResponse mapResponse(Merchant merchant, List<Order> orders) {
        orders.sort(java.util.Comparator.comparing(this::isPreorderOrder)); // ready (false) before pre-order (true)
        Order primary = orders.get(0);

        List<GuestCheckoutResponse.OrderSummary> summaries = new ArrayList<>();
        List<GuestCheckoutResponse.ItemSummary> allItems = new ArrayList<>();
        BigDecimal subtotal = BigDecimal.ZERO, deliveryFee = BigDecimal.ZERO,
                discount = BigDecimal.ZERO, total = BigDecimal.ZERO;
        boolean pending = false;
        String discountCode = null;

        for (Order o : orders) {
            List<GuestCheckoutResponse.ItemSummary> items = new ArrayList<>();
            for (OrderItem it : orderItemRepository.findByOrder(o)) {
                items.add(new GuestCheckoutResponse.ItemSummary(
                        it.getProduct().getName(), it.getQuantity(), it.getPrice(),
                        it.getPrice().multiply(BigDecimal.valueOf(it.getQuantity()))));
            }
            allItems.addAll(items);
            String kind = o.getOrderGroupId() == null ? "STANDARD" : (isPreorderOrder(o) ? "PREORDER" : "READY");
            summaries.add(new GuestCheckoutResponse.OrderSummary(
                    o.getId(), kind, o.getStatus().name(), o.getPaymentStatus().name(),
                    o.getSubtotal(), o.getDeliveryFee(), o.getDiscountAmount(), o.getTotalAmount(), items));

            subtotal = subtotal.add(o.getSubtotal());
            deliveryFee = deliveryFee.add(o.getDeliveryFee());
            discount = discount.add(o.getDiscountAmount());
            total = total.add(o.getTotalAmount());
            pending = pending || o.isDeliveryFeePending();
            if (discountCode == null && o.getDiscountCode() != null) discountCode = o.getDiscountCode();
        }

        return new GuestCheckoutResponse(
                primary.getOrderGroupId(), primary.getId(),
                merchant.getName(), merchant.getPhoneNumber(), merchant.getPaymentInstruction(),
                primary.getPaymentMethod(), primary.getContactName(), primary.getOrderType().name(),
                primary.getDeliveryAddress(), primary.getNotes(),
                primary.getStatus().name(), primary.getPaymentStatus().name(),
                subtotal, deliveryFee, pending, discount, discountCode, total,
                primary.getCreatedAt(), allItems, summaries);
    }

    /** An order is a pre-order order when all its items are pre-order products. */
    private boolean isPreorderOrder(Order order) {
        List<OrderItem> items = orderItemRepository.findByOrder(order);
        return !items.isEmpty() && items.stream().allMatch(it -> it.getProduct().isPreOrder());
    }

    private static BigDecimal sumLines(List<Line> lines) {
        BigDecimal sum = BigDecimal.ZERO;
        for (Line l : lines) sum = sum.add(l.lineTotal());
        return sum;
    }

    /** A resolved cart line (product + quantity + its line total). */
    private record Line(Product product, int quantity, BigDecimal lineTotal) {}

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

    /**
     * Public order lookup by order number + phone, scoped to the store. Lets a
     * customer who navigated away pull their confirmation back up (and re-open the
     * WhatsApp hand-off). A wrong phone, a foreign store, or a missing order all
     * return the same 404 so orders can't be enumerated by number alone. Follows
     * the group so a split checkout returns both orders.
     */
    @PostMapping("/stores/{slug}/orders/lookup")
    @Transactional(readOnly = true)
    public GuestCheckoutResponse lookupOrder(@org.springframework.web.bind.annotation.PathVariable String slug,
                                             @Valid @RequestBody OrderLookupRequest request) {
        Merchant merchant = merchantRepository.findBySlugAndArchivedAtIsNull(slug.toLowerCase())
                .orElseThrow(GuestCheckoutController::orderNotFound);

        Order order = orderRepository.findById(request.getOrderId()).orElseThrow(GuestCheckoutController::orderNotFound);
        if (!order.getMerchant().getId().equals(merchant.getId())
                || !phoneMatches(order.getContactPhone(), request.getPhone())) {
            throw orderNotFound();
        }

        List<Order> orders = order.getOrderGroupId() != null
                ? new ArrayList<>(orderRepository.findByMerchantAndOrderGroupIdOrderByIdAsc(merchant, order.getOrderGroupId()))
                : new ArrayList<>(List.of(order));
        return mapResponse(merchant, orders);
    }

    /** Lenient phone comparison: digits only, tolerating a country-code prefix. */
    private static boolean phoneMatches(String stored, String provided) {
        String a = stored == null ? "" : stored.replaceAll("\\D", "");
        String b = provided == null ? "" : provided.replaceAll("\\D", "");
        if (a.isEmpty() || b.length() < 7) return false;
        return a.equals(b) || a.endsWith(b) || b.endsWith(a);
    }

    private static ResponseStatusException orderNotFound() {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found");
    }

    public static class OrderLookupRequest {
        @jakarta.validation.constraints.NotNull
        private Long orderId;
        @jakarta.validation.constraints.NotBlank
        private String phone;

        public Long getOrderId() { return orderId; }
        public void setOrderId(Long orderId) { this.orderId = orderId; }
        public String getPhone() { return phone; }
        public void setPhone(String phone) { this.phone = phone; }
    }
}
