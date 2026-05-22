import { Pool } from "pg";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL is not set in environment variables");
  process.exit(1);
}

// Clean sslmode parameter from connection string to prevent pg parser from overriding rejectUnauthorized config
const cleanDatabaseUrl = databaseUrl.replace(/[&?]sslmode=[^&]+/gi, "");

export const pool = new Pool({
  connectionString: cleanDatabaseUrl,
  ssl: {
    rejectUnauthorized: false, // Bypasses self-signed certificate check for Supabase
  },
});

export const query = (text: string, params?: any[]) => {
  return pool.query(text, params);
};

export const initDb = async () => {
  try {
    console.log("Initializing database schema...");
    const schemaPath = path.resolve(process.cwd(), "schema.sql");
    if (!fs.existsSync(schemaPath)) {
      console.warn(`schema.sql not found at ${schemaPath}. Skipping schema initialization.`);
      return;
    }
    const schemaSql = fs.readFileSync(schemaPath, "utf8");
    await pool.query(schemaSql);
    console.log("Database schema initialized and seeded successfully.");
  } catch (error) {
    console.error("Failed to initialize database schema:", error);
  }
};
