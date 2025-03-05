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

const preprocessData = (data) => {
  if (!Array.isArray(data) || data.length === 0) return [];
  const validData = data
    .filter((entry) => entry.region && entry.crop_id && entry.harvest_date)
    .map((entry) => ({
      ...entry,
      harvest_date: new Date(entry.harvest_date).toISOString().split("T")[0],
      yield_amount: Number.parseFloat(entry.yield_amount) || 0,
    }));
  const minYield = Math.min(...validData.map((d) => d.yield_amount));
  const maxYield = Math.max(...validData.map((d) => d.yield_amount));
  return validData.map((entry) => ({
    ...entry,
    normalized_yield:
      maxYield !== minYield
        ? (entry.yield_amount - minYield) / (maxYield - minYield)
        : 0,
  }));
};

const generateSQLQuery = ({ cropType, region, startDate, endDate }) => {
  let query = `
    SELECT y.crop_id, c.name AS crop_name, y.region, y.harvest_date,
           y.yield_amount, e.temperature, e.rainfall, e.soil_moisture
    FROM yield_data y
    JOIN crops c ON y.crop_id = c.id
    LEFT JOIN environmental_factors e
      ON y.region = e.region AND y.harvest_date = e.date
  `;
  const conditions = [];
  if (cropType) conditions.push(`c.name = '${cropType}'`);
  if (region) conditions.push(`y.region = '${region}'`);
  if (startDate) conditions.push(`y.harvest_date >= '${startDate}'`);
  if (endDate) conditions.push(`y.harvest_date <= '${endDate}'`);
  if (conditions.length) query += ` WHERE ${conditions.join(" AND ")}`;
  return query;
};

const fetchAndProcessData = async (params, exportFormat) => {
  const client = new Client(databaseConfig);
  try {
    await client.connect();
    const query = generateSQLQuery(params);
    const result = await client.query(query);
    if (!result.rows.length) throw new Error("No data found.");
    const processedData = preprocessData(result.rows);
    if (exportFormat === "csv") {
      fs.writeFileSync("./crop_yield_analysis.csv", parse(processedData));
      console.log("CSV file saved at ./crop_yield_analysis.csv");
    } else if (exportFormat === "json") {
      fs.writeFileSync("./crop_yield_analysis.json", JSON.stringify(processedData, null, 2));
      console.log("JSON file saved at ./crop_yield_analysis.json");
    }
    console.log("Data processing complete.");
    return processedData;
  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    await client.end();
  }
};

fetchAndProcessData(
  { cropType: "Wheat", region: "Midwest", startDate: "2020-01-01", endDate: "2023-01-01" },
  "csv"
);
