# Sarvaikam organization homepage

This is a standalone static site in the Sarvaikam application repository. It has its own Docker build context and
does not replace or change the learning app in `frontend/`.

Create the AIO project with:

- Repository: `https://github.com/satrishabh/sarvaikam`
- Project name: `sarvaikam-home`
- Build context: `website`
- Dockerfile: `./Dockerfile`
- Test image and command: leave empty to skip the optional test step
- GitHub webhook: enabled, so pushes start CI

The site links to `https://learn.sarvaikam.com`. Add the apex and `www` routes only after this project is healthy
and DNS/certificate checks are ready; do not remove or replace existing Hostinger records before then.
