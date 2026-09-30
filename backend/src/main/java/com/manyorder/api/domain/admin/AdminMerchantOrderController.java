package com.manyorder.api.domain.admin;

import java.util.List;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.manyorder.api.domain.merchant.Merchant;
import com.manyorder.api.domain.order.OrderResponse;
import com.manyorder.api.domain.order.OrderService;
import com.manyorder.api.domain.order.OrderStatus;
import com.manyorder.api.domain.order.UpdateOrderStatusRequest;
import com.manyorder.api.domain.order.UpdatePaymentStatusRequest;
import com.manyorder.api.domain.user.User;
import com.manyorder.api.security.CurrentUserService;
import com.manyorder.api.security.StoreAccessService;

import jakarta.validation.Valid;

/**
 * Platform-admin action on ANY merchant's orders: view and update order/payment
 * status. Status and payment-status changes are audited (an admin reaching into a
 * merchant's live orders is worth a trail, even though it is not a deletion).
 * PLATFORM_ADMIN-only via SecurityConfig.
 */
@RestController
@RequestMapping("/admin/merchants/{merchantId}/orders")
public class AdminMerchantOrderController {

    private final OrderService orderService;
    private final CurrentUserService currentUserService;
    private final StoreAccessService storeAccessService;
    private final AdminAuditService adminAuditService;

    public AdminMerchantOrderController(OrderService orderService,
                                        CurrentUserService currentUserService,
                                        StoreAccessService storeAccessService,
                                        AdminAuditService adminAuditService) {
        this.orderService = orderService;
        this.currentUserService = currentUserService;
        this.storeAccessService = storeAccessService;
        this.adminAuditService = adminAuditService;
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

    @PatchMapping("/{orderId}/status")
    public OrderResponse updateStatus(@PathVariable Long merchantId, @PathVariable Long orderId,
                                      @Valid @RequestBody UpdateOrderStatusRequest request, Authentication auth) {
        User admin = currentUserService.require(auth);
        Merchant merchant = storeAccessService.requireStoreForAdmin(admin, merchantId);
        OrderResponse updated = orderService.updateOrderStatus(merchant, orderId, request.getStatus());
        adminAuditService.record(admin, "UPDATE_ORDER_STATUS", "ORDER", orderId,
                "status=" + request.getStatus() + " @ " + merchant.getName());
        return updated;
    }

    @PatchMapping("/{orderId}/payment-status")
    public OrderResponse updatePaymentStatus(@PathVariable Long merchantId, @PathVariable Long orderId,
                                             @Valid @RequestBody UpdatePaymentStatusRequest request, Authentication auth) {
        User admin = currentUserService.require(auth);
        Merchant merchant = storeAccessService.requireStoreForAdmin(admin, merchantId);
        OrderResponse updated = orderService.updatePaymentStatus(merchant, orderId, request.getPaymentStatus());
        adminAuditService.record(admin, "UPDATE_ORDER_PAYMENT_STATUS", "ORDER", orderId,
                "paymentStatus=" + request.getPaymentStatus() + " @ " + merchant.getName());
        return updated;
    }
}
