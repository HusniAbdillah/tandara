resource "aws_iam_role" "migration_execution" {
  name               = "${var.name}-migration-execution"
  assume_role_policy = aws_iam_role.execution.assume_role_policy
}
resource "aws_iam_role_policy_attachment" "migration_execution" {
  role       = aws_iam_role.migration_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}
resource "aws_iam_role_policy" "migration_secrets" {
  role   = aws_iam_role.migration_execution.id
  policy = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Action = ["secretsmanager:GetSecretValue"], Resource = [var.migrator_secret_arn, var.app_secret_arn] }, { Effect = "Allow", Action = ["kms:Decrypt"], Resource = [aws_kms_key.data.arn] }] })
}
resource "aws_ecs_task_definition" "migrate" {
  family                   = "${var.name}-migrate"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "1024"
  memory                   = "2048"
  execution_role_arn       = aws_iam_role.migration_execution.arn
  task_role_arn            = aws_iam_role.task.arn
  container_definitions    = jsonencode([{ name = "migrate", image = var.app_image, essential = true, readonlyRootFilesystem = true, command = ["sh", "-c", "node packages/database/dist/migrate.js && node tooling/ai-checkpoints.mjs && node tooling/provision-service-role.mjs"], environment = [{ name = "APP_MODE", value = "production" }], secrets = [{ name = "DATABASE_URL", valueFrom = "${var.migrator_secret_arn}:DATABASE_URL::" }, { name = "SERVICE_DATABASE_URL", valueFrom = "${var.app_secret_arn}:DATABASE_URL::" }], logConfiguration = { logDriver = "awslogs", options = { awslogs-group = aws_cloudwatch_log_group.app.name, awslogs-region = var.aws_region, awslogs-stream-prefix = "migration" } } }])
}
resource "aws_appautoscaling_target" "api" {
  max_capacity       = 8
  min_capacity       = 2
  resource_id        = "service/${aws_ecs_cluster.app.name}/${aws_ecs_service.app["api"].name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}
resource "aws_appautoscaling_policy" "api_cpu" {
  name               = "${var.name}-api-cpu"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.api.resource_id
  scalable_dimension = aws_appautoscaling_target.api.scalable_dimension
  service_namespace  = aws_appautoscaling_target.api.service_namespace
  target_tracking_scaling_policy_configuration {
    target_value       = 60
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
    predefined_metric_specification { predefined_metric_type = "ECSServiceAverageCPUUtilization" }
  }
}
resource "aws_cloudwatch_metric_alarm" "api_errors" {
  alarm_name          = "${var.name}-api-errors"
  namespace           = "AWS/ApplicationELB"
  metric_name         = "HTTPCode_Target_5XX_Count"
  statistic           = "Sum"
  period              = 60
  evaluation_periods  = 2
  comparison_operator = "GreaterThanThreshold"
  threshold           = 5
  dimensions          = { LoadBalancer = aws_lb.app.arn_suffix }
  alarm_actions       = [aws_sns_topic.alarms.arn]
  treat_missing_data  = "notBreaching"
}
resource "aws_cloudwatch_metric_alarm" "database_storage" {
  alarm_name          = "${var.name}-database-storage"
  namespace           = "AWS/RDS"
  metric_name         = "FreeStorageSpace"
  statistic           = "Minimum"
  period              = 60
  evaluation_periods  = 3
  comparison_operator = "LessThanThreshold"
  threshold           = 10737418240
  dimensions          = { DBInstanceIdentifier = aws_db_instance.database.identifier }
  alarm_actions       = [aws_sns_topic.alarms.arn]
  treat_missing_data  = "breaching"
}
resource "aws_cloudwatch_dashboard" "operations" {
  dashboard_name = "${var.name}-operations"
  dashboard_body = jsonencode({ widgets = [
    { type = "metric", x = 0, y = 0, width = 12, height = 6, properties = { title = "HTTP latency and failures", region = var.aws_region, metrics = [["AWS/ApplicationELB", "TargetResponseTime", "LoadBalancer", aws_lb.app.arn_suffix, { stat = "p95" }], [".", "HTTPCode_Target_5XX_Count", ".", ".", { stat = "Sum" }]], period = 60 } },
    { type = "metric", x = 12, y = 0, width = 12, height = 6, properties = { title = "Database capacity", region = var.aws_region, metrics = [["AWS/RDS", "CPUUtilization", "DBInstanceIdentifier", aws_db_instance.database.identifier], [".", "DatabaseConnections", ".", "."], [".", "FreeStorageSpace", ".", "."]], period = 60 } },
    { type = "metric", x = 0, y = 6, width = 24, height = 6, properties = { title = "API and worker resources", region = var.aws_region, metrics = [["AWS/ECS", "CPUUtilization", "ClusterName", aws_ecs_cluster.app.name, "ServiceName", "api"], [".", "MemoryUtilization", ".", ".", ".", "api"], [".", "CPUUtilization", ".", ".", ".", "worker"]], period = 60 } }
  ] })
}
output "migration_task" { value = aws_ecs_task_definition.migrate.arn }
