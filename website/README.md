# Sarvaikam organization homepage

This is a standalone static site in the Sarvaikam application repository. It has its own Docker build context and
does not replace or change the learning app in `frontend/`.

Create the AIO project with:

- Repository: `https://github.com/satrishabh/sarvaikam`
- Project name: `sarvaikam-home`
- Build context: `website`
- Dockerfile: `website/Dockerfile` (path relative to the repository root)
- Test image and command: leave empty to skip the optional test step
- GitHub webhook: enabled, so pushes start CI
- Nginx serves `/health` for the platform's liveness and readiness probes.

The site links to `https://learn.sarvaikam.com` and `https://app.sarvaikam.com`. Map AIO to the `app` hostname
before publishing this homepage so both product links lead to the intended service. Add the apex and `www` routes
only after this project is healthy and DNS/certificate checks are ready; do not remove or replace existing
Hostinger records before then.
