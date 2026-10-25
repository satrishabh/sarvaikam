output "kubeconfig_command" {
  value = "az aks get-credentials -g ${azurerm_resource_group.main.name} -n ${azurerm_kubernetes_cluster.aks.name}"
}

output "acr_login_server" {
  value = azurerm_container_registry.acr.login_server
}

output "db_host" {
  value = azurerm_postgresql_flexible_server.db.fqdn
}

output "db_password" {
  value     = random_password.db.result
  sensitive = true
}
