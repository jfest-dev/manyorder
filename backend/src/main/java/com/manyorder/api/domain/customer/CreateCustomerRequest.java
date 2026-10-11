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

    /** Optional tags (name + palette color). Normalized/limited by Customer.setTags,
     *  exactly as on update. Reuses the update DTO's input type so there is no copy. */
    private java.util.List<UpdateCustomerRequest.CustomerTagInput> tags;

    public CreateCustomerRequest() {}

    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }
    public String getPhoneNumber() { return phoneNumber; }
    public void setPhoneNumber(String phoneNumber) { this.phoneNumber = phoneNumber; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public java.util.List<UpdateCustomerRequest.CustomerTagInput> getTags() { return tags; }
    public void setTags(java.util.List<UpdateCustomerRequest.CustomerTagInput> tags) { this.tags = tags; }
}
