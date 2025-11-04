#!/usr/bin/env python3
"""
Test the deployed Databricks app endpoints to diagnose the dashboard statistics issue
"""

import requests
import json

# Deployed app URL
DEPLOYED_URL = "https://queryforge-2409307273843806.aws.databricksapps.com"

def test_endpoint(endpoint: str, name: str):
    """Test a specific endpoint"""
    url = f"{DEPLOYED_URL}{endpoint}"
    print(f"\n{'='*80}")
    print(f"Testing: {name}")
    print(f"URL: {url}")
    print(f"{'='*80}")

    try:
        response = requests.get(url)
        print(f"Status Code: {response.status_code}")

        if response.status_code == 200:
            data = response.json()
            print("Response:")
            print(json.dumps(data, indent=2))
        else:
            print(f"Error Response: {response.text}")

    except Exception as e:
        print(f"Exception: {str(e)}")

# Test all relevant endpoints
print("Testing Deployed Databricks App Endpoints")
print(f"Base URL: {DEPLOYED_URL}\n")

test_endpoint("/api/health", "Health Check")
test_endpoint("/api/debug/config", "Debug Config")
test_endpoint("/api/dashboard-statistics", "Dashboard Statistics")
test_endpoint("/api/query-history", "Query History")
test_endpoint("/api/llm-analytics", "LLM Analytics")
test_endpoint("/api/llm-costs-by-model", "LLM Costs by Model")

print(f"\n{'='*80}")
print("Testing Complete")
print(f"{'='*80}\n")
