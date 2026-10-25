output "kubeconfig_command" {
  value = "gcloud container clusters get-credentials ${google_container_cluster.gke.name} --region ${var.region} --project ${var.project_id}"
}

output "image_registry" {
  value = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.images.repository_id}"
}

output "db_private_ip" {
  value = google_sql_database_instance.postgres.private_ip_address
}

output "db_password" {
  value     = random_password.db.result
  sensitive = true
}
