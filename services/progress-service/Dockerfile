FROM golang:1.27.3-alpine3.24 AS build
WORKDIR /src
COPY go.mod go.sum ./
COPY *.go ./
RUN go mod download && CGO_ENABLED=0 go build -ldflags="-s -w" -o /out/progress-service .

FROM gcr.io/distroless/static-debian12
COPY --from=build /out/progress-service /progress-service
EXPOSE 8083
USER nonroot
ENTRYPOINT ["/progress-service"]
