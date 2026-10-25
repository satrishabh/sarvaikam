terraform {
  required_version = ">= 1.6"
  required_providers {
    google = { source = "hashicorp/google", version = "~> 6.6" }
    random = { source = "hashicorp/random", version = "~> 3.6" }
  }
  # backend "gcs" { bucket = "my-tf-state" prefix = "sarvaikam" }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

locals {
  prefix = "${var.name}-${var.env}"
  apis   = ["container.googleapis.com", "sqladmin.googleapis.com", "artifactregistry.googleapis.com", "servicenetworking.googleapis.com"]
}

resource "google_project_service" "apis" {
  for_each           = toset(local.apis)
  service            = each.key
  disable_on_destroy = false
}

resource "google_compute_network" "vpc" {
  name                    = local.prefix
  auto_create_subnetworks = false
  depends_on              = [google_project_service.apis]
}

resource "google_compute_subnetwork" "gke" {
  name          = "${local.prefix}-gke"
  network       = google_compute_network.vpc.id
  region        = var.region
  ip_cidr_range = "10.40.0.0/20"

  secondary_ip_range {
    range_name    = "pods"
    ip_cidr_range = "10.44.0.0/14"
  }
  secondary_ip_range {
    range_name    = "services"
    ip_cidr_range = "10.48.0.0/20"
  }
}

# Private Service Access so Cloud SQL gets a private IP inside the VPC.
resource "google_compute_global_address" "sql_range" {
  name          = "${local.prefix}-sql-range"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.vpc.id
}

resource "google_service_networking_connection" "sql" {
  network                 = google_compute_network.vpc.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.sql_range.name]
}

resource "google_container_cluster" "gke" {
  name                = local.prefix
  location            = var.region
  network             = google_compute_network.vpc.id
  subnetwork          = google_compute_subnetwork.gke.id
  enable_autopilot    = true
  deletion_protection = var.env == "prod"

  ip_allocation_policy {
    cluster_secondary_range_name  = "pods"
    services_secondary_range_name = "services"
  }
}

resource "google_artifact_registry_repository" "images" {
  location      = var.region
  repository_id = var.name
  format        = "DOCKER"
  depends_on    = [google_project_service.apis]
}

resource "random_password" "db" {
  length  = 24
  special = false
}

resource "google_sql_database_instance" "postgres" {
  name                = local.prefix
  database_version    = "POSTGRES_16"
  region              = var.region
  deletion_protection = var.env == "prod"
  depends_on          = [google_service_networking_connection.sql]

  settings {
    tier              = var.db_tier
    availability_type = var.env == "prod" ? "REGIONAL" : "ZONAL"
    ip_configuration {
      ipv4_enabled    = false
      private_network = google_compute_network.vpc.id
    }
    backup_configuration { enabled = true }
  }
}

resource "google_sql_database" "app" {
  name     = "sarvaikam"
  instance = google_sql_database_instance.postgres.name
}

resource "google_sql_user" "app" {
  name     = "sarvaikam"
  instance = google_sql_database_instance.postgres.name
  password = random_password.db.result
}
