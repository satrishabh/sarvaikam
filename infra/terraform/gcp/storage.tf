# Private learning resources. No public object URLs or service-account keys.
resource "google_storage_bucket" "content" {
  name                        = "${var.project_id}-${local.prefix}-content"
  location                    = var.region
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  force_destroy               = false
  versioning { enabled = true }
  cors {
    origin          = var.content_origins
    method          = ["PUT", "GET", "HEAD"]
    response_header = ["Content-Type", "Content-Length", "ETag", "x-goog-generation"]
    max_age_seconds = 3600
  }
  lifecycle_rule {
    condition { num_newer_versions = 3 }
    action { type = "Delete" }
  }
  depends_on = [google_project_service.apis]
}

resource "google_service_account" "content" {
  account_id   = "${local.prefix}-content"
  display_name = "Sarvaikam private learning resources"
}

resource "google_storage_bucket_iam_member" "content" {
  bucket = google_storage_bucket.content.name
  role   = "roles/storage.objectUser"
  member = "serviceAccount:${google_service_account.content.email}"
}

# Allows IAM signBlob through ImpersonatedCredentials without exporting a private key.
resource "google_service_account_iam_member" "signing" {
  service_account_id = google_service_account.content.name
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = "serviceAccount:${google_service_account.content.email}"
}

resource "google_service_account_iam_member" "workload" {
  service_account_id = google_service_account.content.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "serviceAccount:${var.project_id}.svc.id.goog[sarvaikam/content-service]"
}

output "content_bucket" { value = google_storage_bucket.content.name }
output "content_service_account" { value = google_service_account.content.email }
