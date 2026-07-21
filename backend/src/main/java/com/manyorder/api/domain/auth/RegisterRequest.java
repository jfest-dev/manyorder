package com.manyorder.api.domain.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class RegisterRequest {

    @NotBlank
    private String fullName;

    @NotBlank
    @Email
    private String email;

    @NotBlank
    @Size(min = 6)
    private String password;

    /** "MERCHANT" or "STAFF". PLATFORM_ADMIN is never self-registerable. */
    @NotBlank
    private String role;

    /** Required when role = STAFF: the store's link slug acts as the store code. */
    private String storeSlug;

    public RegisterRequest() {}

    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }
    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }
    public String getStoreSlug() { return storeSlug; }
    public void setStoreSlug(String storeSlug) { this.storeSlug = storeSlug; }
}
