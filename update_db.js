require("dotenv").config();
const { Client } = require("pg");
const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
client.connect().then(() => client.query("ALTER TABLE problems ADD COLUMN IF NOT EXISTS display_id SERIAL UNIQUE;")).then(() => { console.log("DB updated"); process.exit(0); }).catch(console.error);
