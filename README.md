# Sarvaikam - Learn Trending Tech, Step by Step

A full-stack learning platform with step-by-step roadmaps for trending technology and interview preparation:
Terraform, VMs, Docker, Kubernetes, AWS / Azure / GCP, Java, Node.js, Python, Go, ML, Deep Learning,
Transformers, LLMs, MLOps, vector databases, Spring Boot, TypeScript/NestJS, microservices, Redis,
Kafka, SQL, Databricks, Snowflake, CI/CD, Helm/GitOps and observability.

**33 topics, 176 lessons** ship as seed content, including guided behavioral, coding, system design, SQL, and DevOps/cloud interview prep. Admins can add or edit lessons in the built-in CMS.

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

Seed files live in `services/content-service/src/main/resources/seed/` and load in filename order:

| File | Contents |
|---|---|
| `00-foundations.json` | 7 categories, 20 topics, core step-by-step lessons |
| `10-advanced.json` | Advanced lessons and projects appended to existing topics |
| `20-trending.json` | New: DevOps category (CI/CD, Helm/GitOps, Observability), MLOps, Vector DBs, Microservices, Redis, Kafka |
| `30-interview-prep.json` | Interview prep tracks: behavioral, coding, system design, SQL, and DevOps/cloud |

On every startup the loader merges all files and inserts **only missing** categories, topics and lessons,
so you can add a new file (for example `30-my-topics.json`) and redeploy without touching edits made in
the CMS. Lessons are Markdown (GitHub-flavoured: tables and code blocks). Raw HTML is not rendered.

File format:

```json
[{ "slug": "category-slug", "name": "...", "description": "...",
   "topics": [{ "slug": "topic-slug", "name": "...", "summary": "...", "level": "BEGINNER",
                "lessons": [{ "slug": "lesson-slug", "title": "...", "content": "markdown" }] }] }]
```

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
