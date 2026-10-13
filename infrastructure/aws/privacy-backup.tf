resource "aws_iam_role" "privacy_backup" {
  name               = "${var.name}-privacy-backup"
  assume_role_policy = aws_iam_role.execution.assume_role_policy
}
resource "aws_iam_role_policy" "privacy_backup" {
  role = aws_iam_role.privacy_backup.id
  policy = jsonencode({ Version = "2012-10-17", Statement = [
    { Effect = "Allow", Action = ["s3:PutObject"], Resource = ["${aws_s3_bucket.artifacts.arn}/privacy/ledger/latest.json"] },
    { Effect = "Allow", Action = ["kms:GenerateDataKey"], Resource = [aws_kms_key.data.arn] }
  ] })
}
resource "aws_ecs_task_definition" "privacy_backup" {
  family                   = "${var.name}-privacy-backup"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.privacy_backup.arn
  container_definitions = jsonencode([{
    name    = "privacy-backup", image = var.app_image, essential = true, readonlyRootFilesystem = true,
    command = ["node", "tooling/privacy-ledger-backup.mjs"],
    environment = [
      { name = "APP_MODE", value = "production" }, { name = "AWS_REGION", value = var.aws_region },
      { name = "PRIVACY_LEDGER_BUCKET", value = aws_s3_bucket.artifacts.id },
      { name = "PRIVACY_LEDGER_KMS_KEY", value = aws_kms_key.data.arn }
    ],
    secrets          = [{ name = "DATABASE_URL", valueFrom = "${var.app_secret_arn}:DATABASE_URL::" }],
    logConfiguration = { logDriver = "awslogs", options = { awslogs-group = aws_cloudwatch_log_group.app.name, awslogs-region = var.aws_region, awslogs-stream-prefix = "privacy-backup" } }
  }])
}
resource "aws_iam_role" "privacy_scheduler" {
  name               = "${var.name}-privacy-scheduler"
  assume_role_policy = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Principal = { Service = "scheduler.amazonaws.com" }, Action = "sts:AssumeRole" }] })
}
resource "aws_iam_role_policy" "privacy_scheduler" {
  role = aws_iam_role.privacy_scheduler.id
  policy = jsonencode({ Version = "2012-10-17", Statement = [
    { Effect = "Allow", Action = ["ecs:RunTask"], Resource = [aws_ecs_task_definition.privacy_backup.arn], Condition = { ArnEquals = { "ecs:cluster" = aws_ecs_cluster.app.arn } } },
    { Effect = "Allow", Action = ["iam:PassRole"], Resource = [aws_iam_role.privacy_backup.arn, aws_iam_role.execution.arn], Condition = { StringEquals = { "iam:PassedToService" = "ecs-tasks.amazonaws.com" } } }
  ] })
}
resource "aws_scheduler_schedule" "privacy_backup" {
  name                = "${var.name}-privacy-backup"
  schedule_expression = "rate(1 minute)"
  flexible_time_window { mode = "OFF" }
  target {
    arn      = aws_ecs_cluster.app.arn
    role_arn = aws_iam_role.privacy_scheduler.arn
    ecs_parameters {
      task_definition_arn = aws_ecs_task_definition.privacy_backup.arn
      launch_type         = "FARGATE"
      task_count          = 1
      network_configuration {
        subnets          = var.private_subnets
        security_groups  = [aws_security_group.tasks.id]
        assign_public_ip = false
      }
    }
    retry_policy {
      maximum_event_age_in_seconds = 300
      maximum_retry_attempts       = 2
    }
  }
  depends_on = [aws_iam_role_policy.privacy_scheduler, aws_iam_role_policy.privacy_backup, aws_s3_bucket_versioning.artifacts]
}
resource "aws_cloudwatch_log_metric_filter" "privacy_backup" {
  name           = "${var.name}-privacy-backup-success"
  log_group_name = aws_cloudwatch_log_group.app.name
  pattern        = "\"Privacy ledger backup completed.\""
  metric_transformation {
    name      = "PrivacyLedgerBackupCompleted"
    namespace = "Tandara/Operations"
    value     = "1"
  }
}
resource "aws_cloudwatch_metric_alarm" "privacy_backup" {
  alarm_name          = "${var.name}-privacy-backup-stale"
  namespace           = "Tandara/Operations"
  metric_name         = "PrivacyLedgerBackupCompleted"
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  comparison_operator = "LessThanThreshold"
  threshold           = 1
  treat_missing_data  = "breaching"
  alarm_actions       = [aws_sns_topic.alarms.arn]
}
output "privacy_backup_task" { value = aws_ecs_task_definition.privacy_backup.arn }
output "privacy_ledger_object" { value = "s3://${aws_s3_bucket.artifacts.id}/privacy/ledger/latest.json" }
