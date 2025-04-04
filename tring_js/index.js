import dotenv from 'dotenv';
import pkg from 'pg';

const { Client } = pkg;
dotenv.config();

const databaseConfig = {
  database: process.env.DB_NAME || 'postgres',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
};

const MAX_CLAIM_AMOUNT = 50000;

const client = new Client(databaseConfig);

async function updateRiskScores() {
  try {
    await client.connect();

    const result = await client.query(`
      WITH fraud_counts AS (
        SELECT policyholder_id, COUNT(*) AS fraud_claims
        FROM fraud_detections
        WHERE flagged_at >= NOW() - INTERVAL '6 months'
        GROUP BY policyholder_id
        HAVING COUNT(*) > 2
      ),
      claim_stats AS (
        SELECT
          c.policyholder_id,
          COUNT(*) AS total_claims,
          AVG(c.claim_amount) AS avg_claim_amount,
          SUM(CASE WHEN c.status = 'FRAUD_SUSPECTED' THEN 1 ELSE 0 END) * 100.0 / COUNT(*) AS fraud_percentage,
          SUM(CASE WHEN c.status = 'FRAUD_SUSPECTED' AND c.claim_date >= NOW() - INTERVAL '3 months' THEN 1 ELSE 0 END) AS recent_frauds
        FROM claims c
        GROUP BY c.policyholder_id
      )
      SELECT
        p.id AS policyholder_id,
        p.name,
        f.fraud_claims,
        cs.total_claims,
        cs.avg_claim_amount,
        cs.fraud_percentage,
        cs.recent_frauds
      FROM fraud_counts f
      JOIN claim_stats cs ON f.policyholder_id = cs.policyholder_id
      JOIN policyholders p ON f.policyholder_id = p.id;
    `);

    if (result.rows.length === 0) {
      console.log('No policyholders with sufficient fraud claims were found.');
    } else {
      for (const row of result.rows) {
        const fraudPercentage = Number.parseFloat(row.fraud_percentage) || 0;
        const avgClaimAmount = Number.parseFloat(row.avg_claim_amount) || 0;
        const recentFraudRate = row.total_claims > 0
          ? (Number.parseInt(row.recent_frauds) / Number.parseInt(row.total_claims)) * 100
          : 0;

        const weightedScore =
          (fraudPercentage * 0.5) +
          ((avgClaimAmount / MAX_CLAIM_AMOUNT) * 100 * 0.3) +
          (recentFraudRate * 0.2);

        await client.query(`
          UPDATE policyholders
          SET risk_score = $1
          WHERE id = $2
        `, [weightedScore.toFixed(2), row.policyholder_id]);

        console.log(`Updated risk score for ${row.name}: ${weightedScore.toFixed(2)}`);
      }
    }

  } catch (error) {
    console.error('Error processing risk score updates:', error);
  } finally {
    await client.end();
  }
}

updateRiskScores();

