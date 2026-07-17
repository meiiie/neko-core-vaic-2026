import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';

/**
 * Real credential + session handling for the MVP:
 * - scrypt password hashes (node:crypto, per-user salt);
 * - opaque session IDs in an HttpOnly SameSite cookie — deliberately NOT JWT
 *   in localStorage (team decision recorded in the master plan discussion).
 * All seeded people remain synthetic; no real student data exists.
 */

const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12h — enough for the event day

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 32).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, expected] = stored.split(':');
  if (!salt || !expected) return false;
  const actual = scryptSync(password, salt, 32);
  const expectedBuf = Buffer.from(expected, 'hex');
  return actual.length === expectedBuf.length && timingSafeEqual(actual, expectedBuf);
}

export interface SessionUser {
  id: string;
  username: string;
  role: 'STUDENT' | 'TEACHER';
  name: string;
  initials: string;
  shortName: string;
  subtitle: string;
  learnerProfile: string | null;
}

export function createSession(db: DatabaseSync, userId: string): string {
  const id = randomUUID() + randomUUID().replaceAll('-', '');
  const now = Date.now();
  db.prepare('INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').run(
    id,
    userId,
    new Date(now).toISOString(),
    new Date(now + SESSION_TTL_MS).toISOString(),
  );
  return id;
}

export function destroySession(db: DatabaseSync, sessionId: string): void {
  db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
}

export function userForSession(db: DatabaseSync, sessionId: string): SessionUser | null {
  const row = db
    .prepare(
      `SELECT u.id, u.username, u.role, u.name, u.initials, u.short_name, u.subtitle,
              u.learner_profile, s.expires_at
       FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?`,
    )
    .get(sessionId) as
    | {
        id: string;
        username: string;
        role: 'STUDENT' | 'TEACHER';
        name: string;
        initials: string;
        short_name: string;
        subtitle: string;
        learner_profile: string | null;
        expires_at: string;
      }
    | undefined;
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    destroySession(db, sessionId);
    return null;
  }
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    name: row.name,
    initials: row.initials,
    shortName: row.short_name,
    subtitle: row.subtitle,
    learnerProfile: row.learner_profile,
  };
}
