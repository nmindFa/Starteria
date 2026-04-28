import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { AppError } from '../../shared/errors/AppError';
import { logger } from '../../shared/utils/logger';
import { hashPassword, verifyPassword } from './password.service';
import {
  generateAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  TokenPayload,
} from './token.service';
import { RegisterInput } from './auth.schemas';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Precomputed bcrypt hash of the empty string.
 * Used to perform a constant-time dummy compare in the user-not-found branch
 * of loginUser, preventing a timing oracle that would let an attacker
 * enumerate registered emails.
 * Generated with bcrypt.hashSync('', 12).
 */
const DUMMY_PASSWORD_HASH =
  '$2b$12$bYvQg0n/JmnjjzZw9Vvj7uqQfL5WvB5kEcc0iH6m8YwJ4gI8xT0Xm';

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface SafeUser {
  id: string;
  name: string;
  email: string;
  role: string;
  initials: string;
  cohort?: string | null;
}

function computeInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

export class AuthService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Register a new user. Only 'participante' can self-register;
   * other roles must be created by an admin.
   */
  async registerUser(
    data: RegisterInput,
  ): Promise<{ user: SafeUser; tokens: AuthTokens }> {
    // Only participante can self-register
    if (data.role !== 'participante') {
      throw AppError.registerRoleForbidden();
    }

    const existing = await this.prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
    });
    if (existing) {
      throw AppError.emailTaken();
    }

    const passwordHash = await hashPassword(data.password);
    const initials = computeInitials(data.name);

    const user = await this.prisma.user.create({
      data: {
        name: data.name,
        email: data.email.toLowerCase(),
        passwordHash,
        role: data.role,
        initials,
      },
    });

    const tokens = await this.issueTokenPair(user.id, user.email, user.role, user.cohortId);

    logger.info({ userId: user.id }, 'User registered');

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        initials: user.initials,
        cohort: user.cohortId,
      },
      tokens,
    };
  }

  /**
   * Authenticate user with email/password.
   * Enforces account lockout after 5 failed attempts.
   */
  async loginUser(
    email: string,
    password: string,
  ): Promise<{ user: SafeUser; tokens: AuthTokens }> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      // Timing-oracle guard: run a dummy bcrypt compare so the response time
      // for "user not found" matches "wrong password". Result is discarded.
      await verifyPassword(password, DUMMY_PASSWORD_HASH);
      throw AppError.invalidCredentials();
    }

    // Check lockout
    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
      // Timing-oracle guard: match the response time of the wrong-password
      // branch so attackers cannot distinguish "locked" from "wrong password"
      // by latency. Result is discarded.
      await verifyPassword(password, user.passwordHash);
      const retrySeconds = Math.max(
        1,
        Math.ceil((new Date(user.lockedUntil).getTime() - Date.now()) / 1000),
      );
      throw AppError.accountLocked(retrySeconds);
    }

    const passwordValid = await verifyPassword(password, user.passwordHash);

    if (!passwordValid) {
      const failedAttempts = (user.failedLoginAttempts || 0) + 1;
      const updateData: Record<string, unknown> = { failedLoginAttempts: failedAttempts };
      let lockedUntil: Date | null = null;

      if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
        lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
        updateData.lockedUntil = lockedUntil;
        logger.warn({ userId: user.id, failedAttempts }, 'Account locked after failed attempts');
      }

      await this.prisma.user.update({
        where: { id: user.id },
        data: updateData,
      });

      if (lockedUntil) {
        const retrySeconds = Math.max(
          1,
          Math.ceil((lockedUntil.getTime() - Date.now()) / 1000),
        );
        throw AppError.accountLocked(retrySeconds);
      }

      throw AppError.invalidCredentials();
    }

    // Reset failed attempts on successful login
    if (user.failedLoginAttempts > 0 || user.lockedUntil) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
    }

    const tokens = await this.issueTokenPair(user.id, user.email, user.role, user.cohortId);

    logger.info({ userId: user.id }, 'User logged in');

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        initials: user.initials,
        cohort: user.cohortId,
      },
      tokens,
    };
  }

  /**
   * Validate a refresh token, rotate it, and issue a new token pair.
   * Implements token family reuse detection.
   */
  async refreshTokens(rawRefreshToken: string): Promise<AuthTokens> {
    const tokenHash = hashRefreshToken(rawRefreshToken);

    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!storedToken) {
      throw AppError.refreshInvalid();
    }

    // Token already revoked — potential reuse attack. Revoke entire family.
    if (storedToken.revokedAt) {
      logger.warn(
        { family: storedToken.family, userId: storedToken.userId },
        'Refresh token reuse detected — revoking entire family',
      );
      await this.prisma.refreshToken.updateMany({
        where: { family: storedToken.family },
        data: { revokedAt: new Date() },
      });
      throw AppError.refreshReused();
    }

    // Token expired
    if (new Date(storedToken.expiresAt) < new Date()) {
      await this.prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: { revokedAt: new Date() },
      });
      throw AppError.refreshExpired();
    }

    // Revoke current token
    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });

    // Issue new pair with same token family
    const { user } = storedToken;
    const tokens = await this.issueTokenPair(
      user.id,
      user.email,
      user.role,
      user.cohortId,
      storedToken.family,
    );

    return tokens;
  }

  /**
   * Logout: revoke all tokens in the refresh token's family.
   */
  async logoutUser(rawRefreshToken: string): Promise<void> {
    const tokenHash = hashRefreshToken(rawRefreshToken);

    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (storedToken) {
      // Revoke entire token family
      await this.prisma.refreshToken.updateMany({
        where: { family: storedToken.family },
        data: { revokedAt: new Date() },
      });
      logger.info({ userId: storedToken.userId }, 'User logged out — token family revoked');
    }
  }

  /**
   * Get user profile by ID (without sensitive fields).
   */
  async getUserById(userId: string): Promise<SafeUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) return null;

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      initials: user.initials,
      cohort: user.cohortId,
    };
  }

  // --- Private helpers ---

  private async issueTokenPair(
    userId: string,
    email: string,
    role: string,
    cohort?: string | null,
    existingFamily?: string,
  ): Promise<AuthTokens> {
    const payload: TokenPayload = {
      sub: userId,
      role: role as TokenPayload['role'],
      email,
      ...(cohort ? { cohort } : {}),
    };

    const accessToken = generateAccessToken(payload);
    const rawRefreshToken = generateRefreshToken();
    const family = existingFamily || crypto.randomUUID();

    await this.prisma.refreshToken.create({
      data: {
        tokenHash: hashRefreshToken(rawRefreshToken),
        userId,
        family,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    return { accessToken, refreshToken: rawRefreshToken };
  }
}
