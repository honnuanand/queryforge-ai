#!/usr/bin/env python3
"""
Script to add token tracking columns to audit_logs table
"""
import os
from databricks import sql
from dotenv import load_dotenv

load_dotenv()

DATABRICKS_HOST = os.getenv("DATABRICKS_HOST", "")
DATABRICKS_TOKEN = os.getenv("DATABRICKS_TOKEN", "")
DATABRICKS_HTTP_PATH = os.getenv("DATABRICKS_HTTP_PATH", "")

def add_token_columns():
    """Add token tracking columns to audit_logs table"""

    # Read the SQL script
    with open('add_token_columns.sql', 'r') as f:
        sql_script = f.read()

    print("🔨 Adding token tracking columns to audit_logs table...")

    with sql.connect(
        server_hostname=DATABRICKS_HOST.replace("https://", ""),
        http_path=DATABRICKS_HTTP_PATH,
        access_token=DATABRICKS_TOKEN
    ) as connection:
        with connection.cursor() as cursor:
            try:
                cursor.execute(sql_script)
                print("  ✅ Token tracking columns added successfully")
            except Exception as e:
                print(f"  ⚠️ Failed to add columns: {str(e)}")
                # Check if columns already exist
                if "already exists" in str(e).lower():
                    print("  ℹ️ Columns may already exist")
                else:
                    raise

    print("✅ Token tracking setup complete!")

if __name__ == "__main__":
    add_token_columns()
