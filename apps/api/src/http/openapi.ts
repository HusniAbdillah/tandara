import { errorResponseSchema, healthResponseSchema, systemInfoSchema } from '@tandara/contracts';
import { z } from 'zod';

// Document implemented routes only. Future feature contracts do not imply working endpoints.
export function buildOpenApiDocument() {
  return {
    openapi: '3.1.0',
    info: { title: 'Tandara Foundation API', version: '0.0.0' },
    paths: {
      '/health': {
        get: {
          operationId: 'getHealth',
          responses: {
            '200': {
              description: 'Process alive',
              content: { 'application/json': { schema: z.toJSONSchema(healthResponseSchema) } },
            },
          },
        },
      },
      '/ready': {
        get: {
          operationId: 'getReadiness',
          responses: {
            '200': {
              description: 'Database available',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['status', 'dependencies'],
                    properties: {
                      status: { const: 'ready' },
                      dependencies: {
                        type: 'object',
                        required: ['database'],
                        properties: { database: { const: 'ok' } },
                      },
                    },
                  },
                },
              },
            },
            '503': {
              description: 'Database unavailable',
              content: { 'application/json': { schema: z.toJSONSchema(errorResponseSchema) } },
            },
          },
        },
      },
      '/api/v1/system/info': {
        get: {
          operationId: 'getSystemInfo',
          responses: {
            '200': {
              description: 'Foundation metadata',
              content: { 'application/json': { schema: z.toJSONSchema(systemInfoSchema) } },
            },
          },
        },
      },
    },
  };
}
