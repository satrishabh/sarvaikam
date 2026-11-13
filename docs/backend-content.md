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
