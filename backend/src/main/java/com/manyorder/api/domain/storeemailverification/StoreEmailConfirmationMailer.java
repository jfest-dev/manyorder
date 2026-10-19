package com.manyorder.api.domain.storeemailverification;

import com.manyorder.api.domain.merchant.Merchant;

/**
 * Sends the "confirm your store contact email" message. Behind an interface so
 * tests can assert it fires without calling out. Implementations never throw and
 * never log the address or token: a failed send must not break saving the store.
 */
public interface StoreEmailConfirmationMailer {
    void sendConfirmation(Merchant merchant, String toEmail, String confirmUrl);
}
