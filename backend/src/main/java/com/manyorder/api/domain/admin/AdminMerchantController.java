package com.manyorder.api.domain.admin;

import java.time.LocalDateTime;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.manyorder.api.domain.merchant.Merchant;
import com.manyorder.api.domain.merchant.MerchantRepository;
import com.manyorder.api.domain.user.User;
import com.manyorder.api.security.CurrentUserService;

/**
 * Platform-admin actions on any merchant. URL-gated to PLATFORM_ADMIN by
 * SecurityConfig ({@code /admin/**}), so MERCHANT/STAFF can never reach it.
 */
@RestController
@RequestMapping("/admin/merchants")
public class AdminMerchantController {

    private final MerchantRepository merchantRepository;
    private final CurrentUserService currentUserService;
    private final AdminAuditService adminAuditService;

    public AdminMerchantController(MerchantRepository merchantRepository,
                                   CurrentUserService currentUserService,
                                   AdminAuditService adminAuditService) {
        this.merchantRepository = merchantRepository;
        this.currentUserService = currentUserService;
        this.adminAuditService = adminAuditService;
    }

    /** Suspend a merchant: hides its storefront and blocks owner/staff login. Idempotent. */
    @PostMapping("/{merchantId}/suspend")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void suspend(@PathVariable Long merchantId, Authentication authentication) {
        User admin = currentUserService.require(authentication);
        Merchant merchant = requireMerchant(merchantId);
        if (!merchant.isSuspended()) {
            merchant.setSuspendedAt(LocalDateTime.now());
            merchantRepository.save(merchant);
            adminAuditService.record(admin, "SUSPEND_MERCHANT", "MERCHANT", merchant.getId(), merchant.getName());
        }
    }

    /** Lift a suspension. Idempotent. */
    @PostMapping("/{merchantId}/unsuspend")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void unsuspend(@PathVariable Long merchantId, Authentication authentication) {
        User admin = currentUserService.require(authentication);
        Merchant merchant = requireMerchant(merchantId);
        if (merchant.isSuspended()) {
            merchant.setSuspendedAt(null);
            merchantRepository.save(merchant);
            adminAuditService.record(admin, "UNSUSPEND_MERCHANT", "MERCHANT", merchant.getId(), merchant.getName());
        }
    }

    private Merchant requireMerchant(Long merchantId) {
        return merchantRepository.findById(merchantId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Store not found"));
    }
}
