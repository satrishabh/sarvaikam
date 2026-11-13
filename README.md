# Sarvaikam - Learn Trending Tech, Step by Step

Lesson and practice bodies now use the private GCP bucket when configured; metadata stays in PostgreSQL. Reels have a dedicated database, backend feed, and Reel studio with course, step, heading, content, and source attribution. See [backend content storage and rollout](docs/backend-content.md).

Engineering paths load from the backend in this order: Gen AI, AI / ML, Cloud Platform, Full Stack, Backend, and Forward Deployed. See the [visual database and bucket map](docs/content-storage-map.html) and [direct-authoring guide](docs/content-storage-structure.md).

A full-stack learning platform with step-by-step roadmaps for trending technology and interview preparation:
Terraform, VMs, Docker, Kubernetes, AWS / Azure / GCP, Java, Node.js, Python, Go, ML, Deep Learning,
Transformers, LLMs, MLOps, vector databases, Spring Boot, TypeScript/NestJS, microservices, Redis,
Kafka, SQL, Databricks, Snowflake, CI/CD, Helm/GitOps and observability.

**33 topics, 194 lessons** ship as seed content, including guided behavioral, coding, system design, SQL, and DevOps/cloud interview prep. Admins can add or edit lessons in the built-in CMS.

Every topic groups lessons into **Starter → Intermediate → Advanced → optional Deep Dive** levels. Content studio lets authors assign levels as new material arrives. See [learning levels](docs/learning-levels.md).

## Architecture

```text
                         +---------------------------+
 Browser  ---- :80 ----> | frontend (React + nginx)  |   compose: nginx is the API gateway
                         +---------------------------+   k8s:     Ingress is the API gateway
                            |          |          |
             /api/content   |  /api/auth|          | /api/progress
                            v          v          v
         +------------------+  +--------------+  +------------------+
         | content-service  |  | auth-service |  | progress-service |
         | Java 21          |  | NestJS (TS)  |  | Go 1.22          |
         | Spring Boot 3    |  | TypeORM      |  | chi + pgx        |
         +------------------+  +--------------+  +------------------+
                  \                  |                  /
                   +---------- PostgreSQL 16 ----------+
                 categories/topics/lessons | users | lesson_progress
```

| Service | Port | Responsibility | Tables owned |
|---|---|---|---|
| `services/content-service` | 8081 | Categories, topics, lessons, search, admin CMS API, seeding | `categories`, `topics`, `lessons` (Flyway) |
| `services/auth-service` | 8082 | Validate User Profile Manager OIDC tokens, issue app sessions, `/me` | `users` |
| `services/progress-service` | 8083 | Mark lessons complete, progress per topic | `lesson_progress` |
| `frontend` | 80 / 5173 | React SPA: roadmaps, lessons (Markdown), progress, login, admin editor | - |

**Auth and profiles:** Learn has its own registration/login UI backed by the existing
[User Profile Manager](https://github.com/satrishabh/user-profile-manager) API at `profile.sarvaikam.com`.
Normal users need email verification only; business applications are approved in `/admin/users` and
receive free exclusive access. Admins manage role permissions, candidates, and content. Content and
progress services check current access on every authenticated request. Large lesson resources use a
private GCP bucket with temporary upload/download URLs. See the complete
[configuration, API, migration, and rollout guide](docs/user-profile-manager.md) and
[design rationale / Penpot workflow](docs/profile-design.md).

## Quick start (Docker)

```bash
cp .env.example .env        # change JWT_SECRET and passwords
docker compose up --build
```

Configure the two server-only Profile Manager clients and runtime secrets described in the guide
before signing in. Grant the first trusted administrator `content-admin` before their first Learn
sign-in; manage subsequent app roles in Learn. Apply auth SQL migrations before production rollout.

## Local development (without Docker for the apps)

```bash
docker compose up -d postgres

cd services/content-service && mvn spring-boot:run          # :8081
cd services/auth-service && npm install && npm run dev      # :8082
cd services/progress-service && go run .                    # :8083
cd frontend && npm install && npm run dev                   # :5173 (Vite proxies /api/*)
```

## API reference

All paths go through the gateway (`http://localhost`).

### Content - `/api/content`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/categories` | - | All categories with topic summaries |
| GET | `/topics/{slug}` | - | Topic with its ordered lesson list |
| GET | `/topics/{topicSlug}/lessons/{lessonSlug}` | Public or exclusive permission | Full lesson (Markdown) with previous/next |
| GET | `/search?q=` | - | Search topics by name/summary |
| PUT | `/admin/categories` | content.manage | Create/update category by slug |
| PUT | `/admin/topics` | content.manage | Create/update topic by slug |
| PUT | `/admin/lessons` | content.manage | Create/update lesson by topic + slug; includes `exclusive` |
| DELETE | `/admin/lessons/{id}` | content.manage | Delete lesson and resources |
| GET | `/actuator/health` | - | Health |

### Auth - `/api/auth`
| Method | Path | Body | Description |
|---|---|---|---|
| POST | `/oidc/exchange` | Bearer token from the User Profile Manager | Returns `{token, user}` for Learn APIs |
| POST | `/session/register` | `{name,email,password}` | Custom UI registration; sends verification email |
| POST | `/session/login` | `{email,password}` | Custom UI login; app token and HttpOnly refresh cookie |
| POST | `/session/refresh` | Refresh cookie | Refresh app session |
| POST | `/session/logout` | Refresh cookie | End session |
| GET | `/me` | Bearer token | Current user |
| GET | `/health` | - | Health |

### Progress - `/api/progress` (Bearer token required)
| Method | Path | Description |
|---|---|---|
| GET | `/me` | All completed lessons |
| GET | `/users/{userId}` | Candidate progress; requires candidates.view |
| GET | `/me/topics/{topicSlug}` | `{completedLessonIds}` for a topic |
| POST | `/lessons/{lessonId}/complete` | Body `{topicSlug}` - mark complete (idempotent) |
| DELETE | `/lessons/{lessonId}/complete` | Undo |
| GET | `/health` | Health (no auth) |

## Content and seeding

The learning interface includes role-based paths, a searchable catalogue, an actionable skill map,
and a practice room with eight timed exercises, hints, browser-local drafts, and self-review.
Completion records learning activity; the app does not provide automated grading or certify interview readiness.
See [the content handoff guide](docs/content-handoff.md) for what to provide and where it is stored,
and [the redesign notes](docs/learning-experience.md) for behavior, validation, and known limits.
The [mobile and reader design notes](docs/mobile-reader-design.md) cover the app-style navigation,
AIO-inspired details drawer, and saved reading preferences.

Seed files live in `services/content-service/src/main/resources/seed/` and load in filename order:

| File | Contents |
|---|---|
| `00-foundations.json` | 7 categories, 20 topics, core step-by-step lessons |
| `10-advanced.json` | Advanced lessons and projects appended to existing topics |
| `20-trending.json` | New: DevOps category (CI/CD, Helm/GitOps, Observability), MLOps, Vector DBs, Microservices, Redis, Kafka |
| `30-interview-prep.json` | Interview prep tracks: behavioral, coding, system design, SQL, and DevOps/cloud |
| `40-java-full-stack.json` | Eight Java full-stack study guides with practice tasks and self-review; see [intake notes](docs/java-content.md) |
| `50-java-concurrency-jvm.json` | Ten Java 21 lessons on threading, locks, virtual threads, JVM internals, GC, performance and clean code |

On every startup the loader merges all files and inserts **only missing** categories, topics and lessons,
so you can add a new file (for example `30-my-topics.json`) and redeploy without touching edits made in
the CMS. Lessons are Markdown (GitHub-flavoured: tables and code blocks). Raw HTML is not rendered.

File format:

```json
[{ "slug": "category-slug", "name": "...", "description": "...",
   "topics": [{ "slug": "topic-slug", "name": "...", "summary": "...", "level": "BEGINNER",
                "lessons": [{ "slug": "lesson-slug", "title": "...", "content": "markdown" }] }] }]
```

## File storage (Google Cloud Storage or Google Drive)

Lesson, practice and reel bodies and lesson attachments (PDF, ZIP, video) are stored outside PostgreSQL.
`STORAGE_BACKEND` picks the store; the database only keeps object references.

| `STORAGE_BACKEND` | Where files live | Settings |
|---|---|---|
| `gcs` (default) | Private bucket; browser uploads/downloads use short-lived signed URLs | `GCP_CONTENT_BUCKET`, `GCP_SIGNING_SERVICE_ACCOUNT` (Workload Identity, no keys) |
| `drive` | A "Sarvaikam content" folder in your personal Google Drive | `DRIVE_CLIENT_ID`, `DRIVE_CLIENT_SECRET`, `DRIVE_REFRESH_TOKEN`; optional `DRIVE_FOLDER_ID` / `DRIVE_FOLDER_NAME` |

With neither configured (local dev), bodies stay in PostgreSQL and attachments are disabled.
Choose the backend before content is migrated: switching later needs the files copied too.

### Using Google Drive

The app signs in as you with the `drive.file` scope, so it can see **only the files it creates**, never the
rest of your Drive. Uploads go from the browser straight to Drive (resumable upload session). Downloads keep
the normal permission checks, then stream through content-service behind a 5-minute signed link, because
Drive has no signed URLs.

One-time setup:

1. In Google Cloud console, enable the **Google Drive API**.
2. **OAuth consent screen**: External, add your Gmail as a test user, then **Publish app** (In production).
   In Testing mode Google expires refresh tokens after 7 days. `drive.file` needs no Google verification.
3. **Credentials > Create OAuth client ID > Desktop app**; note the client ID and secret.
4. Authorize and store the credentials in Kubernetes (prompts for the secret, opens the browser, prints no tokens):

   ```powershell
   ./deploy/drive/authorize-drive.ps1 -ClientId <id>.apps.googleusercontent.com -Namespace dev
   ```

5. In the environment's Helm values, set `STORAGE_BACKEND=drive` and add the secret:

   ```yaml
   env:
     - {name: STORAGE_BACKEND, value: drive}
   envFrom:
     - secretRef: {name: sarvaikam-drive}
   ```

   The container refuses to start if any `DRIVE_*` credential is missing.

Keep in mind:

- Files count against your Drive quota, and Drive API rate limits apply (shown as "try again shortly").
- Large videos stream through the pod, so they use its bandwidth.
- Don't move, edit or delete the app's files in Drive; the lessons reference them.
- Revoking the app at https://myaccount.google.com/permissions stops reads and uploads until step 4 is rerun.

More detail: [docs/backend-content.md](docs/backend-content.md#google-drive-storage-personal-account).

## Kubernetes

```bash
# needs an ingress-nginx controller in the cluster
kubectl apply -k deploy/k8s
```

`deploy/k8s` contains namespace, secret (demo values - replace), Postgres StatefulSet, a Deployment +
Service per app with probes and resource limits, and an Ingress. Set real image names/tags in
`kustomization.yaml` (`images:`). For production, point `DB_HOST` / `CONTENT_DB_URL` /
`PROGRESS_DATABASE_URL` at the managed database created by Terraform and drop `postgres.yaml`.

## Terraform (AWS / Azure / GCP)

| Folder | Creates |
|---|---|
| `infra/terraform/aws` | VPC (3 AZs), EKS with managed node group, ECR repos, RDS PostgreSQL 16 |
| `infra/terraform/azure` | Resource group, VNet, AKS (autoscaling), ACR with AcrPull, PostgreSQL Flexible Server (private) |
| `infra/terraform/gcp` | VPC, GKE Autopilot, Artifact Registry, Cloud SQL PostgreSQL 16 (private IP) |

```bash
cd infra/terraform/aws        # or azure (-var subscription_id=...) / gcp (-var project_id=...)
terraform init
terraform plan
terraform apply
terraform output kubeconfig_command
```

Then build and push images to the registry output, update `deploy/k8s/kustomization.yaml`, and
`kubectl apply -k deploy/k8s`. Uncomment the remote backend block in each `main.tf` for team use.
These stacks create billable resources - run `terraform destroy` when done.

## Building

### Single image (CI/CD, Kaniko)

The root `Dockerfile` builds everything into **one image**: the React frontend, Spring Boot, NestJS and Go
services, run by supervisord behind nginx on port **8080**, plus an embedded PostgreSQL.

```bash
docker build -t sarvaikam .
docker run -p 8080:8080 -v sarvaikam-data:/var/lib/postgresql/data sarvaikam
# Kaniko: default --context (repo root) and --dockerfile=Dockerfile work as-is
```

| Env var | Default | Notes |
|---|---|---|
| `PORT` | `8080` | Port nginx listens on |
| `EMBEDDED_DB` | `true` | `false` to use an external PostgreSQL |
| `DB_HOST` / `DB_PORT` / `DB_SSLMODE` | `127.0.0.1` / `5432` / `disable` | Set for an external DB (e.g. RDS, `DB_SSLMODE=require`) |
| `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` | `sarvaikam` | DB credentials |
| `JWT_SECRET` | demo value | **Override in every real environment** (>= 32 chars) |
| `PROFILE_API_CLIENT_SECRET` / `PROFILE_REGISTRATION_CLIENT_SECRET` | Required at runtime | Server-only Profile Manager clients; see integration guide |

Health check: `GET /api/content/actuator/health`.

### Per-service images (docker compose)

`docker compose build` builds the four services as separate images (used by `deploy/k8s`).

## Project layout

```text
docker-compose.yml   .env.example
frontend/                 React + Vite + Tailwind SPA, nginx gateway config
services/content-service  Spring Boot (domain, service, api, security, seed)
services/auth-service     NestJS (auth controller/service, user entity, DTOs)
services/progress-service Go (main.go)
deploy/k8s/               Kustomize manifests
infra/terraform/          aws/ azure/ gcp/
```
