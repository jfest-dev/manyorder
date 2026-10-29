package com.manyorder.api.domain.account;

import com.manyorder.api.common.Passwords;
import com.manyorder.api.domain.user.User;
import com.manyorder.api.domain.user.UserRole;

/** The signed-in user's own account details for the Settings Account tab. */
public record AccountResponse(
        Long userId,
        String fullName,
        String email,
        UserRole role,
        boolean verified,
        String phone,
        Long staffStoreId,
        boolean demo,
        boolean hasPassword) {

    public static AccountResponse from(User user, boolean demo) {
        return new AccountResponse(
                user.getId(), user.getFullName(), user.getEmail(), user.getRole(),
                user.isVerified(), user.getPhone(),
                user.getStaffStore() == null ? null : user.getStaffStore().getId(),
                demo,
                Passwords.hasUsablePassword(user.getPasswordHash()));
    }
}
