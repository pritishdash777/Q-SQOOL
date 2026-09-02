

import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './backend/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: 'postgresql://neondb_owner:YOUR_KEY@ep-something.us-east-2.aws.neon.tech/neondb?sslmode=require',
  },
});