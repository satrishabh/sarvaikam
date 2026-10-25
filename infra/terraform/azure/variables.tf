variable "subscription_id" {
  type        = string
  description = "Azure subscription ID to deploy into"
}

variable "name" {
  type    = string
  default = "sarvaikam"
}

variable "env" {
  type    = string
  default = "dev"
}

variable "location" {
  type    = string
  default = "eastus"
}

variable "kubernetes_version" {
  type    = string
  default = null # latest supported
}

variable "node_vm_size" {
  type    = string
  default = "Standard_D2s_v5"
}

variable "db_sku" {
  type    = string
  default = "B_Standard_B1ms"
}
