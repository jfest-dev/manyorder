package com.manyorder.api.domain.admin;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.manyorder.api.domain.order.OrderResponse;
import com.manyorder.api.domain.order.OrderService;
import com.manyorder.api.domain.order.OrderStatus;

@RestController
@RequestMapping("/admin/orders")
public class AdminOrderController {

    private final OrderService orderService;

    public AdminOrderController(OrderService orderService) {
        this.orderService = orderService;
    }

   @GetMapping
    public List<OrderResponse> getAllOrders() {
    return orderService.getAllOrders()
            .stream()
            .map(orderService::toResponse)
            .toList();
    }

    @GetMapping("/merchant")
    public List<OrderResponse> getOrdersByMerchant(@RequestParam Long merchantId) {
        return orderService.getOrdersForAdminByMerchantId(merchantId)
            .stream()
            .map(orderService::toResponse)
            .toList();
    }

    @GetMapping("/customer")
    public List<OrderResponse> getOrdersByCustomer(@RequestParam Long customerId) {
        return orderService.getOrdersForAdminByCustomerId(customerId)
            .stream()
            .map(orderService::toResponse)
            .toList();
    }

    @GetMapping("/status")
    public List<OrderResponse> getOrdersByStatus(@RequestParam OrderStatus status) {
        return orderService.getOrdersForAdminByStatus(status)
            .stream()
            .map(orderService::toResponse)
            .toList();
    }

    @GetMapping("/date-range")
    public List<OrderResponse> getOrdersByDateRange(
        @RequestParam String start,
        @RequestParam String end
    )  {
        return orderService.getOrdersForAdminByDateRange(
            LocalDateTime.parse(start),
            LocalDateTime.parse(end)
    )
    .stream()
    .map(orderService::toResponse)
    .toList();
    }
}