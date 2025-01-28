import pkg from "pg";
import { writeFileSync } from "node:fs";
import * as dotenv from "dotenv";
import { format } from "date-fns";

dotenv.config();

const { Client } = pkg;

const databaseConfig = {
	database: process.env.DB_NAME || "postgres",
	user: process.env.DB_USER || "postgres",
	password: process.env.DB_PASS || "postgres",
	host: process.env.DB_HOST || "localhost",
	port: process.env.DB_PORT || 5432,
};

async function detectUnauthorizedAccess(client) {
	const query = `
    SELECT u.username, a.timestamp, a.operation, a.affected_policy_id
    FROM access_logs a
    JOIN users u ON a.user_id = u.user_id
    WHERE EXTRACT(HOUR FROM a.timestamp) < 9 OR EXTRACT(HOUR FROM a.timestamp) > 17
  `;
	const result = await client.query(query);
	if (result.rows.length > 0) {
		console.log("Unauthorized Access Detected:");
		result.rows.forEach((log) => console.log(log));
	} else {
		console.log("No unauthorized access detected.");
	}
}

async function generateWeeklyAuditReport(client) {
	const query = `
    SELECT 
      u.username,
      COUNT(DISTINCT a.affected_policy_id) AS unique_policies_accessed,
      COUNT(a.operation) FILTER (WHERE a.operation = 'INSERT') AS insert_operations,
      COUNT(a.operation) FILTER (WHERE a.operation = 'UPDATE') AS update_operations,
      COUNT(a.operation) FILTER (WHERE a.operation = 'DELETE') AS delete_operations,
      COUNT(a.operation) FILTER (WHERE a.operation = 'SELECT') AS select_operations
    FROM users u
    JOIN access_logs a ON u.user_id = a.user_id
    GROUP BY u.username
    ORDER BY unique_policies_accessed DESC
    LIMIT 5
  `;
	const result = await client.query(query);
	const csvData = result.rows
		.map((row) => Object.values(row).join(","))
		.join("\n");
	const headers =
		"username,unique_policies_accessed,insert_operations,update_operations,delete_operations,select_operations\n";
	writeFileSync("./weekly_audit_report.csv", headers + csvData);
	console.log("Weekly audit report saved to ./weekly_audit_report.csv");
}

async function backupPolicies(client) {
	const timestamp = format(new Date(), "yyyyMMdd_HHmmss");
	const query = "SELECT * FROM policies";
	const result = await client.query(query);
	if (result.rows.length === 0) {
		console.log("No policies to back up.");
		return;
	}
	const csvData = result.rows
		.map((row) => Object.values(row).join(","))
		.join("\n");
	const headers = Object.keys(result.rows[0]).join(",") + "\n";
	const backupFileName = `./policies_backup_${timestamp}.csv`;
	writeFileSync(backupFileName, headers + csvData);
	console.log(`Policies backup saved to ${backupFileName}`);
}

async function main() {
	const client = new Client(databaseConfig);
	try {
		await client.connect();
		await detectUnauthorizedAccess(client);
		await generateWeeklyAuditReport(client);
		await backupPolicies(client);
	} catch (error) {
		console.error("An error occurred:", error.message);
	} finally {
		await client.end();
	}
}

main();
