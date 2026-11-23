# Runtime secrets live in Secret Manager, not in Helm values or committed Kubernetes Secrets.
# The app's service account can read them; External Secrets Operator syncs them into the cluster
# (see deploy/dev/external-secrets.yaml).

resource "random_password" "jwt" {
  length  = 48
  special = false
}

locals {
  secrets = {
    "db-password" = random_password.db.result
    "jwt-secret"  = random_password.jwt.result
  }
}

resource "google_secret_manager_secret" "app" {
  for_each  = local.secrets
  secret_id = "${local.prefix}-${each.key}"
  replication {
    auto {}
  }
  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret_version" "app" {
  for_each    = local.secrets
  secret      = google_secret_manager_secret.app[each.key].id
  secret_data = each.value
}

resource "google_secret_manager_secret_iam_member" "app" {
  for_each  = local.secrets
  secret_id = google_secret_manager_secret.app[each.key].id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.content.email}"
}

# The Cloud SQL Auth Proxy runs as the same service account.
resource "google_project_iam_member" "cloudsql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.content.email}"
}

output "secret_ids" {
  value = { for k, s in google_secret_manager_secret.app : k => s.secret_id }
}

output "db_connection_name" {
  value = google_sql_database_instance.postgres.connection_name
}
