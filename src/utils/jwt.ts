import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import env from '../config/env';
import { UserForJWT } from '../db/schema';

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  tokenVersion: number;
}

export interface RefreshTokenPayload {
  userId: string;
  jti: string;
  tokenVersion: number;
}

interface RefreshTokenInput {
  userId: string;
  tokenVersion: number;
}

class JWTService {
  private accessTokenSecret: string;
  private refreshTokenSecret: string;
  private accessTokenExpiry: string;
  private refreshTokenExpiry: string;

  constructor() {
    this.accessTokenSecret = env.JWT_ACCESS_SECRET;
    this.refreshTokenSecret = env.JWT_REFRESH_SECRET;
    this.accessTokenExpiry = '15m'; // 15 minutes
    this.refreshTokenExpiry = '7d'; // 7 days
  }

  /**
   * Generate access token for user
   */
  generateAccessToken(user: UserForJWT): string {
    const payload: JWTPayload = {
      userId: user.userId,
      email: user.email,
      role: user.role,
      tokenVersion: user.tokenVersion,
    };

    return jwt.sign(payload, this.accessTokenSecret, {
      expiresIn: this.accessTokenExpiry,
      issuer: 'store-cataloguer-api',
      audience: 'store-cataloguer-client',
    } as jwt.SignOptions);
  }

  /**
   * Generate refresh token with unique jti
   */
  generateRefreshToken(userId: string, tokenVersion: number): { token: string; jti: string } {
    const jti = uuidv4();
    
    const payload: RefreshTokenInput = {
      userId,
      tokenVersion,
    };

    const token = jwt.sign(payload, this.refreshTokenSecret, {
      expiresIn: this.refreshTokenExpiry,
      issuer: 'store-cataloguer-api',
      audience: 'store-cataloguer-client',
      jwtid: jti,
    } as jwt.SignOptions);

    return { token, jti };
  }

  /**
   * Verify access token
   */
  verifyAccessToken(token: string): JWTPayload {
    try {
      return jwt.verify(token, this.accessTokenSecret, {
        issuer: 'store-cataloguer-api',
        audience: 'store-cataloguer-client',
      }) as JWTPayload;
    } catch (error) {
      throw new Error('Invalid access token');
    }
  }

  /**
   * Verify refresh token
   */
  verifyRefreshToken(token: string): RefreshTokenPayload {
    try {
      return jwt.verify(token, this.refreshTokenSecret, {
        issuer: 'store-cataloguer-api',
        audience: 'store-cataloguer-client',
      }) as RefreshTokenPayload;
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }

  /**
   * Get token expiry date for refresh token
   */
  getRefreshTokenExpiry(): Date {
    const now = new Date();
    now.setDate(now.getDate() + 7); // 7 days from now
    return now;
  }

  /**
   * Extract bearer token from authorization header
   */
  extractBearerToken(authHeader: string | undefined): string | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    return authHeader.substring(7);
  }
}

export const jwtService = new JWTService();
export default jwtService;