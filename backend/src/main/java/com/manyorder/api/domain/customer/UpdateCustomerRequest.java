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

    /** Free-form informational tags with a palette color; null leaves them
     *  unchanged, a list (incl. empty) replaces them. Normalized server-side
     *  (trim/dedupe/cap; unknown color coerced to the default). */
    private java.util.List<CustomerTagInput> tags;

    public UpdateCustomerRequest() {}

    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }
    public String getPhoneNumber() { return phoneNumber; }
    public void setPhoneNumber(String phoneNumber) { this.phoneNumber = phoneNumber; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public java.util.List<CustomerTagInput> getTags() { return tags; }
    public void setTags(java.util.List<CustomerTagInput> tags) { this.tags = tags; }

    /** A tag from the client: name + palette color key. */
    public static class CustomerTagInput {
        private String name;
        private String color;
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public String getColor() { return color; }
        public void setColor(String color) { this.color = color; }
    }
}
