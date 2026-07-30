package com.manyorder.api.domain.account;

import com.manyorder.api.common.validation.ValidPassword;
import jakarta.validation.constraints.NotBlank;

/**
 * Body for changing the signed-in user's password. The current password is
 * re-verified server-side (403 on mismatch), and the new password must satisfy
 * the same strength rule enforced everywhere else a password is set.
 */
public class ChangePasswordRequest {

    @NotBlank
    private String currentPassword;

    @NotBlank
    @ValidPassword
    private String newPassword;

    public ChangePasswordRequest() {}

    public String getCurrentPassword() { return currentPassword; }
    public void setCurrentPassword(String currentPassword) { this.currentPassword = currentPassword; }
    public String getNewPassword() { return newPassword; }
    public void setNewPassword(String newPassword) { this.newPassword = newPassword; }
}
