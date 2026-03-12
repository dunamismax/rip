import { SpanStatusCode, trace } from '@opentelemetry/api'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions'
import { loadEnv } from './env'

declare global {
  // eslint-disable-next-line no-var
  var __ripTelemetryReady: boolean | undefined
}

export function initObservability() {
  // Existing synchronous callers still work because the OTLP exporter is optional.
  // When an endpoint is configured we warm it up asynchronously before the first span.
  if (globalThis.__ripTelemetryReady) {
    return Promise.resolve()
  }

  return (async () => {
    const env = loadEnv()
    const spanProcessors: BatchSpanProcessor[] = []

    if (env.otelExporterOtlpEndpoint) {
      const { OTLPTraceExporter } = await import(
        '@opentelemetry/exporter-trace-otlp-http'
      )

      spanProcessors.push(
        new BatchSpanProcessor(
          new OTLPTraceExporter({
            url: `${env.otelExporterOtlpEndpoint.replace(/\/$/, '')}/v1/traces`,
          })
        )
      )
    }

    const provider = new NodeTracerProvider({
      resource: resourceFromAttributes({
        [ATTR_SERVICE_NAME]: env.otelServiceName,
      }),
      spanProcessors,
    })

    provider.register()
    globalThis.__ripTelemetryReady = true
  })()
}

export const tracer = trace.getTracer('rip')

export async function withSpan<T>(
  name: string,
  attributes: Record<string, string | number | boolean | undefined>,
  run: () => Promise<T>
) {
  await initObservability()

  return tracer.startActiveSpan(name, async (span) => {
    Object.entries(attributes).forEach(([key, value]) => {
      if (value !== undefined) {
        span.setAttribute(key, value)
      }
    })

    try {
      const result = await run()
      span.setStatus({ code: SpanStatusCode.OK })
      return result
    } catch (error) {
      span.recordException(
        error instanceof Error ? error : new Error(String(error))
      )
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unexpected error',
      })
      throw error
    } finally {
      span.end()
    }
  })
}
