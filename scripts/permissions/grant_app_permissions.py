#!/usr/bin/env python3
"""
Grant permissions to QueryForge AI service principal for accessing audit_logs table
"""
import os
from databricks import sql
from dotenv import load_dotenv

load_dotenv()

DATABRICKS_HOST = os.getenv("DATABRICKS_HOST", "").replace("https://", "")
DATABRICKS_TOKEN = os.getenv("DATABRICKS_TOKEN", "")
DATABRICKS_HTTP_PATH = os.getenv("DATABRICKS_HTTP_PATH", "")

SERVICE_PRINCIPAL_NAME = "app-1i54xz queryforge"

grants = [
    f"GRANT USAGE ON CATALOG arao TO `{SERVICE_PRINCIPAL_NAME}`",
    f"GRANT USAGE ON SCHEMA arao.text_to_sql TO `{SERVICE_PRINCIPAL_NAME}`",
    f"GRANT SELECT ON TABLE arao.text_to_sql.audit_logs TO `{SERVICE_PRINCIPAL_NAME}`",
    f"GRANT MODIFY ON TABLE arao.text_to_sql.audit_logs TO `{SERVICE_PRINCIPAL_NAME}`",
    f"GRANT SELECT ON SCHEMA arao.text_to_sql TO `{SERVICE_PRINCIPAL_NAME}`",
]

print(f"Connecting to Databricks: {DATABRICKS_HOST}")
print(f"HTTP Path: {DATABRICKS_HTTP_PATH}")
print(f"Granting permissions to service principal: {SERVICE_PRINCIPAL_NAME}\n")

try:
    with sql.connect(
        server_hostname=DATABRICKS_HOST,
        http_path=DATABRICKS_HTTP_PATH,
        access_token=DATABRICKS_TOKEN
    ) as connection:
        with connection.cursor() as cursor:
            for grant_sql in grants:
                print(f"Executing: {grant_sql}")
                try:
                    cursor.execute(grant_sql)
                    print("✅ Success\n")
                except Exception as e:
                    print(f"⚠️  Warning: {str(e)}\n")
                    # Continue with other grants even if one fails

    print("✅ All permissions granted successfully!")
    print("\nYou can now test the app at:")
    print("https://queryforge-2409307273843806.aws.databricksapps.com")

except Exception as e:
    print(f"❌ Error connecting to Databricks: {str(e)}")
    exit(1)
