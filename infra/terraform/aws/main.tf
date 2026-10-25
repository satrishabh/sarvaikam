terraform {
  required_version = ">= 1.6"
  required_providers {
    aws    = { source = "hashicorp/aws", version = "~> 5.70" }
    random = { source = "hashicorp/random", version = "~> 3.6" }
  }
  # Uncomment and configure for team use:
  # backend "s3" { bucket = "my-tf-state" key = "sarvaikam/aws.tfstate" region = "us-east-1" dynamodb_table = "tf-locks" }
}

provider "aws" {
  region = var.region
  default_tags { tags = { project = var.name, env = var.env } }
}

data "aws_availability_zones" "available" { state = "available" }

locals {
  prefix   = "${var.name}-${var.env}"
  azs      = slice(data.aws_availability_zones.available.names, 0, 3)
  services = ["content-service", "auth-service", "progress-service", "frontend"]
}

module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.13"

  name            = local.prefix
  cidr            = "10.20.0.0/16"
  azs             = local.azs
  private_subnets = ["10.20.1.0/24", "10.20.2.0/24", "10.20.3.0/24"]
  public_subnets  = ["10.20.101.0/24", "10.20.102.0/24", "10.20.103.0/24"]

  enable_nat_gateway = true
  single_nat_gateway = var.env != "prod"

  public_subnet_tags  = { "kubernetes.io/role/elb" = 1 }
  private_subnet_tags = { "kubernetes.io/role/internal-elb" = 1 }
}

module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.24"

  cluster_name                             = local.prefix
  cluster_version                          = var.kubernetes_version
  vpc_id                                   = module.vpc.vpc_id
  subnet_ids                               = module.vpc.private_subnets
  cluster_endpoint_public_access           = true
  enable_cluster_creator_admin_permissions = true

  eks_managed_node_groups = {
    default = {
      instance_types = [var.node_instance_type]
      min_size       = 2
      max_size       = 5
      desired_size   = 2
    }
  }
}

resource "aws_ecr_repository" "app" {
  for_each             = toset(local.services)
  name                 = "${var.name}/${each.key}"
  image_tag_mutability = "IMMUTABLE"
  image_scanning_configuration { scan_on_push = true }
}

resource "random_password" "db" {
  length  = 24
  special = false
}

resource "aws_db_subnet_group" "db" {
  name       = local.prefix
  subnet_ids = module.vpc.private_subnets
}

resource "aws_security_group" "db" {
  name   = "${local.prefix}-db"
  vpc_id = module.vpc.vpc_id

  ingress {
    description     = "PostgreSQL from EKS nodes"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [module.eks.node_security_group_id]
  }
}

resource "aws_db_instance" "postgres" {
  identifier             = local.prefix
  engine                 = "postgres"
  engine_version         = "16"
  instance_class         = var.db_instance_class
  allocated_storage      = 20
  db_name                = "sarvaikam"
  username               = "sarvaikam"
  password               = random_password.db.result
  db_subnet_group_name   = aws_db_subnet_group.db.name
  vpc_security_group_ids = [aws_security_group.db.id]
  storage_encrypted      = true
  multi_az               = var.env == "prod"
  skip_final_snapshot    = var.env != "prod"
  deletion_protection    = var.env == "prod"
}
