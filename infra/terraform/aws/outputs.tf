output "cluster_name" {
  value = module.eks.cluster_name
}

output "kubeconfig_command" {
  value = "aws eks update-kubeconfig --region ${var.region} --name ${module.eks.cluster_name}"
}

output "ecr_repositories" {
  value = { for k, r in aws_ecr_repository.app : k => r.repository_url }
}

output "db_endpoint" {
  value = aws_db_instance.postgres.address
}

output "db_password" {
  value     = random_password.db.result
  sensitive = true
}
