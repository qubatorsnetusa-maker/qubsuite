import { eq } from 'drizzle-orm';
import { env } from '../config/env';
import { createDb } from '../db';
import { auditLogs, users } from '../db/schema';

/**
 * Makes an existing account a super admin (or back to a regular user with --revoke). This is how the first
 * super admin is created; after that, super admins manage roles in the admin console.
 *
 *   pnpm admin:grant alice@example.com
 *   pnpm admin:grant alice@example.com --revoke
 */
async function main() {
  const args = process.argv.slice(2);
  const email = args.find((a) => !a.startsWith('--'))?.trim().toLowerCase();
  const revoke = args.includes('--revoke');
  if (!email) {
    console.error('Usage: pnpm admin:grant <email> [--revoke]');
    process.exit(2);
  }
  const db = createDb(env.DATABASE_URL, { max: 1 });
  try {
    const [user] = await db.db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user || user.status === 'DELETED') {
      console.error(`No account with the email ${email}. The person must sign up first.`);
      process.exit(1);
    }
    const role = revoke ? 'USER' : 'SUPER_ADMIN';
    await db.db.transaction(async (tx) => {
      await tx.update(users).set({ platformRole: role }).where(eq(users.id, user.id));
      await tx.insert(auditLogs).values({
        actorId: null,
        event: 'admin.role_changed',
        targetType: 'user',
        targetId: user.id,
        userAgent: 'cli',
        metadata: { email: user.email, from: user.platformRole, to: role, via: 'cli' },
      });
    });
    console.log(`${user.email} is now ${role === 'SUPER_ADMIN' ? 'a super admin' : 'a regular user'}.`);
  } finally {
    await db.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
