#!/usr/bin/env python3
"""
Execute the dashboard queries directly against the database
to compare with API results
"""

import os
from dotenv import load_dotenv
from databricks import sql
import json

load_dotenv()

DATABRICKS_HOST = os.getenv("DATABRICKS_HOST", "")
DATABRICKS_TOKEN = os.getenv("DATABRICKS_TOKEN", "")
DATABRICKS_HTTP_PATH = os.getenv("DATABRICKS_HTTP_PATH", "")

def execute_query(cursor, query_name, query):
    """Execute a query and print results"""
    print(f"\n{'='*80}")
    print(f"Query: {query_name}")
    print(f"{'='*80}")
    print(f"SQL:\n{query}\n")

    try:
        cursor.execute(query)
        result = cursor.fetchone()
        columns = [desc[0] for desc in cursor.description]

        print("Result:")
        if result:
            for col, val in zip(columns, result):
                print(f"  {col}: {val}")
        else:
            print("  No results")

        return dict(zip(columns, result)) if result else {}

    except Exception as e:
        print(f"ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        return None

def main():
    print("="*80)
    print("DIRECT DATABASE QUERY TEST")
    print("="*80)
    print(f"Host: {DATABRICKS_HOST}")
    print(f"HTTP Path: {DATABRICKS_HTTP_PATH}")
    print(f"Token length: {len(DATABRICKS_TOKEN)}")

    try:
        with sql.connect(
            server_hostname=DATABRICKS_HOST.replace("https://", ""),
            http_path=DATABRICKS_HTTP_PATH,
            access_token=DATABRICKS_TOKEN
        ) as connection:
            with connection.cursor() as cursor:

                # Query 1: Total query executions
                execute_query(cursor, "Total Query Executions", """
                    SELECT COALESCE(COUNT(*), 0) as total_executions
                    FROM arao.text_to_sql.audit_logs
                    WHERE event_type = 'sql_execution'
                """)

                # Query 2: Total LLM calls
                execute_query(cursor, "Total LLM Calls", """
                    SELECT COALESCE(COUNT(*), 0) as total_llm_calls
                    FROM arao.text_to_sql.audit_logs
                    WHERE event_type IN ('business_logic_suggestion', 'sql_generation')
                """)

                # Query 3: Average execution time
                execute_query(cursor, "Average Execution Time", """
                    SELECT COALESCE(AVG(execution_time_ms), 0) as avg_execution_time
                    FROM arao.text_to_sql.audit_logs
                    WHERE event_type = 'sql_execution' AND status = 'success'
                """)

                # Query 4: Success rate
                execute_query(cursor, "Success Rate", """
                    SELECT COALESCE(
                        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0),
                        0
                    ) as success_rate
                    FROM arao.text_to_sql.audit_logs
                """)

                # Query 5: Total rows returned
                execute_query(cursor, "Total Rows Returned", """
                    SELECT COALESCE(SUM(row_count), 0) as total_rows
                    FROM arao.text_to_sql.audit_logs
                    WHERE event_type = 'sql_execution' AND status = 'success'
                """)

                # Query 6: Unique tables
                execute_query(cursor, "Unique Tables Analyzed", """
                    SELECT COALESCE(COUNT(DISTINCT table_name), 0) as unique_tables
                    FROM arao.text_to_sql.audit_logs
                    WHERE table_name IS NOT NULL
                """)

                # Query 7: Total cost
                execute_query(cursor, "Total Cost", """
                    SELECT COALESCE(SUM(estimated_cost_usd), 0) as total_cost
                    FROM arao.text_to_sql.audit_logs
                    WHERE event_type IN ('business_logic_suggestion', 'sql_generation')
                    AND status = 'success'
                """)

                # Query 8: All events breakdown
                execute_query(cursor, "Event Type Breakdown", """
                    SELECT event_type, COUNT(*) as count, COUNT(DISTINCT log_id) as unique_logs
                    FROM arao.text_to_sql.audit_logs
                    GROUP BY event_type
                    ORDER BY count DESC
                """)

                # Query 9: Recent events
                print(f"\n{'='*80}")
                print("Recent Events (Last 10)")
                print(f"{'='*80}")
                cursor.execute("""
                    SELECT
                        timestamp,
                        event_type,
                        status,
                        catalog,
                        schema_name,
                        table_name,
                        estimated_cost_usd,
                        total_tokens,
                        execution_time_ms
                    FROM arao.text_to_sql.audit_logs
                    ORDER BY timestamp DESC
                    LIMIT 10
                """)

                columns = [desc[0] for desc in cursor.description]
                rows = cursor.fetchall()

                print(f"\n{'Timestamp':<30} {'Event Type':<25} {'Status':<10} {'Table':<20} {'Cost':<12} {'Tokens':<8} {'Time(ms)':<10}")
                print("-" * 130)

                for row in rows:
                    record = dict(zip(columns, row))
                    timestamp = str(record['timestamp'])[:26] if record['timestamp'] else 'N/A'
                    event_type = record['event_type'] or 'N/A'
                    status = record['status'] or 'N/A'
                    table_name = record['table_name'] or 'N/A'
                    cost = f"${record['estimated_cost_usd']:.6f}" if record['estimated_cost_usd'] else 'N/A'
                    tokens = str(record['total_tokens']) if record['total_tokens'] else 'N/A'
                    time_ms = str(record['execution_time_ms']) if record['execution_time_ms'] else 'N/A'

                    print(f"{timestamp:<30} {event_type:<25} {status:<10} {table_name:<20} {cost:<12} {tokens:<8} {time_ms:<10}")

    except Exception as e:
        print(f"\nFATAL ERROR: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
