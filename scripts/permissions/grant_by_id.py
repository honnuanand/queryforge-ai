#!/usr/bin/env python3
"""
Grant permissions using service principal ID
"""
import os
from databricks import sql
from dotenv import load_dotenv

# Load from backend/.env
load_dotenv(os.path.join(os.path.dirname(__file__), 'backend', '.env'))

DATABRICKS_HOST = os.getenv("DATABRICKS_HOST", "").replace("https://", "")
DATABRICKS_TOKEN = os.getenv("DATABRICKS_TOKEN", "")
DATABRICKS_HTTP_PATH = os.getenv("DATABRICKS_HTTP_PATH", "")

# Try different formats for the service principal
SERVICE_PRINCIPAL_ID = "804ce2c2-c3a1-4640-8b21-ebae0466f495"  # client_id
SERVICE_PRINCIPAL_NUM_ID = "70538942960574"  # numeric ID

grants_by_uuid = [
    f"GRANT USAGE ON CATALOG arao TO `{SERVICE_PRINCIPAL_ID}`",
    f"GRANT USAGE ON SCHEMA arao.text_to_sql TO `{SERVICE_PRINCIPAL_ID}`",
    f"GRANT SELECT ON TABLE arao.text_to_sql.audit_logs TO `{SERVICE_PRINCIPAL_ID}`",
    f"GRANT MODIFY ON TABLE arao.text_to_sql.audit_logs TO `{SERVICE_PRINCIPAL_ID}`",
]

print(f"Connecting to Databricks: {DATABRICKS_HOST}")
print(f"Granting permissions to service principal ID: {SERVICE_PRINCIPAL_ID}\n")

try:
    with sql.connect(
        server_hostname=DATABRICKS_HOST,
        http_path=DATABRICKS_HTTP_PATH,
        access_token=DATABRICKS_TOKEN
    ) as connection:
        with connection.cursor() as cursor:
            for grant_sql in grants_by_uuid:
                print(f"Executing: {grant_sql}")
                try:
                    cursor.execute(grant_sql)
                    print("✅ Success\n")
                except Exception as e:
                    print(f"⚠️  Error: {str(e)}\n")

    print("✅ Completed!")

except Exception as e:
    print(f"❌ Error: {str(e)}")
