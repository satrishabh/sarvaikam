# Sarvaikam Core

The modular monolith from [docs/platform-blueprint.md](../../docs/platform-blueprint.md) §2.2. It is one Spring Boot 4 application built with Spring Modulith, and it takes over the other services one route prefix at a time (the strangler pattern).

## Modules

Each direct sub-package of `com.sarvaikam.core` is a module. `ModularityTests` fails the build when a module uses another module's `internal` package or when modules depend on each other in a cycle.

| Module | Status | Public API |
|---|---|---|
| `platform` | Done. Open module: error bodies, `X-Request-Id`, readiness | `ApiErrors`, `Readiness`, `RequestIdFilter` |
| `identity` | Step 1. Accepts auth-service's app JWT and re-reads the account on every request | `CurrentUser`, `AccessRules` |
| `learning` | Serves `/api/progress` with the same API as progress-service | `LessonCompleted`, `LessonReopened` (domain events) |

Modules declare their own routes through an `AccessRules` bean. Routes that no module declares are denied.

Domain events are stored in the `event_publication` table in the same transaction as the change (the transactional outbox). They are retried after a restart and deleted once every listener has handled them.

## Configuration

| Variable | Default | |
|---|---|---|
| `DB_URL`, `DB_USER`, `DB_PASSWORD` | local `sarvaikam` | The same database as content-service. Flyway history is kept in `core_flyway_history` |
| `JWT_SECRET` | none | At least 32 characters. A published placeholder is refused unless `APP_ENV=dev` |
| `AUTH_SERVICE_URL` | `http://localhost:8082` | Used to read the caller's current permissions |
| `CONTENT_SERVICE_URL` | `http://localhost:8081` | Used to check lesson access |
| `CORE_PORT` | `8084` | |
| `READY_URLS` | empty | Extra URLs that `/api/progress/ready` and `/api/core/ready` require |

## Switching `/api/progress` between the Core and progress-service

Both read and write the same `lesson_progress` and `lesson_bookmarks` tables, so you can switch in either direction without moving data.

| Where | Switch |
|---|---|
| All-in-one image | `PROGRESS_BACKEND=core` (the default in dev) or `legacy` (the default in staging and prod) |
| docker compose | `PROGRESS_UPSTREAM=http://progress-service:8083 docker compose up -d frontend` |
| Kubernetes | Change the `/api/progress` backend in `deploy/k8s/ingress.yaml` |

## Tests

Run `mvn test`. `ProgressApiTest` starts PostgreSQL with Testcontainers and is skipped when Docker is not running. The module diagram is written to `target/spring-modulith-docs`.
