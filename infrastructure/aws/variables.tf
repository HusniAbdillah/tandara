variable "aws_region" {
  type = string
}
variable "name" {
  type    = string
  default = "tandara"
}
variable "vpc_id" {
  type = string
}
variable "public_subnets" {
  type = list(string)
}
variable "private_subnets" {
  type = list(string)
}
variable "certificate_arn" {
  type = string
}
variable "warga_domain" {
  type = string
}
variable "posko_domain" {
  type = string
}
variable "app_image" {
  type = string
  validation {
    condition     = can(regex("@sha256:[a-f0-9]{64}$", var.app_image))
    error_message = "Provide an immutable reviewed application image digest."
  }
}
variable "web_image" {
  type = string
  validation {
    condition     = can(regex("@sha256:[a-f0-9]{64}$", var.web_image))
    error_message = "Provide an immutable reviewed web image digest."
  }
}
variable "app_secret_arn" {
  type = string
}
variable "migrator_secret_arn" {
  type = string
}
variable "artifact_bucket_name" {
  type = string
}
variable "alarm_email" {
  type = string
}
variable "db_instance_class" {
  type    = string
  default = "db.m7g.large"
}
variable "worker_count" {
  type    = number
  default = 2
}
variable "environment" {

  type    = map(string)
  default = {}
  validation {

    condition     = !contains(keys(var.environment), "AI_API_KEY") && !contains(keys(var.environment), "AI_EMBEDDING_API_KEY") && !contains(keys(var.environment), "SERVICE_DATABASE_URL") && !contains(keys(var.environment), "DATABASE_URL") && !contains(keys(var.environment), "MFA_ENCRYPTION_KEY") && !contains(keys(var.environment), "DEMO_PASSWORD")
    error_message = "Credentials belong in Secrets Manager, not Terraform environment or state."

  }

}
