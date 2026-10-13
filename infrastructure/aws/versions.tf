terraform {

  required_version = ">= 1.13, < 2.0"
  required_providers {

    aws = { source = "hashicorp/aws", version = "~> 6.0" }

  }
  # Configure a private encrypted S3 state backend with locking in your deployment account.

}
provider "aws" {
  region = var.aws_region
}
