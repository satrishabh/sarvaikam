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
