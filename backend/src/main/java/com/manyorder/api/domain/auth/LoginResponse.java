package com.manyorder.api.domain.auth;

import com.manyorder.api.domain.user.UserRole;

public class LoginResponse {

    private Long userId;
    private String fullName;
    private String email;
    private UserRole role;
    /** Only set for STAFF accounts: the store they are bound to. */
    private Long staffStoreId;
    private String token;

    public LoginResponse(Long userId, String fullName, String email, UserRole role,
                         Long staffStoreId, String token) {
        this.userId = userId;
        this.fullName = fullName;
        this.email = email;
        this.role = role;
        this.staffStoreId = staffStoreId;
        this.token = token;
    }

    public Long getUserId() { return userId; }
    public String getFullName() { return fullName; }
    public String getEmail() { return email; }
    public UserRole getRole() { return role; }
    public Long getStaffStoreId() { return staffStoreId; }
    public String getToken() { return token; }
}
