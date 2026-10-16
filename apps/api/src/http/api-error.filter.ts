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
    const duplicate =
      typeof exception === 'object' &&
      exception !== null &&
      'code' in exception &&
      exception.code === '23505';
    const status =
      exception instanceof HttpException ? exception.getStatus() : duplicate ? 409 : 500;
    const codes: Record<number, string> = {
      400: 'VALIDATION_FAILED',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      429: 'RATE_LIMITED',
      503: 'SERVICE_UNAVAILABLE',
    };
    const detail = exception instanceof HttpException ? exception.getResponse() : undefined;
    // Expose only this application-owned reason, never arbitrary upstream errors.
    const budgetExceeded =
      status === 503 &&
      typeof detail === 'object' &&
      detail !== null &&
      'code' in detail &&
      detail.code === 'AI_BUDGET_EXCEEDED';
    const body: ErrorResponse = {
      error: {
        code: budgetExceeded ? 'AI_BUDGET_EXCEEDED' : (codes[status] ?? 'INTERNAL_ERROR'),
        message: budgetExceeded
          ? 'Batas anggaran AI tidak cukup untuk permintaan ini. Hubungi pengelola posko.'
          : status >= 500
            ? 'Layanan belum tersedia. Silakan coba lagi.'
            : duplicate
              ? 'Data dengan kunci ini sudah ada. Gunakan pengiriman yang sama untuk mencoba ulang.'
              : exception instanceof HttpException
                ? exception.message
                : 'Permintaan tidak berhasil.',
        requestId: request.id,
      },
    };
    if (status === 500)
      request.log.error(
        { event: 'unhandled_error', requestId: request.id },
        'Unexpected API error',
      );
    void reply.status(status).send(body);
  }
}
