# Country Compatibility Explorer Makefile
# Standardize common environment tasks

.PHONY: help setup seed test run clean

# Default command shows help
help:
	@echo "Country & Academic Compatibility Explorer - Make Command Reference"
	@echo "--------------------------------------------------------"
	@echo "make setup          - Create virtualenv and install settings"
	@echo "make seed-life      - Re-initialize and populate the Life (country/city) database"
	@echo "make seed-academic  - Re-initialize and populate the Academic database"
	@echo "make test-life      - Run Life validation test suite"
	@echo "make test-academic  - Run Academic validation test suite"
	@echo "make run            - Start the local HTTP compatibility server"
	@echo "make clean          - Remove compiled cache files and local db"

# Setup virtual environment
setup:
	python3 -m venv .venv
	@echo "Virtual environment created in .venv/."
	@echo "Activate it with: source .venv/bin/activate"

# Seed databases
seed-life:
	.venv/bin/python3 init_db.py

seed-academic:
	.venv/bin/python3 init_db_academic.py

# Run validation tests
test-life:
	.venv/bin/python3 test.py

test-academic:
	.venv/bin/python3 test_academic.py

# Start local server
run:
	.venv/bin/python3 app.py

# Clean up pycache files and database
clean:
	rm -rf __pycache__
	rm -rf js/__pycache__
	rm -f country_compat.db
	rm -f academic.db
	@echo "Cleaned up cache folders and database files."
