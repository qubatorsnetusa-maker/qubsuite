import { cp } from 'node:fs/promises';
import { defineConfig } from 'tsup';

/** Production bundle: workspace packages (@qub/*) are inlined; npm dependencies stay external. */
export default defineConfig({
  entry: { server: 'src/server.ts', migrate: 'src/db/migrate.ts', 'purge-trash': 'src/jobs/purge-trash.cli.ts', 'grant-admin': 'src/jobs/grant-admin.cli.ts' },
  format: 'esm',
  platform: 'node',
  target: 'node22',
  sourcemap: true,
  clean: true,
  noExternal: [/^@qub\//],
  // Migrations are read at runtime next to the bundled migrate/server entry.
  onSuccess: async () => {
    await cp('src/db/migrations', 'dist/migrations', { recursive: true });
  },
});
