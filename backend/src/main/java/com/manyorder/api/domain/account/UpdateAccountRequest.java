package com.manyorder.api.domain.account;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Body for updating the signed-in user's own profile: full name (required, 1 to
 * 100 characters) and an optional phone. It carries no user id and can never
 * change email, role or verified status.
 */
public class UpdateAccountRequest {

    @NotBlank(message = "Name is required")
    @Size(max = 100, message = "Name must be 100 characters or fewer")
    private String fullName;

    private String phone;

    public UpdateAccountRequest() {}

    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
}
