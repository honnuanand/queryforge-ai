#!/usr/bin/env python3
"""
Test the specific dashboard queries to see which one fails
"""

import os
from dotenv import load_dotenv
from databricks import sql

load_dotenv()

DATABRICKS_HOST = os.getenv("DATABRICKS_HOST", "")
DATABRICKS_TOKEN = os.getenv("DATABRICKS_TOKEN", "")
DATABRICKS_HTTP_PATH = os.getenv("DATABRICKS_HTTP_PATH", "")

print(f"Host: {DATABRICKS_HOST}")
print(f"HTTP Path: {DATABRICKS_HTTP_PATH}")
print(f"Token length: {len(DATABRICKS_TOKEN)}\n")

try:
    with sql.connect(
        server_hostname=DATABRICKS_HOST.replace("https://", ""),
        http_path=DATABRICKS_HTTP_PATH,
        access_token=DATABRICKS_TOKEN
    ) as connection:
        with connection.cursor() as cursor:

            # Query 1: Total executions (the failing one)
            print("="*80)
            print("Query 1: Total Executions")
            print("="*80)
            query1 = """
                SELECT COALESCE(COUNT(*), 0) as total_executions
                FROM arao.text_to_sql.audit_logs
                WHERE event_type = 'sql_execution'
            """
            print(f"SQL: {query1.strip()}\n")
            try:
                cursor.execute(query1)
                result = cursor.fetchone()
                print(f"Result: {result[0]}")
                print("✓ SUCCESS\n")
            except Exception as e:
                print(f"✗ FAILED: {str(e)}\n")

            # Query 2: Check event_type values
            print("="*80)
            print("Query 2: All Event Types")
            print("="*80)
            query2 = """
                SELECT event_type, COUNT(*) as count
                FROM arao.text_to_sql.audit_logs
                GROUP BY event_type
                ORDER BY count DESC
            """
            print(f"SQL: {query2.strip()}\n")
            try:
                cursor.execute(query2)
                rows = cursor.fetchall()
                print("Event types in table:")
                for row in rows:
                    print(f"  {row[0]}: {row[1]}")
                print("✓ SUCCESS\n")
            except Exception as e:
                print(f"✗ FAILED: {str(e)}\n")

            # Query 3: Total LLM calls (this works)
            print("="*80)
            print("Query 3: Total LLM Calls")
            print("="*80)
            query3 = """
                SELECT COALESCE(COUNT(*), 0) as total_llm_calls
                FROM arao.text_to_sql.audit_logs
                WHERE event_type IN ('business_logic_suggestion', 'sql_generation')
            """
            print(f"SQL: {query3.strip()}\n")
            try:
                cursor.execute(query3)
                result = cursor.fetchone()
                print(f"Result: {result[0]}")
                print("✓ SUCCESS\n")
            except Exception as e:
                print(f"✗ FAILED: {str(e)}\n")

            # Query 4: Success rate (this works)
            print("="*80)
            print("Query 4: Success Rate")
            print("="*80)
            query4 = """
                SELECT COALESCE(
                    SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0),
                    0
                ) as success_rate
                FROM arao.text_to_sql.audit_logs
            """
            print(f"SQL: {query4.strip()}\n")
            try:
                cursor.execute(query4)
                result = cursor.fetchone()
                print(f"Result: {result[0]}")
                print("✓ SUCCESS\n")
            except Exception as e:
                print(f"✗ FAILED: {str(e)}\n")

except Exception as e:
    print(f"Connection failed: {str(e)}")
    import traceback
    traceback.print_exc()
