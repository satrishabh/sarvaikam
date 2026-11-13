# Backend content and reels

See the [visual storage map](content-storage-map.html) and [database structure and direct-authoring guide](content-storage-structure.md) for the six prioritized engineering paths, table relationships, bucket layout, and upload/SQL examples.

For daily authoring, use the [admin Content studio workflow](admin-content-studio.md): create subjects/courses, write or upload lesson steps, attach resources, publish reels, and edit path priority without SQL.

Lesson and practice bodies use the existing private `GCP_CONTENT_BUCKET`. Categories, courses (topics), lesson titles, ordering, levels, access flags, and object references stay in the content PostgreSQL database. Attachments continue through the signed upload/download APIs. Browsers read lesson and practice bodies through the backend, preserving exclusive lesson checks.

## Migration and rollout

1. Back up the content database. Keep the bucket private and enable object versioning/retention appropriate to your environment.
2. Configure `GCP_CONTENT_BUCKET` and the existing ADC/Workload Identity and `GCP_SIGNING_SERVICE_ACCOUNT`. Body uploads reuse the attachment storage client and its impersonation credentials. The runtime needs object create/read access; signed attachment operations retain their existing permissions.
3. Provision a **separate PostgreSQL database** named `sarvaikam_reels`, preferably with its own database role. Supply `REELS_DB_URL` (JDBC URL), `REELS_DB_USER`, and `REELS_DB_PASSWORD` to the content-service. Flyway creates the reels tables in that database. Do not point this URL to the content database. For Kubernetes, create the `sarvaikam-reels` Secret with these three keys. For the all-in-one deployment, supply the same variables through its runtime Secret/envFrom.
4. Build and roll out the application. Main-database Flyway adds object references without deleting existing bodies. Startup uploads current database lesson text in batches, then clears each text only after upload succeeds. A conditional update protects concurrent CMS edits. Practice content is inserted once and moved to the bucket in the same manner. Service startup fails if a configured bucket cannot be used; fix credentials/access and restart to retry.
5. Verify lesson reads, exclusive access, practice exercises, and Content studio saves. Check `SELECT count(*) FROM lessons WHERE content_object IS NULL` to confirm migration. Publish a reviewed reel from Reel studio and check `/api/content/reels`.

Compose runs `reels-postgres` with its own volume on host port 5433. Embedded development creates a separate `sarvaikam_reels` database even on existing volumes. External databases must be provisioned before deployment. With no reels URL the main catalogue still runs, and reels report 503 with a configuration message. Without a bucket, local development keeps bodies in PostgreSQL. A bucket-backed lesson cannot be edited with bucket configuration removed.

Object names are immutable. A failed database transaction can leave an unreferenced object; old revisions and deleted content also remain for recovery. Do not apply an age-only deletion rule to body prefixes because published bodies can be old. Clean up only objects verified to have no database references, after a suitable grace period and backup. Rolling back code after migration requires restoring body text from object references or restoring the database backup; older code cannot read bucket-only bodies.

This change prepares the code and deployment configuration. It does not itself deploy the application or upload local editorial drafts, source references, or the large workspace ZIP. Existing published database bodies move when the new service starts with bucket access. Source seed JSON remains a bootstrap/handoff artifact, rather than the runtime content source.

## Google Drive storage (personal account)

`STORAGE_BACKEND` selects where lesson/practice/reel bodies and attachments live: `gcs` (default, the bucket above) or `drive` (the owner's Google Drive). The database layout is identical; only object references point to a different store, so pick the backend before content is migrated and do not switch it on a database that already holds references unless the objects are copied too.

With `drive`, content-service signs in as the Drive owner using an OAuth refresh token limited to the `drive.file` scope: it can only see files it created. Everything goes into one app-created folder (`DRIVE_FOLDER_NAME`, default "Sarvaikam content", or a fixed `DRIVE_FOLDER_ID`); each file carries its storage key in its app properties, so the Drive file names are informational only. Do not move these files out of the folder or edit them in Drive; deleting one breaks the lesson or attachment that references it.

- **Uploads** use a Drive resumable session opened for the admin's browser origin; the browser PUTs the file to it directly, as with signed bucket URLs.
- **Downloads** cannot use signed URLs (Drive has none). `/assets/{id}/download` still checks permissions, then returns a 5-minute HMAC-signed `/api/content/assets/{id}/file` link that streams the file through content-service (nginx does not buffer it). Large videos therefore use pod bandwidth.
- **Limits**: files count against the owner's Drive quota, and Drive API per-user rate limits apply (429 responses are reported as "try again shortly").

Setup:

1. In a Google Cloud project, enable the Google Drive API. Configure the OAuth consent screen as External with your Gmail as test user, then **publish it** (In production); in Testing mode refresh tokens expire after 7 days. `drive.file` is non-sensitive, so no verification is needed.
2. Create an OAuth client ID of type **Desktop app**.
3. Run `deploy/drive/authorize-drive.ps1 -ClientId <id> -Namespace <env>`. It prompts for the client secret, opens the browser for consent, and writes `DRIVE_CLIENT_ID`, `DRIVE_CLIENT_SECRET` and `DRIVE_REFRESH_TOKEN` to the `sarvaikam-drive` secret without printing them.
4. In the environment's values set `STORAGE_BACKEND=drive` and add `sarvaikam-drive` to `envFrom`. The entrypoint refuses to start if any of the three variables is missing.

Revoking the app at https://myaccount.google.com/permissions stops all reads and uploads until step 3 is repeated.

## Reel template

Reel studio in Content studio supports a stable slug, course, existing lesson step, heading, short content (one point per line), source name, HTTPS source URL, and draft/published status. Course name and step number resolve from the current catalogue. Source attribution is an explicit editorial field, displayed last as a link. Reels start empty until authored and published; browser sample data and automatic lesson extraction have been removed.

```json
{
  "slug": "java-build-basics",
  "courseSlug": "java",
  "lessonSlug": "full-stack-core-java",
  "heading": "From source to a repeatable build",
  "content": "The JDK supplies the development tools.\nKeep the project JDK and build configuration aligned.",
  "sourceName": "Original reference title or author",
  "sourceUrl": "https://example.com/original-reference",
  "published": false
}
```

| Method | Endpoint under `/api/content` | Behavior |
| --- | --- | --- |
| GET | `/reels?limit=20&offset=0` | Published reels; filters inaccessible/deleted lessons before pagination |
| GET | `/admin/reels?limit=100&offset=0` | Drafts and published reels, requires `content.manage` |
| PUT | `/admin/reels` | Validates and upserts the template by slug, requires `content.manage` |
| DELETE | `/admin/reels/{slug}` | Deletes the reel record, requires `content.manage` |
| GET | `/practice` | Backend practice question collection |

The reel API is reusable by a future mobile application. No cross-database foreign key is assumed: reads and writes resolve the current catalogue and reads enforce current lesson access. Authentication uses the same application bearer tokens. Reels have an independent migration history and database lifecycle; the content service currently hosts their API. Reel body text uses `reel-bodies/` in the bucket when configured; metadata and source attribution stay in the reels database. Practice answer drafts remain private browser-local user state.
