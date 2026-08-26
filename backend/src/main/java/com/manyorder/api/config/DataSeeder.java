package com.manyorder.api.config;

import java.math.BigDecimal;
import java.time.LocalDate;

import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.manyorder.api.domain.category.Category;
import com.manyorder.api.domain.category.CategoryRepository;
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
import com.manyorder.api.domain.product.ModifierGroup;
import com.manyorder.api.domain.product.ModifierOption;
import com.manyorder.api.domain.product.Product;
import com.manyorder.api.domain.product.ProductRepository;
import com.manyorder.api.domain.user.User;
import com.manyorder.api.domain.user.UserRepository;
import com.manyorder.api.domain.user.UserRole;

/**
 * Idempotent demo seed so recruiters can explore immediately. Runs once on an
 * empty database (guarded by the merchant email); a populated database is left
 * untouched.
 *
 * <p>Seeds three fully populated stores owned by the same merchant:
 *   <ul>
 *     <li><b>Kiri Brew</b> (kirikiri-brew) — coffee &amp; pastries</li>
 *     <li><b>Seoul &amp; Sakura</b> (seoul-sakura) — Japanese/Korean, with modifiers</li>
 *     <li><b>PixelForge</b> (pixelforge) — gaming/tech retail</li>
 *   </ul>
 * with categories, product photos, long descriptions, modifier groups, a
 * realistic mix of in-stock / sold-out (stock 0) / pre-order states, and a few
 * sample orders per store.
 *
 * <p>Accounts (all password123): hello@manyorder.com (merchant, owns all three),
 * staff@manyorder.com (staff on Kiri Brew), admin@manyorder.com (platform admin).
 *
 * <p>Photo URLs point at the app's own Cloudinary (folder manyorder/demo). They
 * are persistent assets; if those images are ever deleted, the seeded URLs 404.
 * Pre-order ready dates are relative to seed time so they always read as upcoming.
 */
@Component
public class DataSeeder implements CommandLineRunner {

    private final UserRepository userRepository;
    private final MerchantRepository merchantRepository;
    private final CategoryRepository categoryRepository;
    private final ProductRepository productRepository;
    private final CustomerRepository customerRepository;
    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final PasswordEncoder passwordEncoder;

    public DataSeeder(UserRepository userRepository,
                      MerchantRepository merchantRepository,
                      CategoryRepository categoryRepository,
                      ProductRepository productRepository,
                      CustomerRepository customerRepository,
                      OrderRepository orderRepository,
                      OrderItemRepository orderItemRepository,
                      PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.merchantRepository = merchantRepository;
        this.categoryRepository = categoryRepository;
        this.productRepository = productRepository;
        this.customerRepository = customerRepository;
        this.orderRepository = orderRepository;
        this.orderItemRepository = orderItemRepository;
        this.passwordEncoder = passwordEncoder;
    }

    private static final String CLOUD = "https://res.cloudinary.com/tvdpnfdn/image/upload/";

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

        seedKiriBrew(merchantUser, hash);
        seedSeoulSakura(merchantUser);
        seedPixelForge(merchantUser);
    }

    // ---------------------------------------------------------------- Kiri Brew

    private void seedKiriBrew(User owner, String hash) {
        Merchant kiri = store(owner, "Kiri Brew", "kirikiri-brew", "hello@manyorder.com", "+6581234567",
                "Food & Beverage", "#000000", "Singapore", "12345", "Test St 922 Test Test",
                "Mon-Sat, 11am-11pm | Closed on Sun",
                "Small-batch specialty coffee roasted in-house every morning. Pour-overs, espresso, cold brew and seasonal pastries; brewed with a lot of care and a little obsession, right here in the neighbourhood.",
                "PayNow to +65 8123 4567 and upload the receipt, or pay cash on pickup.");

        User staff = new User("Demo Staff", "staff@manyorder.com", hash, UserRole.STAFF);
        staff.setStaffStore(kiri);
        userRepository.save(staff);

        Category coffee = cat(kiri, "Coffee", 0);
        Category nonCoffee = cat(kiri, "Non-Coffee", 1);
        Category pastry = cat(kiri, "Pastry", 2);

        product(kiri, coffee, "Espresso", "4.00", 30,
                "A double ristretto pulled from freshly roasted single-origin beans, with a thick golden crema and a deep, lingering chocolate finish. Small but mighty.",
                CLOUD + "v1787649967/manyorder/demo/ti4sqbw44shws8x7huxr.jpg", 0);

        Product icedLatte = product(kiri, coffee, "Iced Latte", "6.00", 25,
                "Two shots of espresso poured over cold milk and ice for a smooth, refreshing pick-me-up that stays silky and creamy right to the last sip.",
                CLOUD + "v1787654404/manyorder/demo/u3d32yu5jmqxvrr8mzpm.jpg", 1);
        milk(icedLatte, 0);
        size(icedLatte, 1);
        coffeeExtras(icedLatte, 2);
        productRepository.save(icedLatte);

        Product coldBrew = product(kiri, coffee, "Cold Brew", "6.50", 20,
                "Steeped slowly for 18 hours, our cold brew is naturally sweet and low in acidity, with mellow notes of cocoa and dark caramel. Served over ice.",
                CLOUD + "v1787649975/manyorder/demo/r7xebu3yb5jsnnexillv.jpg", 2);

        Product cappuccino = product(kiri, coffee, "Cappuccino", "5.50", 0,
                "Equal parts rich espresso, steamed milk and airy foam, dusted with a whisper of cocoa. A classic done properly, every time.",
                CLOUD + "v1787649979/manyorder/demo/uuqddzbvoqlvmym7sanj.jpg", 3);
        milk(cappuccino, 0);
        size(cappuccino, 1);
        coffeeExtras(cappuccino, 2);
        productRepository.save(cappuccino);

        Product matcha = product(kiri, nonCoffee, "Matcha Latte", "6.50", 18,
                "Stone-ground ceremonial-grade matcha whisked to a vibrant green and poured over lightly sweetened steamed milk for an earthy, antioxidant-rich cup.",
                CLOUD + "v1787654754/manyorder/demo/v6y6kjajnwoetta85p9i.jpg", 4);
        milk(matcha, 0);
        size(matcha, 1);
        sweetness(matcha, 2);
        productRepository.save(matcha);

        product(kiri, nonCoffee, "Hot Chocolate", "5.50", 15,
                "Rich Belgian dark chocolate melted into velvety steamed milk and finished with a soft cloud of foam. Pure comfort in a mug.",
                CLOUD + "v1787649986/manyorder/demo/tmbrfvj2ayyk6liqjrzd.jpg", 5);

        Product croissant = product(kiri, pastry, "Butter Croissant", "4.50", 12,
                "Baked fresh every morning: shatteringly crisp, golden layers giving way to a soft, buttery, honeycomb centre. Best enjoyed still warm.",
                CLOUD + "v1787649990/manyorder/demo/rbplto4ifelnx8hbwmsr.jpg", 6);

        Product pumpkin = product(kiri, pastry, "Pumpkin Spice Loaf", "5.00", 0,
                "A moist, tender pumpkin loaf laced with cinnamon, nutmeg and clove and baked to order for the season. Warm, spiced autumn in every slice.",
                CLOUD + "v1787649995/manyorder/demo/bqcjezotiidv3m9yzneb.jpg", 7);
        preOrder(pumpkin, 2, "Ready in 2 days");

        Customer john = customerRepository.save(new Customer(kiri, "John Doe", "john@example.com", "+6581234567"));
        Customer jane = customerRepository.save(new Customer(kiri, "Jane Smith", "jane@example.com", "+6592345678"));
        seedOrder(kiri, john, OrderStatus.COMPLETED, PaymentStatus.PAID, new Object[][] { { icedLatte, 2 } });
        seedOrder(kiri, jane, OrderStatus.PENDING, PaymentStatus.UNPAID, new Object[][] { { coldBrew, 1 }, { croissant, 1 } });
        seedOrder(kiri, john, OrderStatus.CANCELLED, PaymentStatus.UNPAID, new Object[][] { { croissant, 3 } });
    }

    // ----------------------------------------------------------- Seoul & Sakura

    private void seedSeoulSakura(User owner) {
        Merchant ss = store(owner, "Seoul & Sakura", "seoul-sakura", "", "+6567441028",
                "food", "#EC4899", "Singapore", "088441", "18 Tanjong Pagar Road, #01-03",
                "Tue-Sun, 11:30am-10pm | Closed on Mon",
                "Japanese and Korean comfort food, made to order.",
                "PayNow to +65 6744 1028 and upload the receipt, or pay cash on pickup.");

        Category ramen = cat(ss, "Ramen", 0);
        Category riceBowls = cat(ss, "Rice Bowls", 1);
        Category chicken = cat(ss, "Chicken", 2);
        Category sides = cat(ss, "Sides", 3);

        Product tonkotsu = product(ss, ramen, "Tonkotsu Ramen", "14.00", 20,
                "Our signature pork-bone broth, simmered for 12 hours until silky and rich, with springy noodles, melt-in-the-mouth chashu, a soft-centred egg and spring onion.",
                CLOUD + "v1787650009/manyorder/demo/gw7igrivebbtyb8kqqzh.jpg", 0);
        spiceLevel(tonkotsu, 0);
        addOns(tonkotsu, 1);
        productRepository.save(tonkotsu);

        Product miso = product(ss, ramen, "Spicy Miso Ramen", "14.50", 20,
                "Deeply savoury fermented-miso broth with a slow-building chili heat, topped with seasoned ground pork, sweet corn, bean sprouts and chewy ramen noodles.",
                CLOUD + "v1787650013/manyorder/demo/fmzsxoocib20lrvz0ho0.jpg", 1);
        spiceLevel(miso, 0);
        addOns(miso, 1);
        productRepository.save(miso);

        Product nabe = product(ss, ramen, "Winter Nabe Hotpot", "22.00", 0,
                "A seasonal communal hotpot for two, brimming with fresh vegetables, silken tofu, mushrooms and thin-sliced protein in a fragrant, warming dashi broth.",
                CLOUD + "v1787650006/manyorder/demo/uqbfv7fc3x9p7jwgo9s5.jpg", 2);
        spiceLevel(nabe, 0);
        productRepository.save(nabe);
        preOrder(nabe, 2, "48h notice");

        Product bibimbap = product(ss, riceBowls, "Bibimbap", "13.00", 15,
                "Warm rice crowned with seasoned vegetables, a sunny fried egg and a swirl of gochujang, served sizzling so the bottom crisps into golden nurungji.",
                CLOUD + "v1787654414/manyorder/demo/ycehkzrz6cjgmiyhxc1m.jpg", 3);
        spiceLevel(bibimbap, 0);
        ModifierGroup protein = group(bibimbap, "Protein", 1, 1, 1);
        option(protein, "Chicken", "0.00", 0);
        option(protein, "Beef", "2.00", 1);
        option(protein, "Tofu", "0.00", 2);
        addOns(bibimbap, 2);
        productRepository.save(bibimbap);

        Product katsu = product(ss, riceBowls, "Chicken Katsu Curry", "13.50", 15,
                "A golden panko-crusted chicken cutlet over steamed rice, blanketed in a mildly sweet Japanese curry slow-simmered with carrot and onion.",
                CLOUD + "v1787650021/manyorder/demo/hqb4ayaddjnngay8hoq9.jpg", 4);
        spiceLevel(katsu, 0);
        addOns(katsu, 1);
        productRepository.save(katsu);

        Product kfc = product(ss, chicken, "Korean Fried Chicken", "16.00", 12,
                "Double-fried for an audibly crunchy shell, then tossed in a sticky sweet-and-spicy gochujang glaze and finished with toasted sesame and scallion.",
                CLOUD + "v1787655444/manyorder/demo/alvlnh4zmdlxkynha3v4.jpg", 5);
        spiceLevel(kfc, 0);
        addOns(kfc, 1);
        productRepository.save(kfc);

        Product gyoza = product(ss, sides, "Gyoza (6 pcs)", "7.00", 0,
                "Six juicy pork-and-cabbage dumplings, pan-fried to a crisp golden base and steamed to a tender top, served with a tangy soy-vinegar dipping sauce.",
                CLOUD + "v1787654758/manyorder/demo/x8qxd2rccds4gf1qbwig.jpg", 6);
        ModifierGroup dip = group(gyoza, "Dipping Sauce", 1, 1, 0);
        option(dip, "Classic Ponzu", "0.00", 0);
        option(dip, "Chilli Garlic Oil", "0.00", 1);
        option(dip, "Spicy Miso Mayo", "0.50", 2);
        ModifierGroup gyozaExtra = group(gyoza, "Add-ons", 0, null, 1);
        option(gyozaExtra, "Extra Gyoza (3 pcs)", "3.50", 0);
        productRepository.save(gyoza);

        Product kimchi = product(ss, sides, "Kimchi", "4.00", 30,
                "House-fermented napa cabbage with garlic, ginger and gochugaru, aged for the perfect balance of tang and gentle heat. The essential Korean side.",
                CLOUD + "v1787654762/manyorder/demo/pfnn3cqtookvni0r7r9a.jpg", 7);

        Customer aiko = customerRepository.save(new Customer(ss, "Aiko Tanaka", "aiko@example.com", "+6567441028"));
        Customer ravi = customerRepository.save(new Customer(ss, "Ravi Kumar", "ravi@example.com", "+6583334444"));
        seedOrder(ss, aiko, OrderStatus.COMPLETED, PaymentStatus.PAID, new Object[][] { { tonkotsu, 1 }, { kimchi, 1 } });
        seedOrder(ss, ravi, OrderStatus.PENDING, PaymentStatus.UNPAID, new Object[][] { { bibimbap, 1 } });
    }

    // --------------------------------------------------------------- PixelForge

    private void seedPixelForge(User owner) {
        Merchant pf = store(owner, "PixelForge", "pixelforge", "", "+6568923140",
                "food", "#10B981", "Singapore", "038983", "3 Temasek Boulevard, #04-18 Suntec City Mall",
                "Daily, 11am-9pm",
                "Gaming gear, audio, and PC peripherals.",
                "PayNow to +65 6892 3140 and upload the receipt, or pay on collection.");

        Category audio = cat(pf, "Audio", 0);
        Category peripherals = cat(pf, "Peripherals", 1);
        Category gaming = cat(pf, "Gaming", 2);

        Product nomad = product(pf, gaming, "Nomad Handheld Console", "499.00", 0,
                "A 7-inch OLED handheld that plays your full library anywhere, with hall-effect sticks, all-day battery and a snappy custom chipset. Next batch shipping soon.",
                CLOUD + "v1787655437/manyorder/demo/rgefoxygshb30scd2eoy.jpg", 0);
        preOrder(nomad, 14, "Ships in about 2 weeks");

        product(pf, gaming, "Titan RTX Graphics Card", "899.00", 5,
                "A flagship 16GB GPU built for 4K ray-traced gaming and AI workloads, with a triple-fan cooler that stays whisper-quiet even under sustained load.",
                CLOUD + "v1787654767/manyorder/demo/fh7i7vjycbi8cw1kyubc.jpg", 1);

        Product keyboard = product(pf, peripherals, "Aurora Mechanical Keyboard", "129.00", 15,
                "A 75% hot-swappable board with gasket-mounted plate, per-key RGB and pre-lubed switches for a deep, cushioned and deeply satisfying typing feel.",
                CLOUD + "v1787650029/manyorder/demo/rxa34dtmfwocgesyedrw.jpg", 2);

        Product mouse = product(pf, peripherals, "Vantage Gaming Mouse", "59.00", 25,
                "An ultralight 60g competition mouse with a 26,000 DPI optical sensor, fast optical switches and a near-frictionless PTFE glide for pixel-perfect aim.",
                CLOUD + "v1787650037/manyorder/demo/pc3afju1drcrhl3yxqsb.jpg", 3);

        product(pf, peripherals, "27-inch 4K Monitor", "399.00", 8,
                "A 27-inch 4K panel running at 144Hz with HDR400 and 95% DCI-P3 coverage, tuned for razor-sharp gaming and colour-accurate creative work alike.",
                CLOUD + "v1787650044/manyorder/demo/mygpsyrgoqkc20f5rfts.jpg", 4);

        product(pf, audio, "Studio Over-ear Headphones", "199.00", 12,
                "Open-back planar-magnetic headphones with a wide, natural soundstage and plush memory-foam earpads built for hours of critical, fatigue-free listening.",
                CLOUD + "v1787650053/manyorder/demo/o5qsnl9iln2mguf1o79s.jpg", 5);

        Product earbuds = product(pf, audio, "Pulse Wireless Earbuds", "89.00", 40,
                "True-wireless earbuds with adaptive active noise cancellation, immersive spatial audio and up to 30 hours of playback with the compact charging case.",
                CLOUD + "v1787650032/manyorder/demo/uztrxcfopmg2lll3sjrv.jpg", 6);

        product(pf, gaming, "Vertex Wireless Controller", "89.00", 40,
                "A tournament-grade wireless controller with hall-effect thumbsticks that never drift, four remappable back paddles, and a 40-hour rapid-charge battery.",
                CLOUD + "v1787655440/manyorder/demo/m3zdpsjvas4qiszxakeg.jpg", 7);

        Customer marcus = customerRepository.save(new Customer(pf, "Marcus Lee", "marcus@example.com", "+6568923140"));
        Customer priya = customerRepository.save(new Customer(pf, "Priya Nair", "priya@example.com", "+6585556666"));
        seedOrder(pf, marcus, OrderStatus.COMPLETED, PaymentStatus.PAID, new Object[][] { { keyboard, 1 }, { mouse, 1 } });
        seedOrder(pf, priya, OrderStatus.PENDING, PaymentStatus.UNPAID, new Object[][] { { earbuds, 1 } });
    }

    // -------------------------------------------------------------- build helpers

    private Merchant store(User owner, String name, String slug, String email, String phone,
                           String businessType, String themeColor, String city, String postalCode,
                           String streetAddress, String operatingHours, String description,
                           String paymentInstruction) {
        Merchant m = new Merchant(owner, name, slug, email, phone);
        m.setBusinessType(businessType);
        m.setCurrency("SGD");
        m.setThemeColor(themeColor);
        m.setCity(city);
        m.setPostalCode(postalCode);
        m.setStreetAddress(streetAddress);
        m.setOperatingHours(operatingHours);
        m.setStoreDescription(description);
        m.setPaymentInstruction(paymentInstruction);
        return merchantRepository.save(m);
    }

    private Category cat(Merchant store, String name, int displayOrder) {
        return categoryRepository.save(new Category(store, name, null, displayOrder));
    }

    private Product product(Merchant store, Category category, String name, String price, int stock,
                            String description, String photoUrl, int displayOrder) {
        Product p = new Product(store, name, description, new BigDecimal(price));
        p.setCategory(category);
        p.setStock(stock);
        p.setPhotoUrl(photoUrl);
        p.setDisplayOrder(displayOrder);
        return productRepository.save(p);
    }

    /** Marks a product as pre-order with a ready date relative to seed time. Saves. */
    private void preOrder(Product p, int inDays, String note) {
        p.setPreOrder(true);
        p.setPreOrderReadyDate(LocalDate.now().plusDays(inDays));
        p.setPreOrderNote(note);
        productRepository.save(p);
    }

    // -------- modifier helpers (built onto the product; caller saves the product) --------

    private ModifierGroup group(Product p, String name, int min, Integer max, int sort) {
        ModifierGroup g = new ModifierGroup(p, name, min, max, sort);
        p.getModifierGroups().add(g);
        return g;
    }

    private void option(ModifierGroup g, String name, String delta, int sort) {
        g.addOption(new ModifierOption(g, name, new BigDecimal(delta), sort));
    }

    private void spiceLevel(Product p, int sort) {
        ModifierGroup g = group(p, "Spice level", 1, 1, sort);
        option(g, "Mild", "0.00", 0);
        option(g, "Medium", "0.00", 1);
        option(g, "Hot", "0.00", 2);
    }

    /** Optional "Add-ons": extra egg / extra kimchi (shared across the ramen and rice bowls). */
    private void addOns(Product p, int sort) {
        ModifierGroup g = group(p, "Add-ons", 0, null, sort);
        option(g, "Extra egg", "1.50", 0);
        option(g, "Extra kimchi", "2.00", 1);
    }

    private void milk(Product p, int sort) {
        ModifierGroup g = group(p, "Milk", 1, 1, sort);
        option(g, "Whole Milk", "0.00", 0);
        option(g, "Oat Milk", "0.80", 1);
        option(g, "Almond Milk", "0.80", 2);
        option(g, "Soy Milk", "0.60", 3);
    }

    private void size(Product p, int sort) {
        ModifierGroup g = group(p, "Size", 1, 1, sort);
        option(g, "Regular", "0.00", 0);
        option(g, "Large", "1.00", 1);
    }

    private void coffeeExtras(Product p, int sort) {
        ModifierGroup g = group(p, "Extras", 0, null, sort);
        option(g, "Extra Espresso Shot", "1.00", 0);
        option(g, "Vanilla Syrup", "0.70", 1);
        option(g, "Caramel Syrup", "0.70", 2);
    }

    private void sweetness(Product p, int sort) {
        ModifierGroup g = group(p, "Sweetness", 1, 1, sort);
        option(g, "Normal", "0.00", 0);
        option(g, "Less Sweet", "0.00", 1);
        option(g, "Extra Sweet", "0.00", 2);
    }

    // --------------------------------------------------------------- orders

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
        // Seed orders have no delivery fee or discount, so subtotal == total.
        order.setSubtotal(total);
        order.setTotalAmount(total);
        order.setStatus(status);
        order.setPaymentStatus(paymentStatus);
        orderRepository.save(order);
    }
}
