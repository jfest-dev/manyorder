package com.manyorder.api.config;

import java.math.BigDecimal;

import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.manyorder.api.domain.customer.Customer;
import com.manyorder.api.domain.customer.CustomerRepository;
import com.manyorder.api.domain.merchant.Merchant;
import com.manyorder.api.domain.merchant.MerchantRepository;
import com.manyorder.api.domain.order.Order;
import com.manyorder.api.domain.order.OrderItem;
import com.manyorder.api.domain.order.OrderItemRepository;
import com.manyorder.api.domain.order.OrderRepository;
import com.manyorder.api.domain.order.OrderStatus;
import com.manyorder.api.domain.order.OrderType;
import com.manyorder.api.domain.order.PaymentStatus;
import com.manyorder.api.domain.product.Product;
import com.manyorder.api.domain.product.ProductRepository;
import com.manyorder.api.domain.user.User;
import com.manyorder.api.domain.user.UserRepository;
import com.manyorder.api.domain.user.UserRole;

/**
 * Idempotent demo seed so recruiters can explore immediately.
 *   Merchant:       hello@manyorder.com / password123   (owns "KiriKiri Brew")
 *   Staff:          staff@manyorder.com / password123   (bound to KiriKiri Brew)
 *   Platform admin: admin@manyorder.com / password123   (seeded, NOT self-registerable)
 */
@Component
public class DataSeeder implements CommandLineRunner {

    private final UserRepository userRepository;
    private final MerchantRepository merchantRepository;
    private final ProductRepository productRepository;
    private final CustomerRepository customerRepository;
    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final PasswordEncoder passwordEncoder;

    public DataSeeder(UserRepository userRepository,
                      MerchantRepository merchantRepository,
                      ProductRepository productRepository,
                      CustomerRepository customerRepository,
                      OrderRepository orderRepository,
                      OrderItemRepository orderItemRepository,
                      PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.merchantRepository = merchantRepository;
        this.productRepository = productRepository;
        this.customerRepository = customerRepository;
        this.orderRepository = orderRepository;
        this.orderItemRepository = orderItemRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    @Transactional
    public void run(String... args) {
        if (userRepository.existsByEmail("hello@manyorder.com")) {
            return; // already seeded
        }

        String hash = passwordEncoder.encode("password123");

        User merchantUser = userRepository.save(
                new User("Demo Merchant", "hello@manyorder.com", hash, UserRole.MERCHANT));
        userRepository.save(
                new User("Platform Admin", "admin@manyorder.com", hash, UserRole.PLATFORM_ADMIN));

        Merchant store = new Merchant(merchantUser, "KiriKiri Brew", "kirikiri-brew",
                "hello@manyorder.com", "+6581234567");
        store.setBusinessType("Food & Beverage");
        store.setCurrency("SGD");
        store.setThemeColor("#0F172A");
        store.setStoreDescription("Specialty coffee, brewed with care.");
        store.setPaymentInstruction("PayNow to +65 8123 4567 and upload the receipt, or pay cash on pickup.");
        merchantRepository.save(store);

        User staffUser = new User("Demo Staff", "staff@manyorder.com", hash, UserRole.STAFF);
        staffUser.setStaffStore(store);
        userRepository.save(staffUser);

        Product icedWhite = productRepository.save(
                new Product(store, "Iced White", "250ml - Signature", new BigDecimal("5.50")));
        Product coldBrew = productRepository.save(
                new Product(store, "Cold Brew", "350ml - House blend", new BigDecimal("6.00")));
        Product croissant = productRepository.save(
                new Product(store, "Croissant", "Butter, baked daily", new BigDecimal("4.00")));
        productRepository.save(
                new Product(store, "Matcha Latte", "300ml - Uji matcha", new BigDecimal("7.00")));

        Customer john = customerRepository.save(
                new Customer(store, "John Doe", "john@example.com", "+6581234567"));
        Customer jane = customerRepository.save(
                new Customer(store, "Jane Smith", "jane@example.com", "+6592345678"));

        seedOrder(store, john, OrderStatus.COMPLETED, PaymentStatus.PAID,
                new Object[][] { { icedWhite, 2 } });
        seedOrder(store, jane, OrderStatus.PENDING, PaymentStatus.UNPAID,
                new Object[][] { { coldBrew, 1 }, { croissant, 1 } });
        seedOrder(store, john, OrderStatus.CANCELLED, PaymentStatus.UNPAID,
                new Object[][] { { croissant, 3 } });
    }

    private void seedOrder(Merchant store, Customer customer,
                           OrderStatus status, PaymentStatus paymentStatus,
                           Object[][] lines) {
        Order order = new Order(customer, store, OrderType.PICKUP,
                customer.getFullName(), customer.getPhoneNumber());
        order.setContactEmail(customer.getEmail());
        orderRepository.save(order);

        BigDecimal total = BigDecimal.ZERO;
        for (Object[] line : lines) {
            Product product = (Product) line[0];
            int qty = (Integer) line[1];
            orderItemRepository.save(new OrderItem(order, product, qty, product.getPrice()));
            total = total.add(product.getPrice().multiply(BigDecimal.valueOf(qty)));
        }
        order.setTotalAmount(total);
        order.setStatus(status);
        order.setPaymentStatus(paymentStatus);
        orderRepository.save(order);
    }
}
