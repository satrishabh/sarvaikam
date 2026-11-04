# Learn sign-in with the User Profile Manager

The shared identity provider is maintained in the private
[user-profile-manager repository](https://github.com/satrishabh/user-profile-manager) and is
deployed as its own AIO project. Learn remains in this repository.

## Learn integration

The Learn login page uses OIDC Authorization Code flow with PKCE and offers Google, GitHub,
and email sign-in. The profile manager verifies email addresses and owns credentials and
realm roles. Learn's auth-service validates the profile manager's RS256 access token through
its JWKS endpoint, requires a verified email and the `sarvaikam-learn` client, then issues
the short-lived app JWT used by existing content/progress APIs.

Set these non-secret values for the Learn auth-service:

```text
PROFILE_ISSUER=https://profile.sarvaikam.com/realms/sarvaikam
PROFILE_CLIENT_ID=sarvaikam-learn
```

The frontend defaults to `https://profile.sarvaikam.com`. For local development, set
`VITE_PROFILE_MANAGER_URL=http://localhost:8080` in `frontend/.env.local` (copy
`frontend/.env.example` first).

Before deploying the auth-service update, apply
[`001_oidc_identity.sql`](../services/auth-service/migrations/001_oidc_identity.sql) to the
existing auth database. The migration adds the external OIDC subject mapping without
automatically linking accounts by email. Existing accounts with a matching email must be
migrated deliberately; automatic email linking is intentionally rejected.

Grant `content-admin` in Keycloak to trusted CMS editors. Only that profile-manager role
maps to Learn's `ADMIN` role; normal users receive `USER`.

## AIO and DNS rollout

1. Deploy the private profile-manager repository through AIO as a separate project.
2. Provide the dedicated PostgreSQL connection, bootstrap admin, Google/GitHub credentials,
   and Resend SMTP key using Kubernetes Secrets; do not put secret values in Git or chat.
3. Configure `profile.sarvaikam.com` in AIO and add its displayed A record in Hostinger.
4. Configure the Google and GitHub callback URLs listed in the profile-manager README.
5. Apply the auth database migration, configure the Learn auth-service issuer/client values,
   then build and deploy the Learn repository through AIO.
6. Verify Google, GitHub, and verified email/password sign-in, role mapping, and sign-out.

Until these deployment settings are supplied, the Learn code can build but live sign-in
cannot complete.
