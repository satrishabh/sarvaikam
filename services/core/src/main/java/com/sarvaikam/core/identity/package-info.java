/**
 * Who is calling and what they may do.
 *
 * <p>For now the Core accepts the app JWT that auth-service issues and re-reads the account's current permissions
 * on every request, as the services it replaces do. The server-side session (BFF) replaces this in the next step.
 * Other modules only see {@link com.sarvaikam.core.identity.CurrentUser} and declare their routes with
 * {@link com.sarvaikam.core.identity.AccessRules}, so that switch does not touch them.
 */
@org.springframework.modulith.ApplicationModule(displayName = "Identity")
package com.sarvaikam.core.identity;
