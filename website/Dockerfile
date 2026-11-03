FROM nginxinc/nginx-unprivileged:alpine

COPY index.html styles.css favicon.svg /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf

RUN nginx -t

EXPOSE 8080
