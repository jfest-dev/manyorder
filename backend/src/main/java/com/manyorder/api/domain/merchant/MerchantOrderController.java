package com.manyorder.api.domain.merchant;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.manyorder.api.domain.order.CreateMerchantOrderRequest;
import com.manyorder.api.domain.order.OrderResponse;
import com.manyorder.api.domain.order.OrderService;
import com.manyorder.api.domain.order.OrderStatus;
import com.manyorder.api.domain.order.UpdateMerchantOrderRequest;
import com.manyorder.api.domain.order.UpdateOrderStatusRequest;
import com.manyorder.api.domain.order.UpdatePaymentStatusRequest;
import com.manyorder.api.domain.user.User;
import com.manyorder.api.security.CurrentUserService;
import com.manyorder.api.security.StoreAccessService;

import jakarta.validation.Valid;

/**
 * RBAC per Module 1:
 *   read orders / update order status / update payment status -> owner OR staff of this store
 *   create manual orders                                      -> owner only
 * Store identity always comes from the path and is verified against the JWT
 * user — never from a client-supplied body/query parameter.
 */
@RestController
@RequestMapping("/merchant/stores/{storeId}/orders")
public class MerchantOrderController {

    private final OrderService orderService;
    private final CurrentUserService currentUserService;
    private final StoreAccessService storeAccessService;

    public MerchantOrderController(OrderService orderService,
                                   CurrentUserService currentUserService,
                                   StoreAccessService storeAccessService) {
        this.orderService = orderService;
        this.currentUserService = currentUserService;
        this.storeAccessService = storeAccessService;
    }

    @GetMapping
    public List<OrderResponse> getOrders(@PathVariable Long storeId,
                                         @RequestParam(required = false) OrderStatus status,
                                         Authentication authentication) {
        User user = currentUserService.require(authentication);
        Merchant merchant = storeAccessService.requireStoreMembership(user, storeId);
        return orderService.getOrders(merchant, status)
                .stream()
                .map(orderService::toResponse)
                .toList();
    }

    @GetMapping("/{orderId}")
    public OrderResponse getOrder(@PathVariable Long storeId,
                                  @PathVariable Long orderId,
                                  Authentication authentication) {
        User user = currentUserService.require(authentication);
        Merchant merchant = storeAccessService.requireStoreMembership(user, storeId);
        return orderService.toResponse(orderService.getOrder(merchant, orderId));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public OrderResponse createOrder(@PathVariable Long storeId,
                                     @Valid @RequestBody CreateMerchantOrderRequest request,
                                     Authentication authentication) {
        User user = currentUserService.require(authentication);
        Merchant merchant = storeAccessService.requireOwnedStore(user, storeId);
        return orderService.createMerchantOrder(merchant, request);
    }

    @PatchMapping("/{orderId}")
    public OrderResponse updateOrder(@PathVariable Long storeId,
                                     @PathVariable Long orderId,
                                     @Valid @RequestBody UpdateMerchantOrderRequest request,
                                     Authentication authentication) {
        User user = currentUserService.require(authentication);
        Merchant merchant = storeAccessService.requireOwnedStore(user, storeId);
        return orderService.updateMerchantOrder(merchant, orderId, request);
    }

    @PatchMapping("/{orderId}/status")
    public OrderResponse updateStatus(@PathVariable Long storeId,
                                      @PathVariable Long orderId,
                                      @Valid @RequestBody UpdateOrderStatusRequest request,
                                      Authentication authentication) {
        User user = currentUserService.require(authentication);
        Merchant merchant = storeAccessService.requireStoreMembership(user, storeId);
        return orderService.updateOrderStatus(merchant, orderId, request.getStatus());
    }

    @PatchMapping("/{orderId}/payment-status")
    public OrderResponse updatePaymentStatus(@PathVariable Long storeId,
                                             @PathVariable Long orderId,
                                             @Valid @RequestBody UpdatePaymentStatusRequest request,
                                             Authentication authentication) {
        User user = currentUserService.require(authentication);
        Merchant merchant = storeAccessService.requireStoreMembership(user, storeId);
        return orderService.updatePaymentStatus(merchant, orderId, request.getPaymentStatus());
    }
}
