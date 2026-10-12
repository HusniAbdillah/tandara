import { Catch, HttpException } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { ErrorResponse } from '@tandara/contracts';

@Catch()
export class ApiErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<FastifyRequest>();
    const reply = http.getResponse<FastifyReply>();
    const status = exception instanceof HttpException ? exception.getStatus() : 500;
    const codes: Record<number, string> = {
      400: 'VALIDATION_FAILED', 401: 'UNAUTHORIZED', 403: 'FORBIDDEN',
      404: 'NOT_FOUND', 409: 'CONFLICT', 429: 'RATE_LIMITED', 503: 'SERVICE_UNAVAILABLE',
    };
    const body: ErrorResponse = {
      error: {
        code: codes[status] ?? 'INTERNAL_ERROR',
        message: status >= 500 ? 'Layanan belum tersedia. Silakan coba lagi.' : exception instanceof HttpException ? exception.message : 'Permintaan tidak berhasil.',
        requestId: request.id,
      },
    };
    if (status === 500) request.log.error({ event: 'unhandled_error', requestId: request.id }, 'Unexpected API error');
    void reply.status(status).send(body);
  }
}
