import { UserRole } from './db/schema';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        email: string;
        role: UserRole;
        tokenVersion: number;
      };
    }
  }
}

// This file ensures the global augmentation is applied
export {};