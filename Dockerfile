# Multi-stage: compile a static Go binary, ship it on distroless static.
# linux/amd64 per the flightdeck contract; the final image has no shell or
# package manager, so the Trivy image scan has almost no surface to flag.

FROM --platform=linux/amd64 golang:1.24-alpine AS build
WORKDIR /src
# Cache module downloads separately from source changes.
COPY go.mod go.sum ./
RUN go mod download
COPY . .
# CGO off => fully static binary that runs on distroless static.
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -ldflags="-s -w" -o /golf .

# Distroless static: no shell, no apk/apt, ships a built-in nonroot user.
FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /golf /golf

# Explicit non-root USER (Trivy DS002 reads the Dockerfile, not the base image).
USER nonroot
EXPOSE 8080
ENTRYPOINT ["/golf"]
