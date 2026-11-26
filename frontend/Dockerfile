FROM node:24-alpine3.24 AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
# The nginx image fills ${PROGRESS_UPSTREAM} in templates when the container starts; nginx's own $variables stay.
COPY nginx.conf /etc/nginx/templates/default.conf.template
ENV PROGRESS_UPSTREAM=http://core:8084
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
