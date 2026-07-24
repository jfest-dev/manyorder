package com.manyorder.api.domain.order;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.manyorder.api.domain.customer.Customer;
import com.manyorder.api.domain.customer.CustomerRepository;
import com.manyorder.api.domain.merchant.Merchant;
import com.manyorder.api.domain.merchant.MerchantRepository;
import com.manyorder.api.domain.product.Product;
import com.manyorder.api.domain.product.ProductRepository;

/**
 * All merchant-facing methods take an already-authorized Merchant resolved by
 * StoreAccessService in the controller layer. This service never trusts a raw
 * merchantId from the client.
 */
@Service
public class OrderService {

    private final OrderRepository orderRepository;
    private final MerchantRepository merchantRepository;
    private final CustomerRepository customerRepository;
    private final OrderItemRepository orderItemRepository;
    private final ProductRepository productRepository;

    public OrderService(
            OrderRepository orderRepository,
            MerchantRepository merchantRepository,
            CustomerRepository customerRepository,
            OrderItemRepository orderItemRepository,
            ProductRepository productRepository) {

        this.orderRepository = orderRepository;
        this.merchantRepository = merchantRepository;
        this.customerRepository = customerRepository;
        this.orderItemRepository = orderItemRepository;
        this.productRepository = productRepository;
    }

    // ---- Merchant / staff (store already authorized) ----

    public List<Order> getOrders(Merchant merchant, OrderStatus status) {
        if (status != null) {
            return orderRepository.findByMerchantAndStatusOrderByCreatedAtDesc(merchant, status);
        }
        return orderRepository.findByMerchantOrderByCreatedAtDesc(merchant);
    }

    public Order getOrder(Merchant merchant, Long orderId) {
        return orderRepository.findByMerchantAndId(merchant, orderId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found"));
    }

    @Transactional
    public OrderResponse createMerchantOrder(Merchant merchant, CreateMerchantOrderRequest request) {
        Customer customer = findOrCreateCustomer(
                merchant, request.getCustomerName(), request.getEmail(), request.getPhoneNumber());

        Order order = new Order(customer, merchant);
        if (request.getPaymentStatus() != null) order.setPaymentStatus(request.getPaymentStatus());
        if (request.getPaymentMethod() != null) order.setPaymentMethod(request.getPaymentMethod());
        if (request.getPaymentReference() != null) order.setPaymentReference(request.getPaymentReference());
        if (request.getNotes() != null) order.setNotes(request.getNotes());

        boolean hasAddress = request.getDeliveryAddress() != null && !request.getDeliveryAddress().isBlank();
        if (request.getOrderType() != null) {
            // Explicit choice from manual entry is authoritative. Address is optional
            // even for DELIVERY (merchant can add it later via Edit).
            order.setOrderType(request.getOrderType());
            if (request.getOrderType() == OrderType.DELIVERY && hasAddress) {
                order.setDeliveryAddress(request.getDeliveryAddress());
            }
        } else if (hasAddress) {
            // Backward compatible inference for guest / storefront path.
            order.setDeliveryAddress(request.getDeliveryAddress());
            order.setOrderType(OrderType.DELIVERY);
        }
        orderRepository.save(order);

        BigDecimal total = BigDecimal.ZERO;
        if (request.getItems() != null) {
            for (CreateMerchantOrderRequest.ItemRequest itemReq : request.getItems()) {
                Product product = productRepository.findByMerchantAndId(merchant, itemReq.getProductId())
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                                "Product not found in this store: " + itemReq.getProductId()));
                orderItemRepository.save(new OrderItem(order, product, itemReq.getQuantity(), product.getPrice()));
                total = total.add(product.getPrice().multiply(BigDecimal.valueOf(itemReq.getQuantity())));
            }
        }
        order.setTotalAmount(total);
        return toResponse(orderRepository.save(order));
    }

    /**
     * Edit contact/logistics on any status; line items are replaced only when
     * {@code request.items} is present, and only while PENDING or CONFIRMED.
     * Payment and order status are untouched — they have their own flows.
     */
    @Transactional
    public OrderResponse updateMerchantOrder(Merchant merchant, Long orderId, UpdateMerchantOrderRequest request) {
        Order order = getOrder(merchant, orderId);

        // Contact & logistics — editable at any status.
        order.setContactName(request.getCustomerName().trim());
        order.setContactPhone(request.getPhoneNumber() != null ? request.getPhoneNumber().trim() : "");
        order.setContactEmail(request.getEmail() != null && !request.getEmail().isBlank()
                ? request.getEmail().trim() : null);
        order.setNotes(request.getNotes() != null && !request.getNotes().isBlank()
                ? request.getNotes().trim() : null);

        OrderType type = request.getOrderType() != null ? request.getOrderType() : order.getOrderType();
        order.setOrderType(type);
        if (type == OrderType.DELIVERY) {
            boolean hasAddress = request.getDeliveryAddress() != null && !request.getDeliveryAddress().isBlank();
            order.setDeliveryAddress(hasAddress ? request.getDeliveryAddress().trim() : null);
        } else {
            // PICKUP never carries an address.
            order.setDeliveryAddress(null);
        }

        // Line items — replaced only when explicitly provided, and only while editable.
        if (request.getItems() != null) {
            OrderStatus status = order.getStatus();
            if (status != OrderStatus.PENDING && status != OrderStatus.CONFIRMED) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Line items can only be edited while the order is Pending or Confirmed");
            }
            orderItemRepository.deleteAll(orderItemRepository.findByOrder(order));
            orderItemRepository.flush();

            BigDecimal total = BigDecimal.ZERO;
            for (CreateMerchantOrderRequest.ItemRequest itemReq : request.getItems()) {
                Product product = productRepository.findByMerchantAndId(merchant, itemReq.getProductId())
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                                "Product not found in this store: " + itemReq.getProductId()));
                orderItemRepository.save(new OrderItem(order, product, itemReq.getQuantity(), product.getPrice()));
                total = total.add(product.getPrice().multiply(BigDecimal.valueOf(itemReq.getQuantity())));
            }
            order.setTotalAmount(total);
        }

        return toResponse(orderRepository.save(order));
    }

    @Transactional
    public OrderResponse updateOrderStatus(Merchant merchant, Long orderId, OrderStatus newStatus) {
        Order order = getOrder(merchant, orderId);
        OrderStatus currentStatus = order.getStatus();

        if (!isValidStatusTransition(currentStatus, newStatus)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Invalid status transition from " + currentStatus + " to " + newStatus);
        }

        order.setStatus(newStatus);
        return toResponse(orderRepository.save(order));
    }

    @Transactional
    public OrderResponse updatePaymentStatus(Merchant merchant, Long orderId, PaymentStatus paymentStatus) {
        Order order = getOrder(merchant, orderId);
        order.setPaymentStatus(paymentStatus);
        return toResponse(orderRepository.save(order));
    }

    /**
     * Lifecycle: PENDING -> CONFIRMED -> PREPARING -> READY -> (OUT_FOR_DELIVERY -> DELIVERED | COMPLETED) -> COMPLETED.
     * CANCELLED is reachable from every state except COMPLETED (and itself) —
     * a completed order can no longer be cancelled.
     */
    boolean isValidStatusTransition(OrderStatus current, OrderStatus next) {
        if (next == current) {
            return false;
        }
        if (next == OrderStatus.CANCELLED) {
            return current != OrderStatus.COMPLETED && current != OrderStatus.CANCELLED;
        }
        return switch (current) {
            case PENDING -> next == OrderStatus.CONFIRMED;
            case CONFIRMED -> next == OrderStatus.PREPARING;
            case PREPARING -> next == OrderStatus.READY;
            case READY -> next == OrderStatus.OUT_FOR_DELIVERY || next == OrderStatus.COMPLETED;
            case OUT_FOR_DELIVERY -> next == OrderStatus.DELIVERED;
            case DELIVERED -> next == OrderStatus.COMPLETED;
            default -> false;
        };
    }

    /**
     * Per-store customer identity: match by phone first, then email, always
     * scoped to this merchant — never a bare cross-store lookup (see Module 12
     * guardrail). Creates the customer when no match exists.
     */
    public Customer findOrCreateCustomer(Merchant merchant, String name, String email, String phone) {
        Customer customer = null;

        if (phone != null && !phone.isBlank()) {
            customer = customerRepository.findByMerchantAndPhoneNumber(merchant, phone).orElse(null);
        }
        if (customer == null && email != null && !email.isBlank()) {
            customer = customerRepository.findByMerchantAndEmail(merchant, email).orElse(null);
        }
        if (customer == null) {
            customer = customerRepository.save(new Customer(
                    merchant, name, email != null ? email : "", phone));
        }
        return customer;
    }

    // ---- Admin (PLATFORM_ADMIN, cross-store view layer) ----

    public List<Order> getAllOrders() {
        return orderRepository.findAll();
    }

    public List<Order> getOrdersForAdminByMerchantId(Long merchantId) {
        Merchant merchant = merchantRepository.findById(merchantId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Merchant not found"));
        return orderRepository.findByMerchantOrderByCreatedAtDesc(merchant);
    }

    public List<Order> getOrdersForAdminByCustomerId(Long customerId) {
        Customer customer = customerRepository.findById(customerId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Customer not found"));
        return orderRepository.findByCustomer(customer);
    }

    public List<Order> getOrdersForAdminByStatus(OrderStatus status) {
        return orderRepository.findByStatus(status);
    }

    public List<Order> getOrdersForAdminByDateRange(LocalDateTime start, LocalDateTime end) {
        return orderRepository.findByCreatedAtBetween(start, end);
    }

    // ---- Mapping ----

    public OrderResponse toResponse(Order order) {
        List<OrderItemResponse> items = orderItemRepository.findByOrder(order)
                .stream()
                .map(item -> new OrderItemResponse(
                        item.getProduct().getId(),
                        item.getProduct().getName(),
                        item.getQuantity(),
                        item.getPrice()))
                .toList();

        Long customerId = order.getCustomer() != null ? order.getCustomer().getId() : null;

        return new OrderResponse(
                order.getId(),
                customerId,
                order.getContactName(),
                order.getMerchant().getId(),
                order.getMerchant().getName(),
                order.getStatus(),
                order.getPaymentStatus(),
                order.getPaymentMethod(),
                order.getPaymentReference(),
                order.getOrderType(),
                order.getContactName(),
                order.getContactPhone(),
                order.getContactEmail(),
                order.getDeliveryAddress(),
                order.getNotes(),
                order.getScheduledDate(),
                order.getScheduledTime(),
                order.getCreatedAt(),
                order.getTotalAmount(),
                items);
    }
}
