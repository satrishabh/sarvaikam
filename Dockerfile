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
RUN npm run build

# Fresh production-only install: "npm prune" can leave build tools behind (e.g. TypeScript 7's native tsc binary).
FROM node:24-alpine3.24 AS auth-deps
WORKDIR /src
COPY services/auth-service/package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund

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
# Everything runs as uid/gid 10001 so the image works under runAsNonRoot + drop ALL capabilities.
RUN apk upgrade --no-cache \
    && apk add --no-cache openjdk21-jre-headless nodejs nginx supervisor postgresql17 postgresql17-contrib tzdata \
    && addgroup -g 10001 -S app && adduser -u 10001 -G app -S -D -H app \
    && mkdir -p /data /tmp/runtime \
    && chown -R 10001:10001 /data /tmp/runtime \
    && chmod 0775 /data

COPY --from=content  /src/target/content-service-1.0.0.jar /app/content/app.jar
COPY --from=auth-deps /src/node_modules /app/auth/node_modules
COPY --from=auth     /src/dist /app/auth/dist
COPY --from=auth     /src/package.json /app/auth/package.json
COPY --from=progress /out/progress-service /app/progress/progress-service
COPY --from=web      /src/dist /usr/share/nginx/html

COPY docker/nginx.conf.template docker/proxy_headers docker/supervisord.conf /etc/sarvaikam/
COPY docker/entrypoint.sh /entrypoint.sh
# Guard against CRLF line endings from Windows checkouts.
RUN sed -i 's/\r$//' /entrypoint.sh /etc/sarvaikam/* && chmod 0755 /entrypoint.sh

# Only non-secret defaults live in the image. Environment-specific defaults and validation
# (dev / staging / prod) are applied by /entrypoint.sh from APP_ENV.
ENV APP_ENV=dev \
    PORT=8080 \
    POSTGRES_DB=sarvaikam \
    POSTGRES_USER=sarvaikam

USER 10001:10001
EXPOSE 8080
VOLUME /data
HEALTHCHECK --interval=30s --timeout=5s --start-period=120s CMD wget -qO- http://127.0.0.1:${PORT}/ready || exit 1
ENTRYPOINT ["/entrypoint.sh"]
