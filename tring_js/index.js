import pkg from "pg";
const { Client } = pkg;
import dotenv from "dotenv";
import Joi from "joi";
import fs from "node:fs";
import csvWriter from "csv-writer";

dotenv.config();

const databaseConfig = {
	database: process.env.DB_NAME || "postgres",
	user: process.env.DB_USER || "postgres",
	password: process.env.DB_PASS || "postgres",
	host: process.env.DB_HOST || "localhost",
	port: process.env.DB_PORT || 5432,
};

const validateTemperature = Joi.number().min(-50).max(50);
const validateYield = Joi.number().min(0).max(10000);

const fetchData = async () => {
	const client = new Client(databaseConfig);
	await client.connect();
	try {
		const res = await client.query("SELECT * FROM weather_data");
		const satelliteData = await client.query("SELECT * FROM satellite_data");
		const cropYields = await client.query("SELECT * FROM crop_yields");
		return {
			res: res.rows,
			satelliteData: satelliteData.rows,
			cropYields: cropYields.rows,
		};
	} catch (error) {
		console.error("Error fetching data:", error);
		throw error;
	} finally {
		await client.end();
	}
};

const imputeMissingData = (data) => {
	return data.map((row) => {
		if (!row.temperature) {
			const avgTemp =
				data
					.filter((d) => d.location === row.location)
					.map((d) => d.temperature)
					.reduce((a, b) => a + b, 0) / data.length;
			row.temperature = avgTemp;
		}
		return row;
	});
};

const normalizeData = (data) => {
	const maxTemp = Math.max(...data.map((row) => row.temperature));
	const minTemp = Math.min(...data.map((row) => row.temperature));
	return data.map((row) => {
		row.temperature = (row.temperature - minTemp) / (maxTemp - minTemp);
		return row;
	});
};

const saveToCSV = (data, filename) => {
	const writer = csvWriter.createObjectCsvWriter({
		path: filename,
		header: [
			{ id: "location", title: "Location" },
			{ id: "year", title: "Year" },
			{ id: "predicted_yield", title: "Predicted Yield" },
			{ id: "actual_yield", title: "Actual Yield" },
		],
	});

	writer.writeRecords(data).then(() => {
		console.log("CSV file has been written successfully");
	});
};

const processData = async () => {
	try {
		const { res, satelliteData, cropYields } = await fetchData();
		const validatedData = res.filter(
			(row) => validateTemperature.validate(row.temperature).error === null,
		);
		const imputedData = imputeMissingData(validatedData);
		const normalizedData = normalizeData(imputedData);

		const yieldData = cropYields.map((row) => {
			const matchingData = normalizedData.find(
				(d) => d.location === row.location,
			);
			if (matchingData) {
				row.predicted_yield =
					0.4 * row.normalized_temperature +
					0.3 * row.normalized_precipitation +
					0.3 * row.normalized_vegetation_index;
			}
			return row;
		});

		saveToCSV(yieldData, "output.csv");
	} catch (error) {
		console.error("Error processing and visualizing data:", error);
	}
};

processData();
