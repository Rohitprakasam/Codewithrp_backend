import { Pool } from "pg";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";

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

    // Create or update admin from .env
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;
    const adminName = process.env.ADMIN_NAME || "System Admin";

    if (adminEmail && adminPassword) {
      const passwordHash = await bcrypt.hash(adminPassword, 10);
      await pool.query(
        `INSERT INTO users (name, email, password_hash, role) 
         VALUES ($1, $2, $3, 'admin') 
         ON CONFLICT (email) 
         DO UPDATE SET password_hash = $3, name = $1`,
        [adminName, adminEmail.toLowerCase(), passwordHash]
      );
      console.log(`Admin user configured from .env: ${adminEmail}`);
    }

    console.log("Database schema initialized and seeded successfully.");
  } catch (error) {
    console.error("Failed to initialize database schema:", error);
    throw error;
  }
};
