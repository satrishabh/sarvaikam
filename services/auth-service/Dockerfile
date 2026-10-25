FROM node:24-alpine3.24 AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Fresh production-only install: "npm prune" can leave build tools behind (e.g. TypeScript 7's native tsc binary).
FROM node:24-alpine3.24 AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund

FROM node:24-alpine3.24
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
EXPOSE 8082
CMD ["node", "dist/main.js"]
