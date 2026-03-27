export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code?: string;
  public readonly isOperational: boolean;

  constructor(
    statusCode: number,
    message: string,
    code?: string,
    isOperational = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, AppError.prototype);
  }

  static badRequest(message: string, code?: string): AppError {
    return new AppError(400, message, code);
  }

  static unauthorized(message = 'No autorizado'): AppError {
    return new AppError(401, message, 'UNAUTHORIZED');
  }

  static forbidden(message = 'Acceso denegado'): AppError {
    return new AppError(403, message, 'FORBIDDEN');
  }

  static notFound(resource = 'Recurso'): AppError {
    return new AppError(404, `${resource} no encontrado`, 'NOT_FOUND');
  }

  static conflict(message: string): AppError {
    return new AppError(409, message, 'CONFLICT');
  }

  static internal(message = 'Error interno del servidor'): AppError {
    return new AppError(500, message, 'INTERNAL_ERROR', false);
  }
}
