.PHONY: setup frontend-build frontend-test run test clean-local

setup:
	python3 -m venv .venv
	.venv/bin/python -m pip install --upgrade pip
	.venv/bin/python -m pip install -r requirements.txt
	cd frontend && npm install
	cd frontend && npm run build

frontend-build:
	cd frontend && npm run build

frontend-test:
	cd frontend && npm test

run:
	.venv/bin/python run.py

test:
	.venv/bin/python -m unittest discover -s tests -v
	cd frontend && npm test

clean-local:
	@echo "For safety, remove data/ and logs/ manually if you want a fresh workspace."
