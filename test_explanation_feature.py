#!/usr/bin/env python3
"""
Test the new SQL explanation feature
"""

import requests
import json

LOCAL_URL = "http://localhost:8680"

def test_generate_sql_with_explanation():
    """Test that SQL generation includes explanation"""
    print("=" * 100)
    print("Testing SQL Generation with Explanation Feature")
    print("=" * 100)

    payload = {
        "catalog": "arao",
        "schema_name": "aircraft",
        "table": "pilots",
        "columns": ["pilot_id", "name", "total_flight_hours", "experience_years"],
        "business_logic": "Find pilots with more than 5000 flight hours",
        "model_id": "databricks-claude-sonnet-4-5"
    }

    print(f"\nRequest:")
    print(f"POST {LOCAL_URL}/api/generate-sql")
    print(f"Payload: {json.dumps(payload, indent=2)}\n")

    try:
        response = requests.post(
            f"{LOCAL_URL}/api/generate-sql",
            json=payload,
            timeout=30
        )

        print(f"Response Status: {response.status_code}\n")

        if response.status_code == 200:
            data = response.json()

            print("✓ SUCCESS\n")
            print("-" * 100)
            print("Response Data:")
            print("-" * 100)

            # Check if explanation field exists
            if "explanation" in data:
                print(f"\n📝 EXPLANATION:")
                print(f"   {data['explanation']}")
                print()
            else:
                print(f"\n⚠️  WARNING: No 'explanation' field in response")
                print()

            # Display SQL query
            if "sql_query" in data:
                print(f"🔍 SQL QUERY:")
                print(f"   {data['sql_query']}")
                print()
            else:
                print(f"\n❌ ERROR: No 'sql_query' field in response")
                print()

            # Display model used
            if "model_used" in data:
                print(f"🤖 MODEL: {data['model_used']}\n")

            # Full response
            print("-" * 100)
            print("Full JSON Response:")
            print("-" * 100)
            print(json.dumps(data, indent=2))
            print()

            # Validation
            print("-" * 100)
            print("VALIDATION:")
            print("-" * 100)
            has_explanation = "explanation" in data and data["explanation"]
            has_sql = "sql_query" in data and data["sql_query"]
            has_model = "model_used" in data and data["model_used"]

            print(f"  ✓ Has explanation field: {has_explanation}")
            print(f"  ✓ Has sql_query field: {has_sql}")
            print(f"  ✓ Has model_used field: {has_model}")
            print()

            if has_explanation and has_sql and has_model:
                print("🎉 ALL CHECKS PASSED! Explanation feature is working correctly.")
                return True
            else:
                print("❌ SOME CHECKS FAILED! Please review the response.")
                return False
        else:
            print(f"❌ FAILED")
            print(f"Error: {response.text}")
            return False

    except Exception as e:
        print(f"❌ EXCEPTION: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_generate_sql_with_explanation()
    exit(0 if success else 1)
