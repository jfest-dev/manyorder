package com.manyorder.api.domain.admin;

import java.util.List;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.manyorder.api.domain.merchant.Merchant;
import com.manyorder.api.domain.order.OrderResponse;
import com.manyorder.api.domain.order.OrderService;
import com.manyorder.api.domain.order.OrderStatus;
import com.manyorder.api.security.CurrentUserService;
import com.manyorder.api.security.StoreAccessService;

/**
 * Platform-admin VIEW of a merchant's orders (read-only). Admins can no longer
 * change order or payment status - that stays with the merchant. PLATFORM_ADMIN-only
 * via SecurityConfig.
 */
@RestController
@RequestMapping("/admin/merchants/{merchantId}/orders")
public class AdminMerchantOrderController {

    private final OrderService orderService;
    private final CurrentUserService currentUserService;
    private final StoreAccessService storeAccessService;

    public AdminMerchantOrderController(OrderService orderService,
                                        CurrentUserService currentUserService,
                                        StoreAccessService storeAccessService) {
        this.orderService = orderService;
        this.currentUserService = currentUserService;
        this.storeAccessService = storeAccessService;
    }

    private Merchant store(Authentication auth, Long merchantId) {
        return storeAccessService.requireStoreForAdmin(currentUserService.require(auth), merchantId);
    }

    @GetMapping
    public List<OrderResponse> list(@PathVariable Long merchantId,
                                    @RequestParam(required = false) OrderStatus status, Authentication auth) {
        return orderService.getOrders(store(auth, merchantId), status).stream()
                .map(orderService::toResponse).toList();
    }

    @GetMapping("/{orderId}")
    public OrderResponse get(@PathVariable Long merchantId, @PathVariable Long orderId, Authentication auth) {
        return orderService.toResponse(orderService.getOrder(store(auth, merchantId), orderId));
    }
}
