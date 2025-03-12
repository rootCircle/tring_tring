import fs from "node:fs";  
import dotenv from "dotenv";  
import pkg from "pg";  
import { WebSocketServer } from "ws";  
  
dotenv.config();  
const { Client } = pkg;  
  
const databaseConfig = {  
  database: process.env.DB_NAME || "postgres",  
  user: process.env.DB_USER || "postgres",  
  password: process.env.DB_PASS || "postgres",  
  host: process.env.DB_HOST || "localhost",  
  port: process.env.DB_PORT || 5432,  
};  
  
const ws = new WebSocketServer({ port: 8080 });  
  
async function fetchRealTimeData() {  
  const client = new Client(databaseConfig);  
  try {  
    await client.connect();  
    const query = `  
      SELECT project_name, SUM(emission_value) AS total_emissions,  
             SUM(quantity_wasted) AS total_material_waste,  
             SUM(energy_used) AS total_energy_consumption,  
             NOW() AS recorded_at  
      FROM (  
          SELECT project_name, emission_value, 0 AS quantity_wasted, 0 AS energy_used FROM carbon_emissions  
          UNION ALL  
          SELECT project_name, 0, quantity_wasted, 0 FROM material_usage  
          UNION ALL  
          SELECT project_name, 0, 0, energy_used FROM energy_consumption  
      ) AS combined_data  
      GROUP BY project_name  
      ORDER BY recorded_at DESC  
    `;  
    const result = await client.query(query);  
    return result.rows;  
  } catch (error) {  
    console.error("Database Error:", error);  
    return [];  
  } finally {  
    await client.end();  
  }  
}  
  
function detectAnomalies(data, threshold = 1.5) {  
  return data.filter((item) => {  
    const averageImpact = (item.total_emissions + item.total_material_waste + item.total_energy_consumption) / 3;  
    return item.total_emissions > averageImpact * threshold ||  
           item.total_material_waste > averageImpact * threshold ||  
           item.total_energy_consumption > averageImpact * threshold;  
  });  
}  
  
function generateImpactReport(data) {  
  const report = JSON.stringify({ timestamp: new Date(), projects: data }, null, 2);  
  fs.writeFileSync("./impact_report.json", report);  
  console.log("Impact report generated: ./impact_report.json");  
}  
  
async function processRealTimeMonitoring() {  
  const data = await fetchRealTimeData();  
  if (data.length === 0) {  
    console.log("No data available for processing.");  
    return;  
  }  
  const anomalies = detectAnomalies(data);  
  generateImpactReport(data);  
  ws.clients.forEach((client) => {  
    if (client.readyState === 1) {  
      client.send(JSON.stringify({ data, anomalies }));  
    }  
  });  
  console.log("Real-time data streamed to connected clients.");  
}  
  
processRealTimeMonitoring();

setTimeout(() => {
  ws.close(() => {
    console.log("WebSocket server closed after 5 seconds.");
  });
}, 5000);

