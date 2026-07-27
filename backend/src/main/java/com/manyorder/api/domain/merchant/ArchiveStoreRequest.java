package com.manyorder.api.domain.merchant;

import jakarta.validation.constraints.NotBlank;

/**
 * Body for archiving a store. The owner must re-enter their account password;
 * it is verified server-side in the same request that performs the archive, so
 * a wrong password archives nothing.
 */
public class ArchiveStoreRequest {

    @NotBlank
    private String password;

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }
}
