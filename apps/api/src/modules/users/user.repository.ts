import type { CurrentUser, UserSummary } from '@qub/shared';
import { and, eq, inArray } from 'drizzle-orm';
import type { Executor } from '../../db';
import { driveFolders, userIdentities, users, type UserRow } from '../../db/schema';

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

  async create(db: Executor, data: { email: string; name: string; passwordHash: string | null; emailVerified?: boolean }): Promise<UserRow> {
    const [row] = await db
      .insert(users)
      .values({ ...data, email: data.email.toLowerCase(), emailVerified: data.emailVerified ?? false, emailVerifiedAt: data.emailVerified ? new Date() : null })
      .returning();
    return row!;
  },

  async update(db: Executor, id: string, data: Partial<Pick<UserRow, 'name' | 'avatarUrl' | 'passwordHash' | 'emailVerified' | 'emailVerifiedAt' | 'lastLoginAt' | 'status'>>) {
    const [row] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return row;
  },

  async summaries(db: Executor, ids: string[]): Promise<Map<string, UserSummary>> {
    const unique = [...new Set(ids.filter(Boolean))];
    if (unique.length === 0) return new Map();
    const rows = await db
      .select({ id: users.id, email: users.email, name: users.name, avatarUrl: users.avatarUrl })
      .from(users)
      .where(inArray(users.id, unique));
    return new Map(rows.map((r) => [r.id, toUserSummary(r)]));
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
    const [kc] = await db
      .select({ username: userIdentities.username })
      .from(userIdentities)
      .where(and(eq(userIdentities.userId, user.id), eq(userIdentities.provider, 'kingschat')))
      .limit(1);
    return {
      ...toUserSummary(user),
      emailVerified: user.emailVerified,
      createdAt: user.createdAt.toISOString(),
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      rootFolderId: rootFolderId!,
      platformRole: user.platformRole,
      hasPassword: user.passwordHash !== null,
      isPro: user.isPro || user.storageUnlimited || user.platformRole === 'SUPERADMIN' || user.platformRole === 'ADMIN',
      kingschat: kc ? { username: kc.username } : null,
    };
  },
};
