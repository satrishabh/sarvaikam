package com.sarvaikam.content.security;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.server.ResponseStatusException;

public final class ContentAccess {
    private ContentAccess() {}
    public static boolean has(String permission) {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals(permission));
    }
    public static void require(String permission) {
        if (!has(permission)) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Your account does not have access to this content");
    }
    public static void lesson(boolean exclusive) {
        if (exclusive && !has("content.manage")) require("content.exclusive");
    }
}
