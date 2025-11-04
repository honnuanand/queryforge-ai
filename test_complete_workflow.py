#!/usr/bin/env python3
"""
Comprehensive API workflow test to verify audit logging
Tests the complete user journey from catalog selection through query execution
"""
import requests
import json
import time
import os
from databricks import sql
from dotenv import load_dotenv

# Load from backend/.env
load_dotenv(os.path.join(os.path.dirname(__file__), 'backend', '.env'))

DATABRICKS_HOST = os.getenv("DATABRICKS_HOST", "").replace("https://", "")
DATABRICKS_TOKEN = os.getenv("DATABRICKS_TOKEN", "")
DATABRICKS_HTTP_PATH = os.getenv("DATABRICKS_HTTP_PATH", "")

# Test configuration
LOCAL_URL = "http://localhost:8000"
DEPLOYED_URL = "https://queryforge-2409307273843806.aws.databricksapps.com"

class WorkflowTester:
    def __init__(self, base_url: str, name: str):
        self.base_url = base_url
        self.name = name
        self.session = requests.Session()
        self.results = []

    def log_result(self, step: str, status: str, details: str = ""):
        result = {
            "step": step,
            "status": status,
            "details": details,
            "timestamp": time.time()
        }
        self.results.append(result)
        icon = "✅" if status == "success" else "❌" if status == "error" else "⚠️"
        print(f"{icon} {step}: {status}")
        if details:
            print(f"   {details}")

    def test_health(self):
        """Test health endpoint"""
        try:
            response = self.session.get(f"{self.base_url}/api/health", timeout=10)
            if response.status_code == 200:
                self.log_result("Health Check", "success", f"Response: {response.json()}")
                return True
            else:
                self.log_result("Health Check", "error", f"Status {response.status_code}: {response.text}")
                return False
        except Exception as e:
            self.log_result("Health Check", "error", str(e))
            return False

    def test_catalogs(self):
        """Test catalogs endpoint"""
        try:
            response = self.session.get(f"{self.base_url}/api/catalogs", timeout=10)
            if response.status_code == 200:
                catalogs = response.json()
                self.log_result("Get Catalogs", "success", f"Found {len(catalogs)} catalogs")
                return catalogs[0] if catalogs else None
            else:
                self.log_result("Get Catalogs", "error", f"Status {response.status_code}: {response.text}")
                return None
        except Exception as e:
            self.log_result("Get Catalogs", "error", str(e))
            return None

    def test_schemas(self, catalog: str):
        """Test schemas endpoint"""
        try:
            response = self.session.get(f"{self.base_url}/api/schemas/{catalog}", timeout=10)
            if response.status_code == 200:
                schemas = response.json()
                self.log_result("Get Schemas", "success", f"Found {len(schemas)} schemas in {catalog}")
                return schemas[0] if schemas else None
            else:
                self.log_result("Get Schemas", "error", f"Status {response.status_code}: {response.text}")
                return None
        except Exception as e:
            self.log_result("Get Schemas", "error", str(e))
            return None

    def test_tables(self, catalog: str, schema: str):
        """Test tables endpoint"""
        try:
            response = self.session.get(f"{self.base_url}/api/tables/{catalog}/{schema}", timeout=10)
            if response.status_code == 200:
                tables = response.json()
                self.log_result("Get Tables", "success", f"Found {len(tables)} tables in {catalog}.{schema}")
                return tables[0] if tables else None
            else:
                self.log_result("Get Tables", "error", f"Status {response.status_code}: {response.text}")
                return None
        except Exception as e:
            self.log_result("Get Tables", "error", str(e))
            return None

    def test_columns(self, catalog: str, schema: str, table: str):
        """Test columns endpoint"""
        try:
            response = self.session.get(f"{self.base_url}/api/columns/{catalog}/{schema}/{table}", timeout=10)
            if response.status_code == 200:
                columns = response.json()
                self.log_result("Get Columns", "success", f"Found {len(columns)} columns in {catalog}.{schema}.{table}")
                return columns
            else:
                self.log_result("Get Columns", "error", f"Status {response.status_code}: {response.text}")
                return None
        except Exception as e:
            self.log_result("Get Columns", "error", str(e))
            return None

    def test_generate_sql(self, catalog: str, schema: str, table: str, business_logic: str):
        """Test SQL generation endpoint"""
        try:
            payload = {
                "catalog": catalog,
                "schema": schema,
                "table": table,
                "business_logic": business_logic,
                "model": "gpt-4o"
            }
            response = self.session.post(
                f"{self.base_url}/api/generate-sql",
                json=payload,
                timeout=30
            )
            if response.status_code == 200:
                result = response.json()
                self.log_result("Generate SQL", "success", f"Generated SQL: {result.get('sql', '')[:100]}...")
                return result.get('sql')
            else:
                self.log_result("Generate SQL", "error", f"Status {response.status_code}: {response.text}")
                return None
        except Exception as e:
            self.log_result("Generate SQL", "error", str(e))
            return None

    def test_execute_sql(self, catalog: str, schema: str, sql: str):
        """Test SQL execution endpoint"""
        try:
            payload = {
                "catalog": catalog,
                "schema": schema,
                "sql": sql
            }
            response = self.session.post(
                f"{self.base_url}/api/execute-sql",
                json=payload,
                timeout=30
            )
            if response.status_code == 200:
                result = response.json()
                row_count = len(result.get('results', []))
                self.log_result("Execute SQL", "success", f"Returned {row_count} rows")
                return result
            else:
                self.log_result("Execute SQL", "error", f"Status {response.status_code}: {response.text}")
                return None
        except Exception as e:
            self.log_result("Execute SQL", "error", str(e))
            return None

    def run_complete_workflow(self):
        """Run complete user workflow"""
        print(f"\n{'='*60}")
        print(f"Testing {self.name}")
        print(f"Base URL: {self.base_url}")
        print(f"{'='*60}\n")

        # Step 1: Health check
        if not self.test_health():
            print("\n❌ Health check failed, aborting workflow")
            return False

        time.sleep(1)

        # Step 2: Get catalogs
        catalog = self.test_catalogs()
        if not catalog:
            print("\n❌ No catalogs found, aborting workflow")
            return False

        time.sleep(1)

        # Step 3: Get schemas
        schema = self.test_schemas(catalog)
        if not schema:
            print("\n❌ No schemas found, aborting workflow")
            return False

        time.sleep(1)

        # Step 4: Get tables
        table = self.test_tables(catalog, schema)
        if not table:
            print("\n❌ No tables found, aborting workflow")
            return False

        time.sleep(1)

        # Step 5: Get columns
        columns = self.test_columns(catalog, schema, table)
        if not columns:
            print("\n❌ No columns found, aborting workflow")
            return False

        time.sleep(1)

        # Step 6: Generate SQL
        business_logic = f"Show me the first 5 rows from {table}"
        sql = self.test_generate_sql(catalog, schema, table, business_logic)
        if not sql:
            print("\n❌ SQL generation failed, aborting workflow")
            return False

        time.sleep(1)

        # Step 7: Execute SQL
        result = self.test_execute_sql(catalog, schema, sql)
        if not result:
            print("\n❌ SQL execution failed")
            return False

        print(f"\n✅ Complete workflow test passed for {self.name}")
        return True

def check_audit_logs_after_test():
    """Check audit_logs table after running tests"""
    print(f"\n{'='*60}")
    print("Checking Audit Logs Table")
    print(f"{'='*60}\n")

    try:
        with sql.connect(
            server_hostname=DATABRICKS_HOST,
            http_path=DATABRICKS_HTTP_PATH,
            access_token=DATABRICKS_TOKEN
        ) as connection:
            with connection.cursor() as cursor:
                # Check total count
                cursor.execute("SELECT COUNT(*) as count FROM arao.text_to_sql.audit_logs")
                result = cursor.fetchone()
                total_count = result[0] if result else 0
                print(f"Total rows in audit_logs: {total_count}")

                # Get latest 10 entries
                cursor.execute("""
                    SELECT timestamp, event_type, status, business_logic, model_id, total_tokens, estimated_cost_usd
                    FROM arao.text_to_sql.audit_logs
                    ORDER BY timestamp DESC
                    LIMIT 10
                """)

                print("\nLatest 10 entries:")
                print("-" * 120)
                for row in cursor.fetchall():
                    business_logic_preview = row[3][:50] if row[3] else 'N/A'
                    print(f"Time: {row[0]}, Type: {row[1]}, Status: {row[2]}, Logic: {business_logic_preview}..., Model: {row[4]}, Tokens: {row[5]}, Cost: ${row[6]}")

                # Get count by event type
                cursor.execute("""
                    SELECT event_type, COUNT(*) as count
                    FROM arao.text_to_sql.audit_logs
                    GROUP BY event_type
                    ORDER BY count DESC
                """)

                print("\nCounts by event type:")
                print("-" * 60)
                for row in cursor.fetchall():
                    print(f"{row[0]}: {row[1]}")

    except Exception as e:
        print(f"❌ Error checking audit logs: {str(e)}")

if __name__ == "__main__":
    print("QueryForge AI - Complete Workflow Test")
    print("=" * 60)

    # Test local instance first
    local_tester = WorkflowTester(LOCAL_URL, "Local Instance")
    local_success = local_tester.run_complete_workflow()

    # Wait a bit before checking logs
    print("\nWaiting 5 seconds before checking audit logs...")
    time.sleep(5)

    # Check audit logs after local test
    check_audit_logs_after_test()

    # Ask user if they want to test deployed app
    print("\n" + "=" * 60)
    test_deployed = input("Test deployed Databricks app? (y/n): ").strip().lower()

    if test_deployed == 'y':
        deployed_tester = WorkflowTester(DEPLOYED_URL, "Deployed Databricks App")
        deployed_success = deployed_tester.run_complete_workflow()

        # Wait and check logs again
        print("\nWaiting 5 seconds before checking audit logs...")
        time.sleep(5)
        check_audit_logs_after_test()

    print("\n" + "=" * 60)
    print("Test Summary")
    print("=" * 60)
    print(f"Local instance: {'✅ PASSED' if local_success else '❌ FAILED'}")
    if test_deployed == 'y':
        print(f"Deployed app: {'✅ PASSED' if deployed_success else '❌ FAILED'}")
