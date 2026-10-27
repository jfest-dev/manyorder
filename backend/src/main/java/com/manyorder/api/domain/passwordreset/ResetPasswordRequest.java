package com.manyorder.api.domain.passwordreset;

import com.manyorder.api.common.validation.ValidPassword;
import jakarta.validation.constraints.NotBlank;

public class ResetPasswordRequest {

    @NotBlank
    private String token;

    /** Same strength rule as registration so reset can't set a weaker password. */
    @NotBlank
    @ValidPassword
    private String newPassword;

    public ResetPasswordRequest() {}

    public String getToken() { return token; }
    public void setToken(String token) { this.token = token; }
    public String getNewPassword() { return newPassword; }
    public void setNewPassword(String newPassword) { this.newPassword = newPassword; }
}
