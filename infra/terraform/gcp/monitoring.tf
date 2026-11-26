# Uptime check on /ready plus alerts on downtime, pod restarts, 5xx responses and Cloud SQL CPU/disk.
# The 5xx alert counts the nginx access log's httpRequest.status (LOG_FORMAT=json, the default outside dev).

resource "google_monitoring_notification_channel" "email" {
  count        = var.alert_email == "" ? 0 : 1
  display_name = "${local.prefix} alerts"
  type         = "email"
  labels       = { email_address = var.alert_email }
  depends_on   = [google_project_service.apis]
}

resource "google_monitoring_uptime_check_config" "ready" {
  display_name = "${local.prefix} /ready"
  timeout      = "10s"
  period       = "60s"
  checker_type = "STATIC_IP_CHECKERS"

  http_check {
    path         = "/ready"
    port         = 443
    use_ssl      = true
    validate_ssl = true
    accepted_response_status_codes {
      status_class = "STATUS_CLASS_2XX"
    }
  }

  monitored_resource {
    type   = "uptime_url"
    labels = { project_id = var.project_id, host = var.public_host }
  }
  depends_on = [google_project_service.apis]
}

resource "google_logging_metric" "http_5xx" {
  name   = "${local.prefix}-http-5xx"
  filter = "resource.type=\"k8s_container\" AND resource.labels.namespace_name=\"${var.k8s_namespace}\" AND httpRequest.status>=500"
  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
    unit        = "1"
  }
  depends_on = [google_project_service.apis]
}

# supervisord restarts a crashed service inside the all-in-one pod, so restart_count never sees it; its log does.
resource "google_logging_metric" "process_exit" {
  name   = "${local.prefix}-process-exit"
  filter = "resource.type=\"k8s_container\" AND resource.labels.namespace_name=\"${var.k8s_namespace}\" AND textPayload:\"not expected\" AND textPayload:\"exited:\""
  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
    unit        = "1"
  }
  depends_on = [google_project_service.apis]
}

locals {
  sql_database_id = "${var.project_id}:${google_sql_database_instance.postgres.name}"
  alerts = {
    down = {
      title     = "Site down: /ready failing"
      filter    = "metric.type=\"monitoring.googleapis.com/uptime_check/check_passed\" AND resource.type=\"uptime_url\" AND metric.label.check_id=\"${google_monitoring_uptime_check_config.ready.uptime_check_id}\""
      aligner   = "ALIGN_NEXT_OLDER"
      reducer   = "REDUCE_COUNT_FALSE"
      group_by  = ["resource.label.host"]
      period    = "300s"
      threshold = 1 # more than one checker region failing
      duration  = "120s"
      doc       = "https://${var.public_host}/ready fails from several regions. Check the pod (kubectl get pods), then Cloud SQL and the proxy; /ready also fails when content-service or auth-service cannot reach the database."
    }
    restarts = {
      title     = "Pods restarting"
      filter    = "metric.type=\"kubernetes.io/container/restart_count\" AND resource.type=\"k8s_container\" AND resource.label.namespace_name=\"${var.k8s_namespace}\""
      aligner   = "ALIGN_DELTA"
      reducer   = "REDUCE_SUM"
      group_by  = ["resource.label.pod_name"]
      period    = "600s"
      threshold = 2
      duration  = "0s"
      doc       = "A pod restarted more than twice in 10 minutes. Look at the previous container's logs: kubectl logs <pod> --previous. Common causes: out of memory, failed startup validation."
    }
    process_exit = {
      title     = "Service crashed inside the pod"
      filter    = "metric.type=\"logging.googleapis.com/user/${google_logging_metric.process_exit.name}\" AND resource.type=\"k8s_container\""
      aligner   = "ALIGN_DELTA"
      reducer   = "REDUCE_SUM"
      group_by  = []
      period    = "600s"
      threshold = 0 # any unexpected exit
      duration  = "0s"
      doc       = "supervisord restarted a service (content, auth, Core or progress) that exited unexpectedly. Search the logs for \"not expected\" and read the lines just before it."
    }
    http_5xx = {
      title     = "5xx responses"
      filter    = "metric.type=\"logging.googleapis.com/user/${google_logging_metric.http_5xx.name}\" AND resource.type=\"k8s_container\""
      aligner   = "ALIGN_DELTA"
      reducer   = "REDUCE_SUM"
      group_by  = []
      period    = "300s"
      threshold = var.alert_5xx_per_5min
      duration  = "0s"
      doc       = "More than ${var.alert_5xx_per_5min} 5xx responses in 5 minutes. In Logs Explorer filter on httpRequest.status>=500 and severity>=ERROR to see which path and service."
    }
    sql_cpu = {
      title     = "Cloud SQL CPU above 80%"
      filter    = "metric.type=\"cloudsql.googleapis.com/database/cpu/utilization\" AND resource.type=\"cloudsql_database\" AND resource.label.database_id=\"${local.sql_database_id}\""
      aligner   = "ALIGN_MEAN"
      reducer   = "REDUCE_NONE"
      group_by  = []
      period    = "300s"
      threshold = 0.8
      duration  = "600s"
      doc       = "Database CPU has been above 80% for 10 minutes. Check Query Insights for the top queries before raising db_tier."
    }
    sql_disk = {
      title     = "Cloud SQL disk above 85%"
      filter    = "metric.type=\"cloudsql.googleapis.com/database/disk/utilization\" AND resource.type=\"cloudsql_database\" AND resource.label.database_id=\"${local.sql_database_id}\""
      aligner   = "ALIGN_MEAN"
      reducer   = "REDUCE_NONE"
      group_by  = []
      period    = "300s"
      threshold = 0.85
      duration  = "600s"
      doc       = "Database disk is above 85%. Enable storage auto-increase or raise the disk size before it fills; a full disk stops writes."
    }
  }
}

resource "google_monitoring_alert_policy" "app" {
  for_each              = local.alerts
  display_name          = "${local.prefix}: ${each.value.title}"
  combiner              = "OR"
  notification_channels = google_monitoring_notification_channel.email[*].name

  conditions {
    display_name = each.value.title
    condition_threshold {
      filter          = each.value.filter
      comparison      = "COMPARISON_GT"
      threshold_value = each.value.threshold
      duration        = each.value.duration
      aggregations {
        alignment_period     = each.value.period
        per_series_aligner   = each.value.aligner
        cross_series_reducer = each.value.reducer
        group_by_fields      = each.value.group_by
      }
      trigger {
        count = 1
      }
    }
  }

  documentation {
    content   = each.value.doc
    mime_type = "text/markdown"
  }
  depends_on = [google_project_service.apis]
}
