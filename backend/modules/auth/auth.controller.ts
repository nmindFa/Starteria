import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { ApiResponse } from '../../shared/types/api.types';
import { AppError } from '../../shared/errors/AppError';

const COOKIE_NAME = 'starteria_rt';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/api/v1/auth/refresh',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

export class AuthController {
  constructor(private service: AuthService) {}

  /**
   * POST /api/v1/auth/register
   * Validate input (already done by validate middleware), create user, issue tokens.
   */
  register = async (
    req: Request,
    res: Response<ApiResponse>,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { user, tokens } = await this.service.registerUser(req.body);

      res.cookie(COOKIE_NAME, tokens.refreshToken, COOKIE_OPTIONS);

      res.status(201).json({
        success: true,
        data: {
          accessToken: tokens.accessToken,
          user,
        },
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST /api/v1/auth/login
   * Authenticate with email/password, issue tokens.
   */
  login = async (
    req: Request,
    res: Response<ApiResponse>,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { email, password } = req.body;
      const { user, tokens } = await this.service.loginUser(email, password);

      res.cookie(COOKIE_NAME, tokens.refreshToken, COOKIE_OPTIONS);

      res.json({
        success: true,
        data: {
          accessToken: tokens.accessToken,
          user,
        },
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST /api/v1/auth/refresh
   * Extract refresh token from HTTP-only cookie, rotate, issue new pair.
   */
  refresh = async (
    req: Request,
    res: Response<ApiResponse>,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const rawRefreshToken = req.cookies?.[COOKIE_NAME];

      if (!rawRefreshToken) {
        throw AppError.unauthorized('Token de refresco requerido');
      }

      const tokens = await this.service.refreshTokens(rawRefreshToken);

      res.cookie(COOKIE_NAME, tokens.refreshToken, COOKIE_OPTIONS);

      res.json({
        success: true,
        data: {
          accessToken: tokens.accessToken,
        },
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST /api/v1/auth/logout
   * Revoke refresh token family, clear cookie.
   */
  logout = async (
    req: Request,
    res: Response<ApiResponse>,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const rawRefreshToken = req.cookies?.[COOKIE_NAME];

      if (rawRefreshToken) {
        await this.service.logoutUser(rawRefreshToken);
      }

      res.clearCookie(COOKIE_NAME, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict' as const,
        path: '/api/v1/auth/refresh',
      });

      res.json({
        success: true,
        data: { message: 'Sesion cerrada exitosamente' },
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/v1/auth/me
   * Return the currently authenticated user (set by authenticate middleware).
   */
  me = async (
    req: Request,
    res: Response<ApiResponse>,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }

      const user = await this.service.getUserById(req.user.id);

      if (!user) {
        throw AppError.notFound('Usuario');
      }

      res.json({
        success: true,
        data: user,
      });
    } catch (err) {
      next(err);
    }
  };
}
