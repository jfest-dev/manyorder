package com.manyorder.api.domain.storefront;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.manyorder.api.domain.merchant.Merchant;
import com.manyorder.api.domain.order.Order;
import com.manyorder.api.domain.order.OrderItemRepository;
import com.manyorder.api.domain.order.OrderRepository;

import jakarta.validation.Valid;

/**
 * Public, read-only order tracking by private token. The token is accepted in the
 * request body (never the URL) and is never logged. An unknown token returns the
 * same generic 404 as any other, so tokens cannot be probed. Rate limited as a
 * public endpoint by RateLimitFilter. Response carries no customer PII.
 */
@RestController
@RequestMapping("/public/orders")
public class PublicOrderTrackingController {

    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final String frontendBaseUrl;

    public PublicOrderTrackingController(OrderRepository orderRepository,
                                         OrderItemRepository orderItemRepository,
                                         @Value("${app.frontend.base-url:http://localhost:3000}") String frontendBaseUrl) {
        this.orderRepository = orderRepository;
        this.orderItemRepository = orderItemRepository;
        this.frontendBaseUrl = frontendBaseUrl.endsWith("/")
                ? frontendBaseUrl.substring(0, frontendBaseUrl.length() - 1)
                : frontendBaseUrl;
    }

    @PostMapping("/track")
    public TrackingResponse track(@Valid @RequestBody TrackOrderRequest request) {
        List<Order> orders = orderRepository.findByTrackingToken(request.getToken());
        if (orders.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found.");
        }
        return build(orders);
    }

    private TrackingResponse build(List<Order> orders) {
        // Lowest id first: in a split checkout the ready order is created (saved) first.
        orders.sort(Comparator.comparing(Order::getId));
        Order primary = orders.get(0);
        Merchant store = primary.getMerchant();

        List<Long> numbers = new ArrayList<>();
        List<TrackingResponse.TrackedOrder> tracked = new ArrayList<>();
        BigDecimal subtotal = BigDecimal.ZERO, deliveryFee = BigDecimal.ZERO,
                discount = BigDecimal.ZERO, total = BigDecimal.ZERO;

        for (int i = 0; i < orders.size(); i++) {
            Order o = orders.get(i);
            numbers.add(o.getId());

            List<TrackingResponse.Item> items = orderItemRepository.findByOrder(o).stream()
                    .map(it -> new TrackingResponse.Item(
                            it.getProductName(), it.getQuantity(), it.getUnitPrice(), it.getLineSubtotal(),
                            it.getModifiers().stream()
                                    .map(m -> new TrackingResponse.Modifier(m.getGroupName(), m.getOptionName(), m.getPriceDelta()))
                                    .toList(),
                            it.getNotes()))
                    .toList();

            String kind = o.getOrderGroupId() == null ? "STANDARD" : (i == 0 ? "READY" : "PREORDER");
            tracked.add(new TrackingResponse.TrackedOrder(o.getId(), kind, o.getStatus().name(), items));

            subtotal = subtotal.add(o.getSubtotal());
            deliveryFee = deliveryFee.add(o.getDeliveryFee());
            discount = discount.add(o.getDiscountAmount());
            total = total.add(o.getTotalAmount());
        }

        String contactLink = frontendBaseUrl + "/" + store.getSlug();
        return new TrackingResponse(
                store.getName(), store.getCurrency(), contactLink, primary.getOrderType().name(), primary.getNotes(),
                numbers, subtotal, deliveryFee, discount, total, tracked);
    }
}
