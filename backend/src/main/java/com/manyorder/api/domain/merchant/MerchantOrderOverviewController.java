package com.manyorder.api.domain.merchant;

import java.util.List;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.manyorder.api.domain.order.OrderService;
import com.manyorder.api.domain.order.StoreUnseenCountResponse;
import com.manyorder.api.domain.user.User;
import com.manyorder.api.domain.user.UserRole;
import com.manyorder.api.security.CurrentUserService;

/**
 * Cross-store order overview for the signed-in user, powering the sidebar's
 * new-order badges in one call: a count per store the user can access (an owner's
 * non-archived stores, or a staff member's single assigned store).
 */
@RestController
@RequestMapping("/merchant/orders")
public class MerchantOrderOverviewController {

    private final OrderService orderService;
    private final CurrentUserService currentUserService;
    private final MerchantRepository merchantRepository;

    public MerchantOrderOverviewController(OrderService orderService,
                                           CurrentUserService currentUserService,
                                           MerchantRepository merchantRepository) {
        this.orderService = orderService;
        this.currentUserService = currentUserService;
        this.merchantRepository = merchantRepository;
    }

    /** Unseen new-order count per accessible store. */
    @GetMapping("/unseen-counts")
    public List<StoreUnseenCountResponse> unseenCounts(Authentication authentication) {
        User user = currentUserService.require(authentication);
        return accessibleStores(user).stream()
                .map(store -> new StoreUnseenCountResponse(store.getId(), orderService.unseenOrderCount(store)))
                .toList();
    }

    /** The stores this user may see orders for: a staff member's one store, else
     *  the owner's non-archived stores. */
    private List<Merchant> accessibleStores(User user) {
        if (user.getRole() == UserRole.STAFF) {
            Merchant store = user.getStaffStore();
            return store == null ? List.of() : List.of(store);
        }
        return merchantRepository.findByOwnerAndArchivedAtIsNullOrderByCreatedAtAsc(user);
    }
}
