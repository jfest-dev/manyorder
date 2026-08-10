package com.manyorder.api.domain.storefront;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

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

        Order order = new Order(customer, merchant, orderType,
                request.getCustomerName(), request.getCustomerPhone());
        order.setSource(OrderSource.STOREFRONT); // placed by a customer via the storefront
        order.setContactEmail(request.getCustomerEmail());
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

        // 1) Line items -> subtotal.
        BigDecimal subtotal = BigDecimal.ZERO;
        List<GuestCheckoutResponse.ItemSummary> itemSummaries = new ArrayList<>();
        for (GuestCheckoutRequest.ItemRequest itemReq : request.getItems()) {
            Product product = productRepository.findByMerchantAndId(merchant, itemReq.getProductId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                            "Product not found in this store: " + itemReq.getProductId()));

            orderItemRepository.save(new OrderItem(order, product, itemReq.getQuantity(), product.getPrice()));

            BigDecimal lineTotal = product.getPrice().multiply(BigDecimal.valueOf(itemReq.getQuantity()));
            subtotal = subtotal.add(lineTotal);
            itemSummaries.add(new GuestCheckoutResponse.ItemSummary(
                    product.getName(), itemReq.getQuantity(), product.getPrice(), lineTotal));
        }

        // 2) Delivery fee — merchant's configured flat fee, delivery orders only.
        BigDecimal deliveryFee = (orderType == OrderType.DELIVERY && merchant.getDeliveryFee() != null)
                ? merchant.getDeliveryFee()
                : BigDecimal.ZERO;

        // 3) Discount — validated + redeemed here (increments usage). Invalid codes 400.
        BigDecimal discountAmount = BigDecimal.ZERO;
        if (request.getDiscountCode() != null && !request.getDiscountCode().isBlank()) {
            DiscountService.Redemption redemption =
                    discountService.redeemForCheckout(merchant, request.getDiscountCode(), subtotal);
            discountAmount = redemption.amount();
            order.setDiscountCode(redemption.code());
        }

        BigDecimal total = subtotal.add(deliveryFee).subtract(discountAmount).max(BigDecimal.ZERO);

        order.setSubtotal(subtotal);
        order.setDeliveryFee(deliveryFee);
        order.setDiscountAmount(discountAmount);
        order.setTotalAmount(total);
        orderRepository.save(order);

        return new GuestCheckoutResponse(
                order.getId(),
                merchant.getName(),
                merchant.getPhoneNumber(),
                merchant.getPaymentInstruction(),
                order.getPaymentMethod(),
                request.getCustomerName(),
                orderType.name(),
                order.getDeliveryAddress(),
                order.getNotes(),
                order.getStatus().name(),
                order.getPaymentStatus().name(),
                subtotal,
                deliveryFee,
                discountAmount,
                order.getDiscountCode(),
                total,
                order.getCreatedAt(),
                itemSummaries);
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
