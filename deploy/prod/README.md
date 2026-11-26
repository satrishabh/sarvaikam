# Production environment

Prod is a separate copy of dev: its own GCP resources (Terraform `env=prod`), its own namespace `prod`, and its
own values file in aio-gitops. Nothing is shared with dev except the Profile Manager.

| Piece | Dev | Prod |
|---|---|---|
| Cloud SQL | `aio-002`, zonal | Terraform `sarvaikam-prod`: regional (HA), deletion protection, PITR |
| Content bucket | `cotent_bucket` | Terraform `<project>-sarvaikam-prod-content` |
| Secrets | K8s secret `sarvaikam-db` | Secret Manager via External Secrets |
| Values | aio-gitops `values-dev.yaml` | aio-gitops `values-prod.yaml` (from `values-prod.example.yaml`) |
| Image | built from the branch | the same image tag that passed in dev, pinned to its git SHA |

## Bring-up checklist

1. **Infrastructure.** In `infra/terraform/gcp`:
   `terraform init -backend-config="bucket=<state-bucket>" -backend-config="prefix=sarvaikam/prod"`, then
   `terraform apply -var project_id=<project> -var env=prod -var region=asia-south1 -var k8s_namespace=prod -var k8s_service_account=sarvaikam-content -var alert_email=<you>`.
   Note the outputs `db_connection_name`, `content_bucket`, `content_service_account`, `secret_ids`.
2. **Profile Manager secrets.** Add the two Profile Manager client secrets to Secret Manager as
   `sarvaikam-prod-profile-api-client-secret` and `sarvaikam-prod-profile-registration-client-secret`
   (`gcloud secrets create <name> --data-file=-`), and grant the content service account `secretAccessor`.
   Terraform already created the database password and JWT secret.
3. **Namespace and service account.** `kubectl create namespace prod`, then create the KSA
   `sarvaikam-content` annotated with `iam.gke.io/gcp-service-account=<content_service_account>`.
4. **Database proxy and secrets.** Fill in and apply `cloudsql-proxy.example.yaml` and
   `external-secrets.example.yaml`; wait for `kubectl get externalsecret -n prod` to show `SecretSynced`.
5. **App.** Copy `values-prod.example.yaml` to aio-gitops as `apps/sarvaikam/values-prod.yaml`, fill in the
   bucket and service account, add an Argo CD Application for namespace `prod`, and sync.
6. **Edge.** Point `learn.sarvaikam.com` at the prod ingress; cert-manager issues the certificate.
   Add the prod redirect URIs to the Profile Manager clients (`deploy/profile-manager-clients.example.json`).
7. **Check.**
   - `curl -fsS https://learn.sarvaikam.com/ready` returns 200.
   - Sign up, open a lesson, mark it complete, upload and download an attachment.
   - The pod log shows `[prod] starting: embedded_db=false ... sslmode=disable` and JSON lines.
   - The uptime check in Cloud Monitoring is green and a test alert reaches your phone.
8. **Restore drill.** Clone the prod database to a point in time (`infra/terraform/gcp/README.md`), check the
   row counts, delete the clone, and write down how long it took.

## Promoting a release

Deploy to dev first. When dev has run cleanly, set the same image tag in `values-prod.yaml` and sync prod.
Rolling back is setting the previous tag. Database changes must stay backwards compatible for one release,
because Flyway (content), the auth migrations and the progress schema all run at startup.
