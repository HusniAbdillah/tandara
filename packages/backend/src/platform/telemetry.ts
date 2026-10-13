import { trace, metrics, SpanStatusCode } from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
let sdk: NodeSDK | undefined;
export function startTelemetry(service: string) {
  if (
    ['true', '1'].includes(process.env['LANGSMITH_TRACING'] ?? '') ||
    ['true', '1'].includes(process.env['LANGCHAIN_TRACING_V2'] ?? '')
  )
    throw new Error('External model content tracing is prohibited.');
  if (!process.env['OTEL_EXPORTER_OTLP_ENDPOINT']) return;
  sdk = new NodeSDK({
    serviceName: service,
    traceExporter: new OTLPTraceExporter(),
    metricReaders: [
      new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter(),
        exportIntervalMillis: 30000,
      }),
    ],
    instrumentations: [],
  });
  sdk.start();
}
export async function stopTelemetry() {
  await sdk?.shutdown();
}
export async function observeAi<T>(
  task: string,
  provider: string,
  work: () => Promise<T>,
): Promise<T> {
  const attributes = { 'ai.task': task, 'ai.provider': provider };
  const meter = metrics.getMeter('tandara');
  const start = Date.now();
  return trace.getTracer('tandara').startActiveSpan('ai.workflow', { attributes }, async (span) => {
    try {
      const result = await work();
      meter.createCounter('tandara.ai.completed').add(1, attributes);
      return result;
    } catch (error) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: 'AI workflow failed' });
      meter.createCounter('tandara.ai.failed').add(1, attributes);
      throw error;
    } finally {
      meter.createHistogram('tandara.ai.duration_ms').record(Date.now() - start, attributes);
      span.end();
    }
  });
}
export function recordQueueMetrics(
  rows: { task: string; count: number; age: number }[],
  budgetPercent: number,
  workers: number,
) {
  const meter = metrics.getMeter('tandara');
  const tasks = [
    'triage',
    'duplicates',
    'briefing',
    'answer',
    'clarification',
    'public_summary',
    'plan_draft',
    'training_draft',
    'translation',
    'coverage',
    'knowledge_index',
  ];
  for (const task of tasks) {
    const row = rows.find((r) => r.task === task);
    const attributes = { 'ai.task': task };
    meter.createGauge('tandara.ai.queue.pending').record(row?.count ?? 0, attributes);
    meter.createGauge('tandara.ai.queue.oldest_seconds').record(row?.age ?? 0, attributes);
  }
  meter.createGauge('tandara.ai.budget.reserved_percent').record(budgetPercent);
  meter.createGauge('tandara.worker.healthy').record(workers);
}
