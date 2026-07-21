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
import com.manyorder.api.domain.merchant.Merchant;
import com.manyorder.api.domain.merchant.MerchantRepository;
import com.manyorder.api.domain.order.Order;
import com.manyorder.api.domain.order.OrderItem;
import com.manyorder.api.domain.order.OrderItemRepository;
import com.manyorder.api.domain.order.OrderRepository;
import com.manyorder.api.domain.order.OrderService;
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

    public GuestCheckoutController(
            MerchantRepository merchantRepository,
            ProductRepository productRepository,
            OrderRepository orderRepository,
            OrderItemRepository orderItemRepository,
            OrderService orderService) {
        this.merchantRepository = merchantRepository;
        this.productRepository = productRepository;
        this.orderRepository = orderRepository;
        this.orderItemRepository = orderItemRepository;
        this.orderService = orderService;
    }

    @PostMapping("/checkout")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public GuestCheckoutResponse checkout(@Valid @RequestBody GuestCheckoutRequest request) {

        Merchant merchant = merchantRepository.findById(request.getMerchantId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Store not found"));

        // Repeat guests are matched by phone/email within THIS store only —
        // customer identity never crosses store boundaries.
        Customer customer = orderService.findOrCreateCustomer(
                merchant, request.getCustomerName(), request.getCustomerEmail(), request.getCustomerPhone());

        OrderType orderType = "DELIVERY".equalsIgnoreCase(request.getFulfilmentMethod())
                ? OrderType.DELIVERY
                : OrderType.PICKUP;

        Order order = new Order(customer, merchant, orderType,
                request.getCustomerName(), request.getCustomerPhone());
        order.setContactEmail(request.getCustomerEmail());

        if (orderType == OrderType.DELIVERY && request.getDeliveryAddress() != null) {
            order.setDeliveryAddress(request.getDeliveryAddress());
        }
        orderRepository.save(order);

        BigDecimal total = BigDecimal.ZERO;
        List<GuestCheckoutResponse.ItemSummary> itemSummaries = new ArrayList<>();

        for (GuestCheckoutRequest.ItemRequest itemReq : request.getItems()) {
            Product product = productRepository.findByMerchantAndId(merchant, itemReq.getProductId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                            "Product not found in this store: " + itemReq.getProductId()));

            OrderItem item = new OrderItem(order, product, itemReq.getQuantity(), product.getPrice());
            orderItemRepository.save(item);

            BigDecimal subtotal = product.getPrice().multiply(BigDecimal.valueOf(itemReq.getQuantity()));
            total = total.add(subtotal);

            itemSummaries.add(new GuestCheckoutResponse.ItemSummary(
                    product.getName(), itemReq.getQuantity(), product.getPrice(), subtotal));
        }

        order.setTotalAmount(total);
        orderRepository.save(order);

        return new GuestCheckoutResponse(
                order.getId(),
                merchant.getName(),
                merchant.getPaymentInstruction(),
                request.getCustomerName(),
                orderType.name(),
                order.getDeliveryAddress(),
                order.getStatus().name(),
                order.getPaymentStatus().name(),
                total,
                order.getCreatedAt(),
                itemSummaries);
    }
}
