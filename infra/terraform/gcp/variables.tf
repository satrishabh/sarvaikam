variable "project_id" {
  type        = string
  description = "GCP project ID to deploy into"
}

variable "name" {
  type    = string
  default = "sarvaikam"
}

variable "env" {
  type    = string
  default = "dev"
}

variable "region" {
  type    = string
  default = "us-central1"
}

variable "db_tier" {
  type    = string
  default = "db-f1-micro"
}

variable "content_origins" {
  type        = list(string)
  description = "Exact browser origins allowed to upload learning resources"
  default     = ["https://learn.sarvaikam.com"]
}

variable "k8s_namespace" {
  type        = string
  description = "Namespace of the app's Kubernetes service account (Workload Identity)"
  default     = "sarvaikam"
}

variable "k8s_service_account" {
  type        = string
  description = "Kubernetes service account the app pods run as (Workload Identity)"
  default     = "content-service"
}

variable "db_backup_start_time" {
  type        = string
  description = "Daily backup start, HH:MM in UTC (20:30 UTC = 02:00 IST)"
  default     = "20:30"
}

variable "db_maintenance_day" {
  type        = number
  description = "Maintenance day, 1 = Monday ... 7 = Sunday (UTC)"
  default     = 7
}

variable "db_maintenance_hour" {
  type        = number
  description = "Maintenance hour in UTC (21 = 02:30 IST Monday)"
  default     = 21
}

variable "public_host" {
  type        = string
  description = "Public hostname the uptime check probes (https://<host>/ready)"
  default     = "learn.sarvaikam.com"
}

variable "alert_email" {
  type        = string
  description = "Where alerts are emailed; empty creates the alerts without a notification channel"
  default     = ""
}

variable "alert_5xx_per_5min" {
  type        = number
  description = "Alert when more than this many 5xx responses are logged in 5 minutes"
  default     = 10
}
