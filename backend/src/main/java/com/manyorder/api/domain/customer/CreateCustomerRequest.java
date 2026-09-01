package com.manyorder.api.domain.customer;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Manually add a customer. Phone is the primary contact + dedupe key. */
public class CreateCustomerRequest {

    @NotBlank
    @Size(max = 255)
    private String fullName;

    @NotBlank
    @Size(max = 255)
    private String phoneNumber;

    @Size(max = 255)
    private String email;

    public CreateCustomerRequest() {}

    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }
    public String getPhoneNumber() { return phoneNumber; }
    public void setPhoneNumber(String phoneNumber) { this.phoneNumber = phoneNumber; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
}
