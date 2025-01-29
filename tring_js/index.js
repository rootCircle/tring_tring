import pkg from 'pg';
const { Client } = pkg;  
import fs from 'node:fs';  
import dotenv from 'dotenv';  
import { parse } from 'json2csv';  
  
dotenv.config();  
  
const databaseConfig = {  
  database: process.env.DB_NAME || 'postgres',  
  user: process.env.DB_USER || 'postgres',  
  password: process.env.DB_PASS || 'postgres',  
  host: process.env.DB_HOST || 'localhost',  
  port: process.env.DB_PORT || 5432  
};  
  
async function fetchData() {  
  const client = new Client(databaseConfig);  
  try {  
    await client.connect();  
    const res = await client.query(`  
      WITH center_material_processing AS (  
        SELECT  
          rc.id AS recycling_center_id,  
          rc.name AS center_name,  
          m.material_type,  
          SUM(m.weight) AS total_weight  
        FROM  
          materials m  
        JOIN  
          recycling_centers rc ON m.recycling_center_id = rc.id  
        JOIN  
          material_lifecycle ml ON ml.material_id = m.id  
        WHERE  
          ml.status = 'Processed' AND ml.end_time IS NOT NULL  
        GROUP BY  
          rc.id, rc.name, m.material_type  
      )  
      SELECT  
        material_type,  
        recycling_center_id,  
        center_name,  
        total_weight  
      FROM  
        center_material_processing  
      ORDER BY  
        total_weight DESC;  
    `);  
  
    if (res.rows.length === 0) {  
      console.log('No data found!');  
      return;  
    }  
  
    const csv = parse(res.rows);  
    fs.writeFileSync('./recycling_center_processing_summary.csv', csv);  
    console.log('CSV file has been saved!');  
  } catch (err) {  
    console.error('Error during database query:', err.message);  
  } finally {  
    await client.end();  
  }  
}  
  
fetchData();  
