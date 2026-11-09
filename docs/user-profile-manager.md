# Sarvaikam profile management and private resources

## Ownership and user journeys

Learn uses the existing [User Profile Manager](https://github.com/satrishabh/user-profile-manager), hosted at `https://profile.sarvaikam.com`. Its local checkout was inspected at commit `d5cd7e4`. It is a Keycloak service, not a custom REST identity server. Credentials, email verification, password recovery, and identity sessions stay there. Learn owns business applications, application roles, access policies, and learning data.

Registration and login use Learn's own React forms at `/login`. They call Learn's same-origin NestJS API, which calls Profile Manager from the server. The browser receives an app token, never an identity service secret or refresh token. The old Keycloak JavaScript login redirect is no longer used by these screens.

Normal registration needs **email verification, with no administrator approval**. A verified normal user can apply for business membership at `/profile/business`. The account remains a normal user while pending. An administrator reviews the organization, website, and learning goals at `/admin/users`, adds feedback, and approves or declines the application. Approval grants the Business role; there is no payment step. Declined applicants can update their details and apply again.

Email verification and password-reset messages are sent by Profile Manager using its existing SMTP configuration. The secure action links in these messages still lead to Profile Manager's action pages. Learn provides the request forms; fully replacing those action pages would require a custom Keycloak theme or extension in the separate repository. This change does not pretend that Keycloak exposes a public headless registration or verification endpoint.

```mermaid
sequenceDiagram
  participant Browser as Learn UI
  participant Auth as Learn auth-service
  participant Profile as profile.sarvaikam.com
  participant DB as Learn database
  Browser->>Auth: Register name, email, password
  Auth->>Profile: Admin API creates unverified identity
  Auth->>Profile: Send VERIFY_EMAIL action email
  Profile-->>Browser: Verification link via email
  Browser->>Auth: Sign in with verified email/password
  Auth->>Profile: Confidential-client token request
  Profile-->>Auth: Signed access token and refresh token
  Auth->>Profile: Validate signature through JWKS
  Auth->>DB: Resolve identity by stable subject and current app access
  Auth-->>Browser: 5-minute app token + profile; HttpOnly refresh cookie
  Browser->>Auth: Business application
  Auth->>DB: PENDING; role remains USER
  Note over Auth,DB: Admin review changes role to BUSINESS and writes audit event
```

## Access model

| Role | Default access | Approval |
|---|---|---|
| Normal user (`USER`) | Standard library, own progress, downloads for readable lessons | Email verification only |
| Business (`BUSINESS`) | Normal access plus exclusive lessons and their downloads, free | Admin business review |
| Admin (`ADMIN`) | All content, content editing, all candidates/progress, roles, reviews, audit log | Trusted bootstrap or another admin |

Admins configure the other roles through four permissions:

- `content.exclusive`: read exclusive lessons.
- `content.manage`: create/update/delete categories, topics, lessons, and files. Content managers can read exclusive lessons so they can edit them.
- `assets.download`: request temporary download links for resources on lessons they can read.
- `candidates.view`: view registered profiles, application details, and candidate learning progress. This permission exposes personal data and should be granted deliberately.

User-management mutations, business reviews, role-policy changes, and the audit log always require an actual Admin role. Granting `content.manage` or `candidates.view` does not grant role administration. Admin access is fixed. Admins cannot demote or suspend themselves, and active-admin changes are serialized to avoid concurrent lockouts. A Business role cannot be granted before an approved business application exists.

The first sign-in imports `content-admin` from Profile Manager as Admin; all other new identities start as User. Subsequent app role changes are authoritative in Learn and are not overwritten on each sign-in. A realm `business` claim cannot skip Learn's review. To revoke an existing Learn administrator, update access in Learn as well as any identity-provider role. Suspending an account in Learn makes existing app sessions unusable at the next API request.

Content and progress APIs verify the app JWT and query `/api/auth/me` for **current** authorization. They fail closed when the session service cannot validate access. Exclusive content bodies and signed downloads are checked server-side. Public topic/lesson titles remain discoverable, with Exclusive badges. App tokens expire after five minutes; refresh tokens live only in a same-site, HttpOnly cookie and are exchanged on the server. Logout closes the profile session and clears local credentials. Previously copied app tokens can remain valid until their five-minute expiry; suspension takes effect immediately through live access checks.

## Profile Manager configuration required before live sign-in

The existing `sarvaikam-learn` browser client deliberately has direct grants disabled. Keep that client unchanged. The custom email/password UI requires the dedicated server-side clients described in [`deploy/profile-manager-clients.example.json`](../deploy/profile-manager-clients.example.json).

Create these **inside the existing `sarvaikam` realm**, using the Admin API/CLI or console:

1. `sarvaikam-learn-api`: confidential, direct access grants enabled, standard/implicit flows off, service accounts off, no browser origins. Keep `profile`, `email`, and `roles` client scopes enabled so verified email and initial admin roles are present in access tokens.
2. `sarvaikam-learn-registration`: confidential, service account enabled, other login flows off. Grant its service account the realm's `realm-management` client roles `manage-users` and `query-users`. It only needs the Learn realm; do not use a master-realm administrator.
3. Generate separate client secrets and provide them to Learn's auth-service through the runtime secret manager. Never put either secret in a `VITE_*` variable, browser bundle, or Git.
4. Keep email verification, duplicate-email prevention, brute-force protection, the 12-character password policy, and working SMTP enabled. Match required user-profile attributes to the form (name and email); check single-word names if the realm requires a last name.
5. Grant the trusted first administrator `content-admin` **before their first Learn sign-in**. For an existing Learn account, have another Learn admin promote it; operator recovery may update its app role explicitly in the database after verifying the identity subject.

The JSON is a configuration example, not a realm replacement or an automatic migration. Startup realm import does not update an existing realm. No live Profile Manager configuration or production identities were changed by this implementation.

Direct password grants do not support the same interactive MFA/passkey journeys as Authorization Code + PKCE. They are isolated in the confidential server client to satisfy the custom API login requirement. If those interactive features become required, use a custom Profile Manager authentication extension or the standard browser authorization flow.

### Server environment

```dotenv
PROFILE_ISSUER=https://profile.sarvaikam.com/realms/sarvaikam
PROFILE_API_CLIENT_ID=sarvaikam-learn-api
PROFILE_API_CLIENT_SECRET=<runtime-secret>
PROFILE_REGISTRATION_CLIENT_ID=sarvaikam-learn-registration
PROFILE_REGISTRATION_CLIENT_SECRET=<different-runtime-secret>
JWT_SECRET=<shared-random-value-at-least-32-bytes>
APP_ENV=prod
DB_SYNCHRONIZE=false
AUTH_SERVICE_URL=http://auth-service:8082
CONTENT_SERVICE_URL=http://content-service:8081
```

`APP_ENV=prod` makes refresh cookies Secure; local HTTP development uses `APP_ENV=dev`. The cookie path is `/api/auth/session`, SameSite is Strict, and no broad CORS policy is enabled. Browser session requests require `X-Sarvaikam-Client: web`. Login, registration, email requests, and refresh have bounded per-instance IP rate limits; configure shared ingress limits when running multiple replicas. Profile Manager remains responsible for password hashing and credential brute-force protection.

Apply all three auth SQL migrations in order to the existing auth database before deploying with synchronization disabled:

```text
services/auth-service/migrations/000_users_baseline.sql
services/auth-service/migrations/001_oidc_identity.sql
services/auth-service/migrations/002_profile_access.sql
```

The baseline creates the users table when absent and preserves existing records. Content Flyway migration `V2__exclusive_and_assets.sql` runs automatically and preserves all existing lessons as standard content. Existing local identities are never automatically linked by email; migrate stable OIDC subjects deliberately.

Kubernetes auth deployment reads `PROFILE_API_CLIENT_SECRET` and `PROFILE_REGISTRATION_CLIENT_SECRET` from `sarvaikam-secrets`. Inject those keys securely before rollout. Single-image deployment inherits the same environment variables and uses localhost for sibling service URLs.

## API reference

All auth paths below are under `/api/auth`. Authenticated requests need the Learn app bearer token, except `/oidc/exchange`, which requires a Profile Manager token. Session requests require the custom browser header above.

| Method | Path | Purpose |
|---|---|---|
| POST | `/session/register` | `{name,email,password}`; create unverified identity and send verification |
| POST | `/session/login` | `{email,password}`; return `{token,user}` and set refresh cookie |
| POST | `/session/refresh` | Refresh cookie to a new app session |
| POST | `/session/logout` | End profile session and clear refresh cookie |
| POST | `/session/verify-email` | `{email}`; resend verification without disclosing account existence |
| POST | `/session/recover` | `{email}`; request password-reset email |
| GET | `/me` | Current live profile and permissions |
| POST | `/me/business-application` | `{organization,website,reason}` |
| GET | `/admin/users?q=&status=&page=1` | Search profiles; 25 per page; requires `candidates.view` |
| POST | `/admin/users/:id/business-review` | Admin: `{decision: APPROVED or REJECTED, note}` |
| PATCH | `/admin/users/:id` | Admin: `{role?,disabled?}` |
| GET | `/admin/roles` | Admin: all three role policies |
| PUT | `/admin/roles/:role` | Admin: `{permissions:[...]}`; USER or BUSINESS only |
| GET | `/admin/audit` | Admin: latest 100 application/access events |

`GET /api/progress/users/:userId` exposes candidate completions only with `candidates.view`. Marking a lesson complete validates its topic and read access with content-service before inserting progress.

## Validation

- Email: trim and lowercase; standard syntax validation, maximum 254 characters, and strict boolean `email_verified === true` in the signed identity token.
- Session tokens: RS256 Profile Manager signature/JWKS, exact issuer, allowed client/authorized party, nonempty subject, expiry, and verified email. App APIs accept HS256 app sessions only.
- Registration: trimmed name 2–80 characters without control characters; password 12–128 characters, confirmation on the client, and the provider's password policy. Passwords and identity refresh tokens are never persisted by Learn.
- Business: organization 2–160 characters, HTTPS website up to 500, reason 20–2,000, and review feedback 3–1,000. Pending or privileged accounts cannot submit duplicate applications.
- Role and review values: explicit allowlists; unknown JSON properties rejected. UUID route validation, bounded search/page parameters, atomic review transitions, and audit entries for mutations.
- Lessons: bounded slug/title/Markdown lengths, allowed slug format, and step number 1–10,000. Raw HTML in Markdown is not rendered.
- Files: declared MIME allowlist, path/control-character rejection in filenames, signed content length, maximum upload size, and object metadata verification before publishing. This is metadata validation, not file-content malware scanning.

## Private GCP bucket for large resources

Lesson Markdown stays in PostgreSQL. Videos, archives, PDFs, and other large resources are attached to lessons and uploaded directly to a private GCS bucket. This avoids loading large files into auth/content request bodies or the app database.

1. Configure `infra/terraform/gcp/content_origins` with exact Learn origins. For local uploads, explicitly include `http://localhost:5173`. Apply the Terraform stack through your normal infrastructure process.
2. Read the `content_bucket` and `content_service_account` outputs. Set `GCP_CONTENT_BUCKET` and `GCP_SIGNING_SERVICE_ACCOUNT` on content-service.
3. On GKE, apply the ServiceAccount/ConfigMap example in [`gcp-storage.example.yaml`](../deploy/k8s/gcp-storage.example.yaml) after replacing placeholders. Patch content-service's pod spec with `serviceAccountName: content-service`. The IAM binding assumes namespace `sarvaikam`; adapt it if deploying elsewhere.
4. Use Application Default Credentials / Workload Identity. The Terraform service account has bucket-scoped Object User and permission to sign as itself through IAM Credentials. `ImpersonatedCredentials` signs URLs without downloading a private key. For local ADC impersonation, the developer's source identity also needs permission to impersonate that account.
5. Save a lesson in Content studio, select a resource, and keep the page open while uploading. The default limit is 2 GiB. `GCP_MAX_UPLOAD_BYTES` can lower the server limit; the current UI caps uploads at 2 GiB.

The bucket enforces uniform access and public-access prevention. CORS is limited to configured origins. Versioning is enabled; excess noncurrent generations are pruned after three newer generations. `force_destroy` is false to protect stored content.

Uploads use a V4-signed PUT URL valid for 15 minutes, bound to a generated object name, MIME type, exact byte length, and `ifGenerationMatch=0` to prevent overwrites/replay. Completion verifies the stored object before making it visible and records its generation. Downloads require both current lesson access and `assets.download`; they issue a five-minute URL for that exact generation with attachment disposition. A signed link remains usable by its holder until it expires, even after a permission change. Deleting a resource or lesson deletes the live object; bucket versioning/soft-delete retention may retain recoverable copies according to GCP policy.

A failed network upload can be retried; if upload succeeds but final verification fails temporarily, use Retry file verification. PUT uploads restart on retry; resumable upload sessions are not part of this version. Pending metadata and objects orphaned by interrupted or deleted uploads should be periodically reconciled against `lesson_assets`; automatic orphan reconciliation is not yet scheduled. The existing `cotent_bucket` was connected to the development deployment on 9 November 2026; see [the live configuration and verification record](java-content.md#selected-resource-storage).

Content storage API paths under `/api/content`:

| Method | Path | Purpose |
|---|---|---|
| GET | `/lessons/:lessonId/assets` | List ready resource metadata, subject to lesson access |
| POST | `/admin/lessons/:lessonId/assets/upload` | `{filename,contentType,size}`; get signed URL and required headers |
| POST | `/admin/assets/:id/complete` | Verify metadata and publish resource |
| GET | `/assets/:id/download` | Get authorized temporary download URL |
| DELETE | `/admin/assets/:id` | Delete resource and live object |

## Checks and rollout

Automated tests cover invalid/unverified identities, ordinary onboarding, approval bypass attempts, app role persistence, suspension, self-lockout prevention, policy updates, validation, CSRF headers, exclusive lesson/file access, candidate-progress permissions, and current-session validation. The browser checks use mocked APIs; they are not a substitute for staging against your actual Profile Manager and GCP project.

Run:

```text
cd services/auth-service && npm test
cd services/content-service && mvn test
cd services/progress-service && go test ./...
cd frontend && npm run build
```

Before production rollout, complete the client/secret and SQL setup above, then test: registration email delivery, verification, login, refresh after page reload, logout, password recovery, normal access, pending/declined/approved business journeys, administrator permissions, role changes on an existing session, and a real bucket upload/download from an approved browser origin.

The design rationale and open-source Penpot workflow are documented in [`profile-design.md`](profile-design.md).

### Sign-in destinations

Ordinary sign-ins open the learning home page (`/`). The profile page (`/profile`) shows account details and an optional link to business membership. Only an explicit business entry (`/login?account=business`) opens the business application after sign-in. Pending applications keep their existing learning access.
