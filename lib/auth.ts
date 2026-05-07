import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET!;

export interface SessionPayload {
  email: string;
  locker_id: string;
  session_id?: string;
}

export function signToken(payload: SessionPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: '2h' });
}

export function verifyToken(token: string): SessionPayload | null {
  try {
    return jwt.verify(token, SECRET) as SessionPayload;
  } catch {
    return null;
  }
}
