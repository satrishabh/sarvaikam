terraform {
  required_version = ">= 1.6"
  required_providers {
    azurerm = { source = "hashicorp/azurerm", version = "~> 4.5" }
    random  = { source = "hashicorp/random", version = "~> 3.6" }
  }
  # backend "azurerm" { resource_group_name = "rg-tfstate" storage_account_name = "tfstate123" container_name = "tfstate" key = "sarvaikam.tfstate" }
}

provider "azurerm" {
  features {}
  subscription_id = var.subscription_id
}

locals {
  prefix = "${var.name}-${var.env}"
  tags   = { project = var.name, env = var.env }
}

resource "azurerm_resource_group" "main" {
  name     = "rg-${local.prefix}"
  location = var.location
  tags     = local.tags
}

resource "azurerm_virtual_network" "main" {
  name                = "vnet-${local.prefix}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  address_space       = ["10.30.0.0/16"]
}

resource "azurerm_subnet" "aks" {
  name                 = "snet-aks"
  resource_group_name  = azurerm_resource_group.main.name
  virtual_network_name = azurerm_virtual_network.main.name
  address_prefixes     = ["10.30.0.0/20"]
}

resource "azurerm_subnet" "db" {
  name                 = "snet-db"
  resource_group_name  = azurerm_resource_group.main.name
  virtual_network_name = azurerm_virtual_network.main.name
  address_prefixes     = ["10.30.16.0/24"]

  delegation {
    name = "postgres"
    service_delegation {
      name    = "Microsoft.DBforPostgreSQL/flexibleServers"
      actions = ["Microsoft.Network/virtualNetworks/subnets/join/action"]
    }
  }
}

resource "azurerm_container_registry" "acr" {
  # ACR names must be globally unique and alphanumeric.
  name                = replace("${local.prefix}acr", "-", "")
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  sku                 = "Standard"
}

resource "azurerm_kubernetes_cluster" "aks" {
  name                = "aks-${local.prefix}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  dns_prefix          = local.prefix
  kubernetes_version  = var.kubernetes_version
  tags                = local.tags

  default_node_pool {
    name                 = "system"
    vm_size              = var.node_vm_size
    vnet_subnet_id       = azurerm_subnet.aks.id
    auto_scaling_enabled = true
    min_count            = 2
    max_count            = 5
  }

  identity { type = "SystemAssigned" }

  network_profile {
    network_plugin = "azure"
    service_cidr   = "10.31.0.0/16"
    dns_service_ip = "10.31.0.10"
  }
}

resource "azurerm_role_assignment" "aks_acr_pull" {
  scope                = azurerm_container_registry.acr.id
  role_definition_name = "AcrPull"
  principal_id         = azurerm_kubernetes_cluster.aks.kubelet_identity[0].object_id
}

resource "azurerm_private_dns_zone" "db" {
  name                = "${local.prefix}.postgres.database.azure.com"
  resource_group_name = azurerm_resource_group.main.name
}

resource "azurerm_private_dns_zone_virtual_network_link" "db" {
  name                  = "db-link"
  resource_group_name   = azurerm_resource_group.main.name
  private_dns_zone_name = azurerm_private_dns_zone.db.name
  virtual_network_id    = azurerm_virtual_network.main.id
}

resource "random_password" "db" {
  length  = 24
  special = false
}

resource "azurerm_postgresql_flexible_server" "db" {
  name                          = "psql-${local.prefix}"
  resource_group_name           = azurerm_resource_group.main.name
  location                      = azurerm_resource_group.main.location
  version                       = "16"
  delegated_subnet_id           = azurerm_subnet.db.id
  private_dns_zone_id           = azurerm_private_dns_zone.db.id
  public_network_access_enabled = false
  administrator_login           = "sarvaikam"
  administrator_password        = random_password.db.result
  sku_name                      = var.db_sku
  storage_mb                    = 32768
  zone                          = "1"

  depends_on = [azurerm_private_dns_zone_virtual_network_link.db]
}

resource "azurerm_postgresql_flexible_server_database" "app" {
  name      = "sarvaikam"
  server_id = azurerm_postgresql_flexible_server.db.id
}
