package com.manyorder.api.domain.customer;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Edit an existing customer. Full-record replace: name + phone are required
 *  (phone stays the primary dedupe key), email is optional. */
public class UpdateCustomerRequest {

    @NotBlank
    @Size(max = 255)
    private String fullName;

    @NotBlank
    @Size(max = 255)
    private String phoneNumber;

    @Size(max = 255)
    private String email;

    /** Free-form informational tags; null leaves them unchanged, a list (incl.
     *  empty) replaces them. Normalized server-side (trim/dedupe/cap). */
    private java.util.List<String> tags;

    public UpdateCustomerRequest() {}

    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }
    public String getPhoneNumber() { return phoneNumber; }
    public void setPhoneNumber(String phoneNumber) { this.phoneNumber = phoneNumber; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public java.util.List<String> getTags() { return tags; }
    public void setTags(java.util.List<String> tags) { this.tags = tags; }
}
