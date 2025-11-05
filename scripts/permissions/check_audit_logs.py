#!/usr/bin/env python3
"""
Check if audit_logs table has any data
"""
import os
from databricks import sql
from dotenv import load_dotenv

# Load from backend/.env
load_dotenv(os.path.join(os.path.dirname(__file__), 'backend', '.env'))

DATABRICKS_HOST = os.getenv("DATABRICKS_HOST", "").replace("https://", "")
DATABRICKS_TOKEN = os.getenv("DATABRICKS_TOKEN", "")
DATABRICKS_HTTP_PATH = os.getenv("DATABRICKS_HTTP_PATH", "")

print(f"Connecting to Databricks: {DATABRICKS_HOST}")
print(f"HTTP Path: {DATABRICKS_HTTP_PATH}")
print()

try:
    with sql.connect(
        server_hostname=DATABRICKS_HOST,
        http_path=DATABRICKS_HTTP_PATH,
        access_token=DATABRICKS_TOKEN
    ) as connection:
        with connection.cursor() as cursor:
            # Check table count
            cursor.execute("SELECT COUNT(*) as count FROM arao.text_to_sql.audit_logs")
            result = cursor.fetchone()
            total_count = result[0] if result else 0
            print(f"Total rows in audit_logs: {total_count}")

            if total_count > 0:
                # Get latest 5 entries
                cursor.execute("""
                    SELECT timestamp, event_type, status, business_logic, model_id, total_tokens, estimated_cost_usd
                    FROM arao.text_to_sql.audit_logs
                    ORDER BY timestamp DESC
                    LIMIT 5
                """)

                print("\nLatest 5 entries:")
                print("-" * 100)
                for row in cursor.fetchall():
                    print(f"Time: {row[0]}, Type: {row[1]}, Status: {row[2]}, Logic: {row[3][:50] if row[3] else 'N/A'}..., Model: {row[4]}, Tokens: {row[5]}, Cost: ${row[6]}")

except Exception as e:
    print(f"❌ Error: {str(e)}")
