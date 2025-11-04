#!/usr/bin/env python3
"""Test script to verify Databricks SQL connection with detailed debugging."""

import os
import sys
from dotenv import load_dotenv
from databricks import sql

def test_sql_connection():
    """Test the Databricks SQL connection with the current credentials."""

    # Load environment variables from backend/.env
    env_path = os.path.join(os.path.dirname(__file__), 'backend', '.env')
    print(f"Loading environment from: {env_path}")
    load_dotenv(env_path)

    # Get credentials
    host = os.getenv("DATABRICKS_HOST", "")
    token = os.getenv("DATABRICKS_TOKEN", "")
    http_path = os.getenv("DATABRICKS_HTTP_PATH", "")

    print("\n" + "="*60)
    print("DATABRICKS SQL CONNECTION TEST")
    print("="*60)
    print(f"\nHost: {host}")
    print(f"HTTP Path: {http_path}")
    print(f"Token length: {len(token) if token else 0}")
    print(f"Token (first 10 chars): {token[:10] if token else 'MISSING'}...")

    # Validate credentials
    if not host:
        print("\n❌ ERROR: DATABRICKS_HOST is not set")
        sys.exit(1)
    if not token:
        print("\n❌ ERROR: DATABRICKS_TOKEN is not set")
        sys.exit(1)
    if not http_path:
        print("\n❌ ERROR: DATABRICKS_HTTP_PATH is not set")
        sys.exit(1)

    # Remove https:// from hostname
    hostname = host.replace("https://", "").replace("http://", "")
    print(f"\nProcessed hostname: {hostname}")

    print("\n" + "-"*60)
    print("ATTEMPTING CONNECTION...")
    print("-"*60)

    try:
        # Attempt connection
        with sql.connect(
            server_hostname=hostname,
            http_path=http_path,
            access_token=token
        ) as connection:
            print("\n✅ Connection established successfully!")

            # Test basic query
            print("\n" + "-"*60)
            print("TESTING QUERY: SHOW CATALOGS")
            print("-"*60)

            with connection.cursor() as cursor:
                cursor.execute("SHOW CATALOGS")
                catalogs = cursor.fetchall()

                print(f"\n✅ Query executed successfully!")
                print(f"\nFound {len(catalogs)} catalog(s):")
                for i, row in enumerate(catalogs, 1):
                    print(f"  {i}. {row[0]}")

                # Test another query
                print("\n" + "-"*60)
                print("TESTING QUERY: SELECT current_database()")
                print("-"*60)

                cursor.execute("SELECT current_database()")
                result = cursor.fetchone()
                print(f"\n✅ Current database: {result[0]}")

    except Exception as e:
        print(f"\n❌ CONNECTION FAILED!")
        print(f"\nError type: {type(e).__name__}")
        print(f"Error message: {str(e)}")

        # Provide helpful debugging info
        print("\n" + "="*60)
        print("DEBUGGING SUGGESTIONS:")
        print("="*60)
        print("1. Verify the warehouse is running in Databricks workspace")
        print("2. Check that the token has SQL warehouse access permissions")
        print("3. Verify the HTTP path format: /sql/1.0/warehouses/<warehouse-id>")
        print("4. Ensure the workspace hostname is correct")

        sys.exit(1)

    print("\n" + "="*60)
    print("✅ ALL TESTS PASSED!")
    print("="*60)

if __name__ == "__main__":
    test_sql_connection()
