import "dotenv/config";

// Integration tests use a dedicated database when one is configured.
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
