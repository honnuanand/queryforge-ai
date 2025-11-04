#!/usr/bin/env python3
"""
Script to create the audit_logs table in Databricks
"""
import os
from databricks import sql
from dotenv import load_dotenv

load_dotenv()

DATABRICKS_HOST = os.getenv("DATABRICKS_HOST", "")
DATABRICKS_TOKEN = os.getenv("DATABRICKS_TOKEN", "")
DATABRICKS_HTTP_PATH = os.getenv("DATABRICKS_HTTP_PATH", "")

def create_audit_table():
    """Create the audit_logs table"""

    # Read the SQL script
    with open('create_audit_table.sql', 'r') as f:
        sql_script = f.read()

    # Split by semicolon to execute each statement separately
    statements = [stmt.strip() for stmt in sql_script.split(';') if stmt.strip()]

    print("🔨 Creating audit_logs table...")

    with sql.connect(
        server_hostname=DATABRICKS_HOST.replace("https://", ""),
        http_path=DATABRICKS_HTTP_PATH,
        access_token=DATABRICKS_TOKEN
    ) as connection:
        with connection.cursor() as cursor:
            for i, statement in enumerate(statements, 1):
                print(f"  Executing statement {i}/{len(statements)}...")
                try:
                    cursor.execute(statement)
                    print(f"  ✅ Statement {i} completed")
                except Exception as e:
                    print(f"  ⚠️ Statement {i} failed: {str(e)}")

    print("✅ Audit table setup complete!")

if __name__ == "__main__":
    create_audit_table()
