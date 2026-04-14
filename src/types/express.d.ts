import { AuthUserContext } from '../models/auth.model';

declare global {
  namespace Express {
    interface Request {
      auth?: AuthUserContext;
    }
  }
}

export {};
