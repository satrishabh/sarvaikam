# Single all-in-one image: React frontend + Spring Boot + NestJS + Go behind nginx, optional embedded PostgreSQL.
# Build from the repo root:  docker build -t sarvaikam .   (Kaniko: default --dockerfile=Dockerfile, --context=repo root)

# ---------- content-service (Java / Spring Boot) ----------
FROM maven:3.9-eclipse-temurin-21 AS content
WORKDIR /src
COPY services/content-service/pom.xml .
RUN mvn -q -B dependency:go-offline
COPY services/content-service/src ./src
RUN mvn -q -B -DskipTests package

# ---------- auth-service (NestJS / TypeScript) ----------
FROM node:24-alpine3.24 AS auth
WORKDIR /src
COPY services/auth-service/package*.json ./
RUN npm ci --no-audit --no-fund
COPY services/auth-service/tsconfig.json ./
COPY services/auth-service/src ./src
RUN npm run build && npm prune --omit=dev

# ---------- progress-service (Go) ----------
FROM golang:1.27.3-alpine3.24 AS progress
WORKDIR /src
COPY services/progress-service/go.mod services/progress-service/go.sum ./
RUN go mod download
COPY services/progress-service/*.go ./
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o /out/progress-service .

# ---------- frontend (React / Vite) ----------
FROM node:24-alpine3.24 AS web
WORKDIR /src
COPY frontend/package*.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# ---------- runtime ----------
FROM alpine:3.24
RUN apk upgrade --no-cache \
    && apk add --no-cache openjdk21-jre-headless nodejs nginx supervisor postgresql17 postgresql17-contrib su-exec tzdata \
    && mkdir -p /run/nginx /run/postgresql /var/lib/postgresql/data \
    && chown -R postgres:postgres /run/postgresql /var/lib/postgresql

COPY --from=content  /src/target/content-service-1.0.0.jar /app/content/app.jar
COPY --from=auth     /src/node_modules /app/auth/node_modules
COPY --from=auth     /src/dist /app/auth/dist
COPY --from=auth     /src/package.json /app/auth/package.json
COPY --from=progress /out/progress-service /app/progress/progress-service
COPY --from=web      /src/dist /usr/share/nginx/html

COPY docker/nginx.conf /etc/nginx/http.d/default.conf
COPY docker/supervisord.conf /etc/supervisord.conf
COPY docker/entrypoint.sh /entrypoint.sh
# Guard against CRLF line endings from Windows checkouts.
RUN sed -i 's/\r$//' /entrypoint.sh /etc/supervisord.conf /etc/nginx/http.d/default.conf && chmod +x /entrypoint.sh

ENV PORT=8080 \
    EMBEDDED_DB=true \
    POSTGRES_DB=sarvaikam \
    POSTGRES_USER=sarvaikam \
    POSTGRES_PASSWORD=sarvaikam \
    JWT_SECRET=change-me-to-a-long-random-secret-of-32-bytes-min \
    ADMIN_EMAIL=admin@sarvaikam.dev \
    ADMIN_PASSWORD=admin12345

EXPOSE 8080
VOLUME /var/lib/postgresql/data
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s CMD wget -qO- http://127.0.0.1:${PORT}/api/content/actuator/health || exit 1
ENTRYPOINT ["/entrypoint.sh"]
