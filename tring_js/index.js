import fs from "node:fs";
import dotenv from "dotenv";
import { parse } from "json2csv";
import pkg from "pg";

dotenv.config();
const { Client } = pkg;

const databaseConfig = {
  database: process.env.DB_NAME || "postgres",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASS || "postgres",
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 5432,
};

const client = new Client(databaseConfig);

const injectionPatterns = [/UNION\s+SELECT/i, /DROP\s+TABLE/i, /--/g, /;/g];

const queryLimits = new Map();
const timeWindow = 60000;
const maxQueries = 5;

const sanitizeSQL = (query) => query.replace(/['";]/g, "");

const detectInjection = (query) =>
  injectionPatterns.some((pattern) => pattern.test(query));

const enforceRateLimit = (userId) => {
  const now = Date.now();
  if (!queryLimits.has(userId)) queryLimits.set(userId, []);
  queryLimits.set(
    userId,
    queryLimits.get(userId).filter((timestamp) => now - timestamp < timeWindow),
  );
  queryLimits.get(userId).push(now);
  return queryLimits.get(userId).length > maxQueries;
};

const logBlockedQuery = async (userId, query) => {
  const logEntry = { userId, query, timestamp: new Date().toISOString() };
  fs.appendFileSync("./blocked_queries.json", `${JSON.stringify(logEntry)}\n`);
  const csvData = parse([logEntry], {
    fields: ["userId", "query", "timestamp"],
    header: false,
  });
  fs.appendFileSync("./blocked_queries.csv", `${csvData}\n`);
};

const executeQuery = async (userId, query) => {
  try {
    await client.connect();
    if (detectInjection(query) || enforceRateLimit(userId)) {
      await logBlockedQuery(userId, query);
      return;
    }
    const sanitizedQuery = sanitizeSQL(query);
    const _result = await client.query(sanitizedQuery);
  } catch (_error) {
  } finally {
    await client.end();
  }
};

export { executeQuery };
