const { Client } = require('pg');
const fs = require('node:fs');
const databaseConfig = {
  database: process.env.DB_NAME || 'postgres',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432
};

async function fetchAndAuditShipments() {
  const client = new Client(databaseConfig);
  try {
    await client.connect();
    console.log('Connected to the database');

    const query = `
      WITH updated_shipments AS (
          UPDATE shipments
          SET vessel_id = COALESCE(vessel_id, 'UNKNOWN'),
              actual_arrival_time = COALESCE(actual_arrival_time, expected_arrival_time + INTERVAL '2 hours')
          WHERE vessel_id IS NULL OR actual_arrival_time IS NULL
          RETURNING shipment_id, vessel_id, actual_arrival_time
      ),
      standardized_ports AS (
          UPDATE shipments
          SET origin_port = UPPER(origin_port),
              destination_port = UPPER(destination_port)
          WHERE origin_port IS NOT NULL OR destination_port IS NOT NULL
          RETURNING shipment_id, origin_port, destination_port
      ),
      delayed_shipments AS (
          SELECT shipment_id, vessel_id, expected_arrival_time, actual_arrival_time, origin_port, destination_port
          FROM shipments
          WHERE actual_arrival_time > expected_arrival_time
      )
      SELECT d.shipment_id, d.vessel_id, d.expected_arrival_time, d.actual_arrival_time, d.origin_port, d.destination_port
      FROM delayed_shipments d
      ORDER BY d.actual_arrival_time;
    `;

    const result = await client.query(query);
    if (result.rows.length === 0) {
      console.log('No delayed shipments found.');
      return;
    }

    console.log('Found delayed shipments:', result.rows.length);
    saveToCSV(result.rows);
  } catch (error) {
    console.error('Error during database operation:', error);
  } finally {
    await client.end();
    console.log('Disconnected from the database');
  }
}

function saveToCSV(data) {
  const header = ['shipment_id', 'vessel_id', 'expected_arrival_time', 'actual_arrival_time', 'origin_port', 'destination_port'];
  const rows = data.map(row => [
    row.shipment_id, row.vessel_id, row.expected_arrival_time, row.actual_arrival_time, row.origin_port, row.destination_port
  ]);

  const csvContent = [header, ...rows].map(row => row.join(',')).join('\n');
  fs.writeFileSync('delayedShipmentsReport.csv', csvContent);
  console.log('CSV file saved as delayedShipmentsReport.csv');
}

fetchAndAuditShipments();
