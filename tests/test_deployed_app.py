#!/usr/bin/env python3
"""
Test script to verify the deployed Databricks App is working correctly
"""
import requests
import json

# App URL
APP_URL = "https://queryforge-2409307273843806.aws.databricksapps.com"

def test_health():
    """Test health endpoint"""
    print("Testing health endpoint...")
    response = requests.get(f"{APP_URL}/api/health")
    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}")
    print()

def test_dashboard():
    """Test dashboard statistics endpoint"""
    print("Testing dashboard statistics...")
    response = requests.get(f"{APP_URL}/api/dashboard/statistics")
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"Total Queries: {data.get('total_queries')}")
        print(f"Total Cost: ${data.get('total_cost_usd', 0):.4f}")
        print(f"Query Executions: {data.get('query_executions', 0)}")
        print(f"Success Rate: {data.get('success_rate', 0):.1f}%")
    else:
        print(f"Error: {response.text}")
    print()

def test_query_history():
    """Test query history endpoint"""
    print("Testing query history...")
    response = requests.get(f"{APP_URL}/api/query-history")
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"Found {len(data)} queries in history")
        if data:
            print(f"Latest query:")
            print(f"  Timestamp: {data[0].get('timestamp')}")
            print(f"  Business Logic: {data[0].get('business_logic', '')[:50]}...")
            print(f"  Status: {data[0].get('status')}")
    else:
        print(f"Error: {response.text}")
    print()

if __name__ == "__main__":
    print("Testing QueryForge AI Deployed App")
    print("=" * 60)
    print()

    test_health()
    test_dashboard()
    test_query_history()
