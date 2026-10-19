package com.manyorder.api.domain.storeemailverification;

import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.manyorder.api.domain.merchant.Merchant;
import com.manyorder.api.domain.user.User;
import com.manyorder.api.security.CurrentUserService;
import com.manyorder.api.security.StoreAccessService;

/** Store contact-email confirmation: owner-only send, public confirm from the email link. */
@RestController
public class StoreEmailVerificationController {

    private final StoreEmailVerificationService service;
    private final StoreAccessService storeAccessService;
    private final CurrentUserService currentUserService;

    public StoreEmailVerificationController(StoreEmailVerificationService service,
                                            StoreAccessService storeAccessService,
                                            CurrentUserService currentUserService) {
        this.service = service;
        this.storeAccessService = storeAccessService;
        this.currentUserService = currentUserService;
    }

    /** Owner requests a confirmation email for their store's contact address. */
    @PostMapping("/merchant/stores/{storeId}/email/confirmation")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void sendConfirmation(@PathVariable Long storeId, Authentication authentication) {
        User owner = currentUserService.require(authentication);
        Merchant merchant = storeAccessService.requireOwnedStore(owner, storeId);
        service.sendConfirmation(merchant);
    }

    /** Public: confirm from the emailed link. Generic error for invalid/expired/used tokens. */
    @PostMapping("/public/store-email/confirm")
    public Map<String, String> confirm(@RequestBody ConfirmStoreEmailRequest request) {
        if (request == null || request.token() == null || request.token().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "This confirmation link is invalid or has expired.");
        }
        StoreEmailVerificationService.Confirmation result = service.confirm(request.token().trim());
        return Map.of("storeName", result.storeName(), "email", result.email());
    }

    public record ConfirmStoreEmailRequest(String token) {}
}
