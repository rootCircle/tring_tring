FILE_EXTENSIONS = *.png *.csv *.log
CLEAN_SQL_SCRIPT = scripts/clean_table.sql
DB_USER = postgres
DB_NAME = postgres

.PHONY: run clean clean_sql

run:
	uv run main.py

clean:
	@echo "Cleaning up files..."
	@rm -f $(FILE_EXTENSIONS)
	@echo "Cleaned up files."

clean_sql:
	@echo "Cleaning up database tables..."
	psql -U $(DB_USER) -d $(DB_NAME) -f $(CLEAN_SQL_SCRIPT)
	@echo "Database tables cleaned."

