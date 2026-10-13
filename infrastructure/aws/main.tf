locals {

  secret_keys = ["DATABASE_URL", "MFA_ENCRYPTION_KEY", "AI_API_KEY", "AI_EMBEDDING_API_KEY"]
  app_env     = merge(var.environment, { APP_MODE = "production", NODE_ENV = "production", API_HOST = "0.0.0.0", API_PORT = "3000", SESSION_SECURE = "true", TRUST_PROXY = "true", WORKER_ENABLED = "true", REDIS_URL = "redis://unused:6379", WEB_ORIGINS = "https://${var.warga_domain},https://${var.posko_domain}", LANGSMITH_TRACING = "false", LANGCHAIN_TRACING_V2 = "false" })
  services    = { api = { image = var.app_image, count = 2, command = ["node", "apps/api/dist/main.js"], ports = [{ containerPort = 3000, name = "api", protocol = "tcp" }] }, worker = { image = var.app_image, count = var.worker_count, command = ["node", "apps/worker/dist/main.js"], ports = [] }, web = { image = var.web_image, count = 2, command = ["caddy", "run", "--config", "/etc/caddy/Caddyfile"], ports = [{ containerPort = 8080, name = "warga", protocol = "tcp" }, { containerPort = 8081, name = "posko", protocol = "tcp" }] } }

}
data "aws_subnet" "private" {
  for_each = toset(var.private_subnets)
  id       = each.value
}
check "availability_zones" {

  assert {

    condition     = length(toset([for s in data.aws_subnet.private : s.availability_zone])) >= 2
    error_message = "Private subnets must span at least two availability zones with reviewed NAT/egress paths."

  }

}
resource "aws_kms_key" "data" {
  description             = "Tandara database, logs and artifacts"
  enable_key_rotation     = true
  deletion_window_in_days = 30
}
resource "aws_s3_bucket" "artifacts" {
  bucket        = var.artifact_bucket_name
  force_destroy = false
}
resource "aws_s3_bucket_public_access_block" "artifacts" {
  bucket                  = aws_s3_bucket.artifacts.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
resource "aws_s3_bucket_server_side_encryption_configuration" "artifacts" {

  bucket = aws_s3_bucket.artifacts.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.data.arn
    }
  }

}
resource "aws_s3_bucket_versioning" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id
  versioning_configuration {
    status = "Enabled"
  }
}
resource "aws_s3_bucket_policy" "tls" {

  bucket = aws_s3_bucket.artifacts.id
  policy = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Deny", Principal = "*", Action = "s3:*", Resource = [aws_s3_bucket.artifacts.arn, "${aws_s3_bucket.artifacts.arn}/*"], Condition = { Bool = { "aws:SecureTransport" = "false" } } }] })

}
resource "aws_security_group" "alb" {

  name   = "${var.name}-alb"
  vpc_id = var.vpc_id
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  egress {
    from_port   = 8080
    to_port     = 8081
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

}
resource "aws_security_group" "tasks" {

  name   = "${var.name}-tasks"
  vpc_id = var.vpc_id
  ingress {
    from_port       = 8080
    to_port         = 8081
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }
  ingress {
    from_port = 3000
    to_port   = 3000
    protocol  = "tcp"
    self      = true
  }
  egress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  egress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  egress {
    from_port = 3000
    to_port   = 3000
    protocol  = "tcp"
    self      = true
  }

}
resource "aws_security_group" "database" {
  name   = "${var.name}-database"
  vpc_id = var.vpc_id
  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.tasks.id]
  }
}
resource "aws_db_subnet_group" "database" {
  name       = var.name
  subnet_ids = var.private_subnets
}
resource "aws_db_parameter_group" "database" {
  name   = var.name
  family = "postgres16"
  parameter {
    name  = "rds.force_ssl"
    value = "1"
  }
}
resource "aws_db_instance" "database" {

  identifier                      = var.name
  engine                          = "postgres"
  engine_version                  = "16"
  instance_class                  = var.db_instance_class
  db_name                         = "tandara"
  username                        = "tandara_migrator"
  manage_master_user_password     = true
  storage_encrypted               = true
  kms_key_id                      = aws_kms_key.data.arn
  allocated_storage               = 100
  max_allocated_storage           = 500
  multi_az                        = true
  publicly_accessible             = false
  db_subnet_group_name            = aws_db_subnet_group.database.name
  parameter_group_name            = aws_db_parameter_group.database.name
  vpc_security_group_ids          = [aws_security_group.database.id]
  backup_retention_period         = 35
  deletion_protection             = true
  skip_final_snapshot             = false
  final_snapshot_identifier       = "${var.name}-final-preserved"
  auto_minor_version_upgrade      = true
  enabled_cloudwatch_logs_exports = ["postgresql"]

}
resource "aws_cloudwatch_log_group" "app" {
  name              = "/${var.name}/application"
  retention_in_days = 30
}
resource "aws_ecs_cluster" "app" {
  name = var.name
  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}
resource "aws_service_discovery_http_namespace" "app" {
  name = "${var.name}-services"
}
resource "aws_iam_role" "execution" {
  name               = "${var.name}-execution"
  assume_role_policy = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Principal = { Service = "ecs-tasks.amazonaws.com" }, Action = "sts:AssumeRole" }] })
}
resource "aws_iam_role_policy_attachment" "execution" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}
resource "aws_iam_role_policy" "secrets" {

  role   = aws_iam_role.execution.id
  policy = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Action = ["secretsmanager:GetSecretValue"], Resource = [var.app_secret_arn] }, { Effect = "Allow", Action = ["kms:Decrypt"], Resource = [aws_kms_key.data.arn] }] })

}
resource "aws_iam_role" "task" {
  name               = "${var.name}-task"
  assume_role_policy = aws_iam_role.execution.assume_role_policy
}
resource "aws_ecs_task_definition" "app" {

  for_each                 = local.services
  family                   = "${var.name}-${each.key}"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "1024"
  memory                   = "2048"
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn
  container_definitions    = jsonencode([{ name = each.key, image = each.value.image, essential = true, command = each.value.command, portMappings = each.value.ports, readonlyRootFilesystem = each.key != "web", environment = [for k, v in(each.key == "web" ? { API_UPSTREAM = "api:3000" } : local.app_env) : { name = k, value = v }], secrets = each.key == "web" ? [] : [for key in local.secret_keys : { name = key, valueFrom = "${var.app_secret_arn}:${key}::" }], logConfiguration = { logDriver = "awslogs", options = { awslogs-group = aws_cloudwatch_log_group.app.name, awslogs-region = var.aws_region, awslogs-stream-prefix = each.key } } }])

}
resource "aws_lb" "app" {
  name                       = var.name
  internal                   = false
  load_balancer_type         = "application"
  security_groups            = [aws_security_group.alb.id]
  subnets                    = var.public_subnets
  enable_deletion_protection = true
}
resource "aws_lb_target_group" "web" {
  for_each    = { warga = 8080, posko = 8081 }
  name        = "${var.name}-${each.key}"
  port        = each.value
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"
  health_check {
    path    = "/health/backend"
    matcher = "200"
  }
}
resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.app.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.certificate_arn
  default_action {
    type = "fixed-response"
    fixed_response {
      content_type = "text/plain"
      message_body = "Unknown origin"
      status_code  = "404"
    }
  }
}
resource "aws_lb_listener_rule" "web" {
  for_each     = { warga = var.warga_domain, posko = var.posko_domain }
  listener_arn = aws_lb_listener.https.arn
  priority     = each.key == "warga" ? 10 : 20
  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.web[each.key].arn
  }
  condition {
    host_header {
      values = [each.value]
    }
  }
}
resource "aws_ecs_service" "app" {
  lifecycle { ignore_changes = [desired_count] }

  for_each                           = local.services
  name                               = each.key
  cluster                            = aws_ecs_cluster.app.id
  task_definition                    = aws_ecs_task_definition.app[each.key].arn
  desired_count                      = each.value.count
  launch_type                        = "FARGATE"
  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200
  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }
  network_configuration {
    subnets          = var.private_subnets
    security_groups  = [aws_security_group.tasks.id]
    assign_public_ip = false
  }
  service_connect_configuration {

    enabled   = true
    namespace = aws_service_discovery_http_namespace.app.arn
    dynamic "service" {
      for_each = each.key == "api" ? [1] : []
      content {
        port_name = "api"
        client_alias {
          port     = 3000
          dns_name = "api"
        }
      }
    }

  }
  dynamic "load_balancer" {
    for_each = each.key == "web" ? aws_lb_target_group.web : {}
    content {
      target_group_arn = load_balancer.value.arn
      container_name   = "web"
      container_port   = load_balancer.value.port
    }
  }
  depends_on = [aws_lb_listener.https]

}
resource "aws_sns_topic" "alarms" {
  name = "${var.name}-alarms"
}
resource "aws_sns_topic_subscription" "oncall" {
  topic_arn = aws_sns_topic.alarms.arn
  protocol  = "email"
  endpoint  = var.alarm_email
}
resource "aws_cloudwatch_metric_alarm" "unhealthy" {
  alarm_name          = "${var.name}-unhealthy-web"
  namespace           = "AWS/ApplicationELB"
  metric_name         = "UnHealthyHostCount"
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 2
  comparison_operator = "GreaterThanThreshold"
  threshold           = 0
  dimensions          = { LoadBalancer = aws_lb.app.arn_suffix, TargetGroup = aws_lb_target_group.web["posko"].arn_suffix }
  alarm_actions       = [aws_sns_topic.alarms.arn]
  treat_missing_data  = "breaching"
}
output "load_balancer" {
  value = aws_lb.app.dns_name
}
output "database_endpoint" {
  value = aws_db_instance.database.address
}
output "database_master_secret_arn" {
  value     = aws_db_instance.database.master_user_secret[0].secret_arn
  sensitive = true
}
output "artifact_kms_key_arn" {
  value = aws_kms_key.data.arn
}
