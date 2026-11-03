FROM nginxinc/nginx-unprivileged:alpine

USER root
RUN apk update && apk upgrade --no-cache
USER 101:101

COPY index.html styles.css favicon.svg /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/nginx.conf

RUN nginx -t

EXPOSE 8080
