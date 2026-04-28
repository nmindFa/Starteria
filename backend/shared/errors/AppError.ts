export interface AppErrorDetail {
  field: string;
  code: string;
  message: string;
}

export interface AppErrorOptions {
  field?: string;
  hint?: string;
  retryAfterSeconds?: number;
  details?: AppErrorDetail[];
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code?: string;
  public readonly isOperational: boolean;
  public readonly field?: string;
  public readonly hint?: string;
  public readonly retryAfterSeconds?: number;
  public readonly details?: AppErrorDetail[];

  constructor(
    statusCode: number,
    message: string,
    code?: string,
    isOperational = true,
    options: AppErrorOptions = {},
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.field = options.field;
    this.hint = options.hint;
    this.retryAfterSeconds = options.retryAfterSeconds;
    this.details = options.details;
    Object.setPrototypeOf(this, AppError.prototype);
  }

  // --- Generic factories (kept backward-compatible; extended with domain code + options) ---

  static badRequest(message: string, code?: string, options: AppErrorOptions = {}): AppError {
    return new AppError(400, message, code, true, options);
  }

  static unauthorized(message = 'No autorizado.', code: string = 'UNAUTHORIZED', options: AppErrorOptions = {}): AppError {
    return new AppError(401, message, code, true, options);
  }

  static forbidden(message = 'No tienes permiso.', code: string = 'FORBIDDEN', options: AppErrorOptions = {}): AppError {
    return new AppError(403, message, code, true, options);
  }

  /**
   * 404 factory. `code` defaults to a domain-specific value when caller passes one
   * (e.g. 'PROJECT_NOT_FOUND'); falls back to generic 'NOT_FOUND' otherwise.
   */
  static notFound(resource = 'Recurso', code: string = 'NOT_FOUND', options: AppErrorOptions = {}): AppError {
    return new AppError(404, `${resource} no encontrado.`, code, true, options);
  }

  static conflict(message: string, code: string = 'CONFLICT', options: AppErrorOptions = {}): AppError {
    return new AppError(409, message, code, true, options);
  }

  static internal(message = 'Error interno del servidor.'): AppError {
    return new AppError(500, message, 'INTERNAL_ERROR', false);
  }

  // --- Auth-specific factories (envelope v1) ---

  /** Anti-enumeration: same code for user-not-found and wrong-password. */
  static invalidCredentials(): AppError {
    return new AppError(
      401,
      'Correo o contrasena incorrectos.',
      'AUTH_INVALID_CREDENTIALS',
      true,
      { hint: 'Verifica tus datos o restablece tu contrasena.' },
    );
  }

  static emailTaken(): AppError {
    return new AppError(
      409,
      'Ya existe una cuenta con ese correo.',
      'AUTH_EMAIL_TAKEN',
      true,
      {
        field: 'email',
        hint: 'Inicia sesion o recupera tu acceso.',
      },
    );
  }

  static accountLocked(retryAfterSeconds: number): AppError {
    const safeRetry = Math.max(1, Math.ceil(retryAfterSeconds));
    const minutes = Math.max(1, Math.ceil(safeRetry / 60));
    return new AppError(
      423,
      'Cuenta bloqueada por intentos fallidos.',
      'AUTH_ACCOUNT_LOCKED',
      true,
      {
        retryAfterSeconds: safeRetry,
        hint: `Intenta de nuevo en ${minutes} minutos o restablece tu contrasena.`,
      },
    );
  }

  static rateLimited(retryAfterSeconds: number): AppError {
    const safeRetry = Math.max(1, Math.ceil(retryAfterSeconds));
    return new AppError(
      429,
      'Demasiados intentos en poco tiempo.',
      'AUTH_RATE_LIMITED',
      true,
      {
        retryAfterSeconds: safeRetry,
        hint: `Espera ${safeRetry} segundos antes de reintentar.`,
      },
    );
  }

  static registerRoleForbidden(): AppError {
    return new AppError(
      403,
      'Solo participantes pueden registrarse aqui.',
      'AUTH_REGISTER_ROLE_FORBIDDEN',
      true,
      { hint: 'Otros roles los crea un administrador.' },
    );
  }

  static refreshInvalid(): AppError {
    return new AppError(
      401,
      'Tu sesion expiro.',
      'AUTH_REFRESH_TOKEN_INVALID',
      true,
      { hint: 'Inicia sesion nuevamente.' },
    );
  }

  static refreshExpired(): AppError {
    return new AppError(
      401,
      'Tu sesion expiro.',
      'AUTH_REFRESH_TOKEN_EXPIRED',
      true,
      { hint: 'Inicia sesion nuevamente.' },
    );
  }

  static refreshReused(): AppError {
    return new AppError(
      401,
      'Detectamos un uso indebido de la sesion. Por seguridad la cerramos.',
      'AUTH_REFRESH_TOKEN_REUSED',
      true,
      { hint: 'Inicia sesion otra vez.' },
    );
  }

  static validation(details: AppErrorDetail[]): AppError {
    return new AppError(
      400,
      'Revisa los datos ingresados.',
      'VALIDATION_ERROR',
      true,
      { details },
    );
  }
}
