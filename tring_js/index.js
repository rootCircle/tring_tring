import fs from "node:fs";  
import dotenv from "dotenv";  
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
  
async function detectUnusualSales() {  
	try {  
		await client.connect();  
		const query = `  
      WITH sales_data AS (  
        SELECT store_id, product_id, SUM(quantity_sold) AS total_sold,  
          sale_date::DATE AS sale_day  
        FROM sales  
        WHERE sale_date >= NOW() - INTERVAL '1 day'  
        GROUP BY store_id, product_id, sale_day  
      ),  
      historical_avg AS (  
        SELECT store_id, product_id, AVG(total_sold) AS avg_sales  
        FROM sales_data  
        WHERE sale_day < NOW() - INTERVAL '1 day'  
        GROUP BY store_id, product_id  
      )  
      SELECT s.store_id, s.product_id, s.total_sold, h.avg_sales  
      FROM sales_data s  
      JOIN historical_avg h ON s.store_id = h.store_id AND s.product_id = h.product_id  
      WHERE s.total_sold > h.avg_sales * 5;  
    `;  
		const res = await client.query(query);  
		return res.rows;  
	} catch (error) {  
		console.error("Error detecting unusual sales:", error);  
		return [];  
	}  
}  
  
async function fillMissingPrices() {  
	try {  
		const query = `  
      UPDATE products p  
      SET price = subquery.median_price  
      FROM (  
        SELECT category, percentile_cont(0.5) WITHIN GROUP (ORDER BY price) AS median_price  
        FROM products WHERE price IS NOT NULL  
        GROUP BY category  
      ) AS subquery  
      WHERE p.price IS NULL AND p.category = subquery.category  
      RETURNING p.product_id, p.name, p.price;  
    `;  
		const res = await client.query(query);  
		return res.rows;  
	} catch (error) {  
		console.error("Error filling missing prices:", error);  
		return [];  
	}  
}  
  
async function computeSeasonalityIndex() {  
	try {  
		const query = `  
      WITH monthly_sales AS (  
        SELECT product_id, DATE_TRUNC('month', sale_date) AS month,  
          SUM(quantity_sold) AS total_sales  
        FROM sales  
        GROUP BY product_id, month  
      ),  
      yearly_avg AS (  
        SELECT product_id, AVG(total_sales) AS avg_sales  
        FROM monthly_sales  
        GROUP BY product_id  
      )  
      SELECT m.product_id, m.month, m.total_sales, y.avg_sales,  
        (m.total_sales - y.avg_sales) / NULLIF(y.avg_sales, 0) AS seasonality_index  
      FROM monthly_sales m  
      JOIN yearly_avg y ON m.product_id = y.product_id;  
    `;  
		const res = await client.query(query);  
		return res.rows;  
	} catch (error) {  
		console.error("Error computing seasonality index:", error);  
		return [];  
	}  
}  
  
async function generateReport() {  
	try {  
		const unusualSales = await detectUnusualSales();  
		const filledPrices = await fillMissingPrices();  
		const seasonalityIndex = await computeSeasonalityIndex();  
  
		const combinedResults = {  
			unusual_sales: unusualSales,  
			filled_prices: filledPrices,  
			seasonality_index: seasonalityIndex,  
		};  
  
		fs.writeFileSync(  
			"./stock_rebalancing_results.json",  
			JSON.stringify(combinedResults, null, 2),  
		);  
  
		console.log("Report generated: ./stock_rebalancing_results.json");  
	} catch (error) {  
		console.error("Error generating report:", error);  
	} finally {  
		await client.end();  
	}  
}  
  
generateReport();  