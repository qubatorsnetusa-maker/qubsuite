import { userSummaryCache } from '../../utils/fast-cache';
import type { CurrentUser, UserSummary } from '@qub/shared';
import { and, eq, inArray } from 'drizzle-orm';
import type { Executor } from '../../db';
import { driveFolders, users, type UserRow } from '../../db/schema';

export function toUserSummary(u: Pick<UserRow, 'id' | 'email' | 'name' | 'avatarUrl'>): UserSummary {
  return { id: u.id, email: u.email, name: u.name, avatarUrl: u.avatarUrl };
}

export const UserRepository = {
  async findById(db: Executor, id: string): Promise<UserRow | undefined> {
    const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return row;
  },

  async findByEmail(db: Executor, email: string): Promise<UserRow | undefined> {
    const [row] = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
    return row;
  },

  async create(db: Executor, data: { email: string; name: string; passwordHash: string }): Promise<UserRow> {
    const [row] = await db.insert(users).values({ ...data, email: data.email.toLowerCase() }).returning();
    return row!;
  },

  async update(db: Executor, id: string, data: Partial<Pick<UserRow, 'name' | 'avatarUrl' | 'passwordHash' | 'emailVerified' | 'emailVerifiedAt' | 'lastLoginAt' | 'status'>>) {
    const [row] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return row;
  },

  async summaries(db: Executor, ids: string[]): Promise<Map<string, UserSummary>> {
    const unique = [...new Set(ids.filter(Boolean))];
    if (unique.length === 0) return new Map();
    const out = new Map<string, UserSummary>();
    const missing: string[] = [];
    for (const id of unique) {
      const cached = userSummaryCache.get(id);
      if (cached) out.set(id, cached);
      else missing.push(id);
    }
    if (missing.length > 0) {
      const rows = await db
        .select({ id: users.id, email: users.email, name: users.name, avatarUrl: users.avatarUrl })
        .from(users)
        .where(inArray(users.id, missing));
      for (const r of rows) {
        const s = toUserSummary(r);
        userSummaryCache.set(r.id, s);
        out.set(r.id, s);
      }
    }
    return out;
  },

  async rootFolderId(db: Executor, userId: string): Promise<string | undefined> {
    const [row] = await db
      .select({ id: driveFolders.id })
      .from(driveFolders)
      .where(and(eq(driveFolders.ownerId, userId), eq(driveFolders.isRoot, true)))
      .limit(1);
    return row?.id;
  },

  async toCurrentUser(db: Executor, user: UserRow): Promise<CurrentUser> {
    const rootFolderId = await UserRepository.rootFolderId(db, user.id);
    return {
      ...toUserSummary(user),
      emailVerified: user.emailVerified,
      createdAt: user.createdAt.toISOString(),
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      rootFolderId: rootFolderId!,
      platformRole: user.platformRole,
    };
  },
};
