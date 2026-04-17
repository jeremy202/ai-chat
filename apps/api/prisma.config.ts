import "dotenv/config";

import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url:
      process.env.DATABASE_URL ??
      "postgresql://neondb_owner:npg_Yd5TuOmBDiJ8@ep-round-field-a44vexg6-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
  },
});
