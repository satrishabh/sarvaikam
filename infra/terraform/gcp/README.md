# GCP stack

VPC, GKE Autopilot, Artifact Registry, Cloud SQL PostgreSQL 16 (private IP, TLS-only, point-in-time recovery),
the private content bucket, and Secret Manager secrets for the database password and JWT secret.

## One-time: state bucket

State is kept in a GCS bucket so everyone (and CI) shares one state with locking. Create it once per project:

```bash
gcloud storage buckets create gs://<project-id>-tfstate --location=<region> \
  --uniform-bucket-level-access --public-access-prevention
gcloud storage buckets update gs://<project-id>-tfstate --versioning
```

## Apply

```bash
terraform init -backend-config="bucket=<project-id>-tfstate" -backend-config="prefix=sarvaikam/dev"
terraform plan  -var project_id=<project-id> -var env=dev
terraform apply -var project_id=<project-id> -var env=dev
```

Use a different `prefix` and `env` per environment (`sarvaikam/prod`, `-var env=prod`); prod also gets a
regional (HA) database and deletion protection.

## Restoring the database

- **To a point in time** (last 7 days): clone the instance at a timestamp, check the clone, then repoint the app.

  ```bash
  gcloud sql instances clone <instance> <instance>-restore --point-in-time=2026-11-20T10:00:00Z
  ```

- **From a nightly backup** (last 14): `gcloud sql backups list --instance=<instance>`, then
  `gcloud sql backups restore <backup-id> --restore-instance=<target-instance>`.

Practise one restore before launch and write down how long it took.
