package com.sarvaikam.core.identity;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Set;

/**
 * The signed-in account for this request, with the permissions the profile service reports now.
 *
 * @param credential the caller's bearer credential, for calls to services the Core has not absorbed yet.
 *                   It goes away with the server-side session.
 */
public record CurrentUser(String id, Set<String> permissions, String credential) {

    public boolean can(String permission) { return permissions.contains(permission); }

    /** The caller, or null on routes that allow anonymous access. */
    public static CurrentUser get() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.getPrincipal() instanceof CurrentUser user ? user : null;
    }

    /** The caller, on a route whose {@link AccessRules} require a signed-in account. */
    public static CurrentUser require() {
        CurrentUser user = get();
        if (user == null) throw new IllegalStateException("this route is not protected by AccessRules");
        return user;
    }

    @Override
    public String toString() { return "CurrentUser[" + id + "]"; }
}
