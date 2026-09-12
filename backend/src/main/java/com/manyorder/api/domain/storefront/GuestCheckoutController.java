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
import com.manyorder.api.domain.order.ModifierResolver;
import com.manyorder.api.domain.order.OrderItem;
import com.manyorder.api.domain.order.OrderItemModifier;
import com.manyorder.api.domain.order.OrderItemRepository;
import com.manyorder.api.domain.order.OrderNotificationMailer;
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
    private final OrderNotificationMailer orderNotificationMailer;

    public GuestCheckoutController(
            MerchantRepository merchantRepository,
            ProductRepository productRepository,
            OrderRepository orderRepository,
            OrderItemRepository orderItemRepository,
            OrderService orderService,
            DiscountService discountService,
            OrderNotificationMailer orderNotificationMailer) {
        this.merchantRepository = merchantRepository;
        this.productRepository = productRepository;
        this.orderRepository = orderRepository;
        this.orderItemRepository = orderItemRepository;
        this.orderService = orderService;
        this.discountService = discountService;
        this.orderNotificationMailer = orderNotificationMailer;
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

        // Enforce the store's fulfilment mode — a client can't order a method the
        // merchant doesn't offer (guards against a stale/tampered storefront).
        String mode = merchant.getFulfilmentMode();
        if (orderType == OrderType.DELIVERY && "PICKUP_ONLY".equals(mode)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "This store offers pickup only.");
        }
        if (orderType == OrderType.PICKUP && "DELIVERY_ONLY".equals(mode)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "This store offers delivery only.");
        }

        // A single "now" for the whole checkout, so sale windows and the prices
        // snapshotted onto the order are all evaluated against one instant.
        java.time.LocalDateTime now = java.time.LocalDateTime.now();

        // 1) Resolve + classify each line into ready (in-stock) vs pre-order, and
        //    tally the combined subtotal (discount is computed against the whole cart).
        List<Line> ready = new ArrayList<>();
        List<Line> preorder = new ArrayList<>();
        BigDecimal combinedSubtotal = BigDecimal.ZERO;
        for (GuestCheckoutRequest.ItemRequest itemReq : request.getItems()) {
            Product product = productRepository.findByMerchantAndId(merchant, itemReq.getProductId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                            "Product not found in this store: " + itemReq.getProductId()));
            // Re-derive the modifiers server-side: validates the ids against THIS
            // product's groups (min/max/required) and prices them — the client sends
            // only ids, never prices.
            ModifierResolver.Resolution resolution =
                    ModifierResolver.resolve(product, itemReq.getModifierOptionIds());
            // Effective base price honours an active sale; modifiers ride on top.
            BigDecimal effectiveBase = product.effectivePriceAt(now);
            BigDecimal effectiveUnit = effectiveBase.add(resolution.totalPerUnit());
            BigDecimal lineTotal = effectiveUnit.multiply(BigDecimal.valueOf(itemReq.getQuantity()));
            String lineNotes = itemReq.getNotes() != null && !itemReq.getNotes().isBlank()
                    ? itemReq.getNotes().trim() : null;
            (product.isPreOrder() ? preorder : ready)
                    .add(new Line(product, itemReq.getQuantity(), resolution, lineNotes, lineTotal,
                            effectiveBase, product.isOnSaleAt(now)));
            combinedSubtotal = combinedSubtotal.add(lineTotal);
        }

        // 2) Delivery fee — charged once for the whole checkout (delivery orders only).
        //    No fee configured (null) → "to be confirmed by seller": fee 0 + pending
        //    flag, resolved off-platform. A set fee is waived at/above the free-
        //    delivery threshold; an explicit 0 is genuinely free.
        DeliveryQuote quote = computeDeliveryFee(merchant, orderType, combinedSubtotal);
        BigDecimal deliveryFee = quote.fee();
        boolean deliveryFeePending = quote.pending();

        // 3) Discount — validated + redeemed once. A store-wide code is measured
        //    against the whole cart; a product-specific code only against its
        //    matching lines (rejected if it matches nothing). A FREE_DELIVERY code
        //    waives the delivery fee instead of discounting products. The redemption
        //    carries the scope so a split order can allocate by matching share.
        BigDecimal combinedDiscount = BigDecimal.ZERO;
        BigDecimal deliveryDiscount = BigDecimal.ZERO;
        String discountCode = null;
        DiscountService.Redemption redemption = null;
        if (request.getDiscountCode() != null && !request.getDiscountCode().isBlank()) {
            List<DiscountService.LineAmount> lineAmounts = new ArrayList<>();
            for (Line l : ready) lineAmounts.add(new DiscountService.LineAmount(l.product().getId(), l.lineTotal(), l.onSale()));
            for (Line l : preorder) lineAmounts.add(new DiscountService.LineAmount(l.product().getId(), l.lineTotal(), l.onSale()));
            DiscountService.DeliveryContext ctx = new DiscountService.DeliveryContext(
                    orderType == OrderType.DELIVERY, deliveryFee, deliveryFeePending);
            // First-order check runs here, BEFORE persistOrder below, so the
            // in-progress order isn't counted and can't disqualify a first-timer.
            boolean firstOrder = orderService.isFirstOrder(merchant, customer);
            redemption = discountService.redeemForCheckout(
                    merchant, request.getDiscountCode(), lineAmounts, ctx, firstOrder);
            combinedDiscount = redemption.amount();
            discountCode = redemption.code();
            if (redemption.freeDelivery()) {
                // Waive delivery: the net fee is zero and nothing is left to confirm.
                deliveryDiscount = redemption.deliveryDiscount();
                deliveryFee = BigDecimal.ZERO;
                deliveryFeePending = false;
            }
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
            // Allocate the discount across the two orders by each bucket's MATCHING
            // subtotal (the lines the code actually applies to), not the full
            // subtotal. So a code that only matches pre-order items puts the whole
            // discount on the pre-order order. Store-wide codes match every line,
            // which reduces to the original full-subtotal split.
            BigDecimal readyDiscount;
            if (combinedDiscount.signum() == 0) {
                readyDiscount = BigDecimal.ZERO;
            } else {
                BigDecimal readyMatch = matchingSubtotal(ready, redemption);
                BigDecimal combinedMatch = readyMatch.add(matchingSubtotal(preorder, redemption));
                readyDiscount = combinedMatch.signum() == 0
                        ? BigDecimal.ZERO
                        : combinedDiscount.multiply(readyMatch).divide(combinedMatch, 2, RoundingMode.HALF_UP);
            }
            BigDecimal preDiscount = combinedDiscount.subtract(readyDiscount); // remainder, so shares sum exactly

            // The delivery fee (and any free-delivery waiver) lives on the ready order.
            orders.add(persistOrder(merchant, customer, orderType, request, groupId,
                    ready, readySubtotal, deliveryFee, deliveryFeePending, readyDiscount, deliveryDiscount, discountCode));
            orders.add(persistOrder(merchant, customer, orderType, request, groupId,
                    preorder, sumLines(preorder), BigDecimal.ZERO, false, preDiscount, BigDecimal.ZERO, discountCode));
        } else {
            List<Line> all = ready.isEmpty() ? preorder : ready; // exactly one bucket is non-empty
            orders.add(persistOrder(merchant, customer, orderType, request, null,
                    all, combinedSubtotal, deliveryFee, deliveryFeePending, combinedDiscount, deliveryDiscount, discountCode));
        }

        // Notify the merchant, if they've opted in. Best-effort and isolated: the
        // mailer swallows its own failures, and we still guard here so nothing
        // about notification can affect the customer's checkout result.
        if (merchant.isNotifyNewOrderEmail()) {
            try {
                orderNotificationMailer.sendNewOrder(merchant, orders);
            } catch (Exception ignored) {
                // Never let a notification problem fail a paid-for checkout.
            }
        }

        return mapResponse(merchant, orders);
    }

    /** Persist one order + its items with the given money breakdown. */
    private Order persistOrder(Merchant merchant, Customer customer, OrderType orderType,
                               GuestCheckoutRequest request, String groupId, List<Line> lines,
                               BigDecimal subtotal, BigDecimal deliveryFee, boolean deliveryFeePending,
                               BigDecimal discount, BigDecimal deliveryDiscount, String discountCode) {
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
            // Snapshot the effective base price (sale-aware) so history reflects
            // what was actually charged, immune to later price/sale changes.
            OrderItem item = new OrderItem(order, l.product(), l.quantity(), l.effectiveBase());
            item.setNotes(l.notes());
            for (ModifierResolver.Selection s : l.resolution().selections()) {
                item.addModifier(new OrderItemModifier(
                        item, s.groupName(), s.optionName(), s.priceDelta(), s.sourceOptionId()));
            }
            orderItemRepository.save(item); // cascades the modifier snapshots
        }

        order.setSubtotal(subtotal);
        order.setDeliveryFee(deliveryFee);
        order.setDeliveryFeePending(deliveryFeePending);
        order.setDiscountAmount(discount);
        order.setDeliveryDiscount(deliveryDiscount);
        // Record the code when this order actually carries the discount's effect
        // (a product discount, or a free-delivery waiver on the fee-bearing order).
        if (discount.signum() > 0 || deliveryDiscount.signum() > 0) order.setDiscountCode(discountCode);
        // deliveryFee is already the net charge (0 when waived), so the total
        // formula is unchanged; deliveryDiscount is informational only.
        order.setTotalAmount(subtotal.add(deliveryFee).subtract(discount).max(BigDecimal.ZERO));
        return orderRepository.save(order);
    }

    private record DeliveryQuote(BigDecimal fee, boolean pending) {}

    /** The delivery fee that applies to a checkout: none for pickup; to-be-confirmed
     *  when the store has no fee set; waived at/above the free-delivery threshold;
     *  otherwise the store's flat fee. Shared by checkout and the validate preview. */
    private DeliveryQuote computeDeliveryFee(Merchant merchant, OrderType orderType, BigDecimal subtotal) {
        if (orderType != OrderType.DELIVERY) return new DeliveryQuote(BigDecimal.ZERO, false);
        if (merchant.getDeliveryFee() == null) return new DeliveryQuote(BigDecimal.ZERO, true);
        BigDecimal threshold = merchant.getFreeDeliveryThreshold();
        boolean freeByThreshold = threshold != null && subtotal.compareTo(threshold) >= 0;
        return new DeliveryQuote(freeByThreshold ? BigDecimal.ZERO : merchant.getDeliveryFee(), false);
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
                discount = BigDecimal.ZERO, deliveryDiscount = BigDecimal.ZERO, total = BigDecimal.ZERO;
        boolean pending = false;
        String discountCode = null;

        for (Order o : orders) {
            List<GuestCheckoutResponse.ItemSummary> items = new ArrayList<>();
            for (OrderItem it : orderItemRepository.findByOrder(o)) {
                List<GuestCheckoutResponse.ModifierLine> mods = it.getModifiers().stream()
                        .map(m -> new GuestCheckoutResponse.ModifierLine(
                                m.getGroupName(), m.getOptionName(), m.getPriceDelta()))
                        .toList();
                items.add(new GuestCheckoutResponse.ItemSummary(
                        it.getProductName(), it.getQuantity(), it.getUnitPrice(),
                        it.getLineSubtotal(), mods, it.getNotes()));
            }
            allItems.addAll(items);
            String kind = o.getOrderGroupId() == null ? "STANDARD" : (isPreorderOrder(o) ? "PREORDER" : "READY");
            summaries.add(new GuestCheckoutResponse.OrderSummary(
                    o.getId(), kind, o.getStatus().name(), o.getPaymentStatus().name(),
                    o.getSubtotal(), o.getDeliveryFee(), o.getDiscountAmount(), o.getDeliveryDiscount(),
                    o.getTotalAmount(), items));

            subtotal = subtotal.add(o.getSubtotal());
            deliveryFee = deliveryFee.add(o.getDeliveryFee());
            discount = discount.add(o.getDiscountAmount());
            deliveryDiscount = deliveryDiscount.add(o.getDeliveryDiscount());
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
                subtotal, deliveryFee, pending, discount, deliveryDiscount, discountCode, total,
                primary.getCreatedAt(), allItems, summaries);
    }

    /** An order is a pre-order order when all its items are pre-order products. */
    private boolean isPreorderOrder(Order order) {
        List<OrderItem> items = orderItemRepository.findByOrder(order);
        // A deleted product (null) can't be confirmed pre-order, so it fails the all-match.
        return !items.isEmpty() && items.stream().allMatch(it -> it.getProduct() != null && it.getProduct().isPreOrder());
    }

    private static BigDecimal sumLines(List<Line> lines) {
        BigDecimal sum = BigDecimal.ZERO;
        for (Line l : lines) sum = sum.add(l.lineTotal());
        return sum;
    }

    /** Subtotal of the lines in one bucket the redeemed discount actually discounts:
     *  in-scope lines (all for store-wide, matching for product-specific), minus
     *  on-sale lines when the code can't stack with a sale. Drives the split
     *  allocation so each order gets its true share of the discount. */
    private static BigDecimal matchingSubtotal(List<Line> lines, DiscountService.Redemption redemption) {
        BigDecimal sum = BigDecimal.ZERO;
        for (Line l : lines) {
            boolean inScope = redemption.storeWide() || redemption.productIds().contains(l.product().getId());
            if (!inScope) continue;
            if (l.onSale() && !redemption.canStackWithSale()) continue;
            sum = sum.add(l.lineTotal());
        }
        return sum;
    }

    /** A resolved cart line: product, quantity, validated modifiers, note, line
     *  total, the effective base price snapshotted onto the order (sale-aware),
     *  and whether the product was on sale at checkout time. */
    private record Line(Product product, int quantity, ModifierResolver.Resolution resolution,
                        String notes, BigDecimal lineTotal, BigDecimal effectiveBase, boolean onSale) {}

    /**
     * Live check of a voucher code before submit; 400 with a reason when not valid.
     * Takes the cart items (not a client-trusted subtotal) so line prices are
     * re-derived server-side and a product-specific code can be measured against
     * exactly the lines it applies to.
     */
    @PostMapping("/discounts/validate")
    @Transactional(readOnly = true)
    public DiscountValidationResponse validateDiscount(@Valid @RequestBody DiscountValidationRequest request) {
        Merchant merchant = merchantRepository.findById(request.getMerchantId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Store not found"));
        if (merchant.isArchived()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Store not found");
        }
        List<DiscountService.LineAmount> lines = resolveLineAmounts(merchant, request.getItems());
        // Build the same delivery context the submit would, so a free-delivery
        // code previews identically (waived amount, or a pickup/already-free reject).
        BigDecimal subtotal = BigDecimal.ZERO;
        for (DiscountService.LineAmount l : lines) subtotal = subtotal.add(l.lineTotal());
        OrderType orderType = "DELIVERY".equalsIgnoreCase(request.getFulfilmentMethod())
                ? OrderType.DELIVERY : OrderType.PICKUP;
        DeliveryQuote quote = computeDeliveryFee(merchant, orderType, subtotal);
        DiscountService.DeliveryContext ctx = new DiscountService.DeliveryContext(
                orderType == OrderType.DELIVERY, quote.fee(), quote.pending());
        // First-order preview: use the entered contact if any; an unknown/blank
        // contact is assumed first-order and enforced for real at submit.
        boolean firstOrder = orderService.isFirstOrderForContact(
                merchant, request.getCustomerEmail(), request.getCustomerPhone());

        DiscountService.Redemption preview =
                discountService.previewForCheckout(merchant, request.getCode(), lines, ctx, firstOrder);
        return new DiscountValidationResponse(
                preview.code(), preview.amount(), preview.freeDelivery(), preview.deliveryDiscount());
    }

    /** Re-price the given cart items server-side into discount line amounts. Ids
     *  must belong to the store; modifiers are validated and priced as at checkout. */
    private List<DiscountService.LineAmount> resolveLineAmounts(
            Merchant merchant, List<DiscountValidationRequest.Item> items) {
        List<DiscountService.LineAmount> out = new ArrayList<>();
        if (items == null) return out;
        java.time.LocalDateTime now = java.time.LocalDateTime.now();
        for (DiscountValidationRequest.Item it : items) {
            if (it.getProductId() == null || it.getQuantity() == null || it.getQuantity() <= 0) continue;
            Product product = productRepository.findByMerchantAndId(merchant, it.getProductId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                            "Product not found in this store: " + it.getProductId()));
            ModifierResolver.Resolution resolution =
                    ModifierResolver.resolve(product, it.getModifierOptionIds());
            BigDecimal effectiveUnit = product.effectivePriceAt(now).add(resolution.totalPerUnit());
            out.add(new DiscountService.LineAmount(
                    product.getId(), effectiveUnit.multiply(BigDecimal.valueOf(it.getQuantity())),
                    product.isOnSaleAt(now)));
        }
        return out;
    }

    public static class DiscountValidationRequest {
        @jakarta.validation.constraints.NotNull
        private Long merchantId;
        @jakarta.validation.constraints.NotBlank
        private String code;
        /** The current cart, so the matching subtotal is computed from server prices. */
        private List<Item> items;
        /** PICKUP or DELIVERY, so a free-delivery code previews against the real fee. */
        private String fulfilmentMethod;
        /** Optional contact, so a first-order-only code previews against real history. */
        private String customerPhone;
        private String customerEmail;

        public Long getMerchantId() { return merchantId; }
        public void setMerchantId(Long merchantId) { this.merchantId = merchantId; }
        public String getCode() { return code; }
        public void setCode(String code) { this.code = code; }
        public List<Item> getItems() { return items; }
        public void setItems(List<Item> items) { this.items = items; }
        public String getFulfilmentMethod() { return fulfilmentMethod; }
        public void setFulfilmentMethod(String fulfilmentMethod) { this.fulfilmentMethod = fulfilmentMethod; }
        public String getCustomerPhone() { return customerPhone; }
        public void setCustomerPhone(String customerPhone) { this.customerPhone = customerPhone; }
        public String getCustomerEmail() { return customerEmail; }
        public void setCustomerEmail(String customerEmail) { this.customerEmail = customerEmail; }

        public static class Item {
            private Long productId;
            private Integer quantity;
            private List<Long> modifierOptionIds;

            public Long getProductId() { return productId; }
            public void setProductId(Long productId) { this.productId = productId; }
            public Integer getQuantity() { return quantity; }
            public void setQuantity(Integer quantity) { this.quantity = quantity; }
            public List<Long> getModifierOptionIds() { return modifierOptionIds; }
            public void setModifierOptionIds(List<Long> modifierOptionIds) { this.modifierOptionIds = modifierOptionIds; }
        }
    }

    /** discountAmount is the product money off (0 for a free-delivery code);
     *  freeDelivery + deliveryDiscount describe a delivery waiver preview. */
    public record DiscountValidationResponse(String code, BigDecimal discountAmount,
                                             boolean freeDelivery, BigDecimal deliveryDiscount) {}

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
