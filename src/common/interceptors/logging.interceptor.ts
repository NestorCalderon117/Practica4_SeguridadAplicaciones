import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const { method, url, ip } = request;
    const userAgent = request.get('User-Agent') || '';
    const startTime = Date.now();

    // Obtener información del usuario si está autenticado
    const user = (request as any).user;
    const userId = user?.sub || user?.userId || 'anonymous';

    this.logger.log(
      `[${method}] ${url} - IP: ${ip} - User: ${userId} - UserAgent: ${userAgent} - Iniciando`
    );

    return next.handle().pipe(
      tap({
        next: (data) => {
          const duration = Date.now() - startTime;
          const statusCode = response.statusCode;
          
          this.logger.log(
            `[${method}] ${url} - IP: ${ip} - User: ${userId} - Status: ${statusCode} - Duración: ${duration}ms - Completado`
          );
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          const statusCode = error.status || 500;
          
          this.logger.error(
            `[${method}] ${url} - IP: ${ip} - User: ${userId} - Status: ${statusCode} - Duración: ${duration}ms - Error: ${error.message}`,
            error.stack
          );
        },
      }),
    );
  }
}
