#!/usr/bin/env python3
"""
Compare API responses between local and deployed instances
"""

import requests
import json

LOCAL_URL = "http://localhost:8000"
DEPLOYED_URL = "https://queryforge-2409307273843806.aws.databricksapps.com"

def test_api(base_url, name):
    """Test API endpoints"""
    print(f"\n{'='*100}")
    print(f"{name.upper()} - {base_url}")
    print(f"{'='*100}\n")

    endpoints = [
        ("/api/health", "Health Check"),
        ("/api/dashboard-statistics", "Dashboard Statistics"),
        ("/api/query-history", "Query History"),
        ("/api/llm-analytics", "LLM Analytics"),
    ]

    results = {}

    for endpoint, description in endpoints:
        url = f"{base_url}{endpoint}"
        print(f"Testing: {description}")
        print(f"URL: {url}")

        try:
            response = requests.get(url, timeout=10)
            print(f"Status: {response.status_code}")

            if response.status_code == 200:
                data = response.json()

                # For dashboard statistics, print key metrics
                if "dashboard-statistics" in endpoint:
                    print(f"  Total Executions: {data.get('total_executions', 'N/A')}")
                    print(f"  Total LLM Calls: {data.get('total_llm_calls', 'N/A')}")
                    print(f"  Success Rate: {data.get('success_rate', 'N/A')}%")
                    print(f"  Avg Time: {data.get('avg_execution_time_ms', 'N/A')}ms")

                # For query history, print count
                elif "query-history" in endpoint:
                    sessions = data.get('query_sessions', [])
                    print(f"  Query Sessions: {len(sessions)}")
                    if sessions:
                        print(f"  Latest session timestamp: {sessions[0].get('timestamp', 'N/A')}")

                # For LLM analytics, print aggregates
                elif "llm-analytics" in endpoint:
                    agg = data.get('aggregates', {})
                    print(f"  Total Cost: ${agg.get('total_cost_usd', 'N/A')}")
                    print(f"  Total Tokens: {agg.get('total_tokens', 'N/A')}")
                    print(f"  Total LLM Calls: {agg.get('total_llm_calls', 'N/A')}")

                results[endpoint] = {"status": "success", "data": data}
            else:
                print(f"  Error: {response.status_code}")
                print(f"  Response: {response.text[:200]}")
                results[endpoint] = {"status": "error", "code": response.status_code, "message": response.text[:200]}

        except Exception as e:
            print(f"  Exception: {str(e)}")
            results[endpoint] = {"status": "exception", "error": str(e)}

        print()

    return results

# Test local instance
print("TESTING LOCAL AND DEPLOYED APIS")
print("="*100)

local_results = test_api(LOCAL_URL, "Local Instance")
deployed_results = test_api(DEPLOYED_URL, "Deployed Instance")

# Compare dashboard statistics
print(f"\n{'='*100}")
print("COMPARISON: Dashboard Statistics")
print(f"{'='*100}\n")

endpoint = "/api/dashboard-statistics"

if endpoint in local_results and endpoint in deployed_results:
    local_data = local_results[endpoint].get('data', {})
    deployed_data = deployed_results[endpoint].get('data', {})

    metrics = ['total_executions', 'total_llm_calls', 'success_rate', 'avg_execution_time_ms']

    print(f"{'Metric':<30} {'Local':<20} {'Deployed':<20} {'Match':<10}")
    print("-" * 80)

    for metric in metrics:
        local_val = local_data.get(metric, 'N/A')
        deployed_val = deployed_data.get(metric, 'N/A')
        match = "✓" if local_val == deployed_val else "✗"

        print(f"{metric:<30} {str(local_val):<20} {str(deployed_val):<20} {match:<10}")

else:
    print("Could not compare - one or both APIs failed")

# Save results
with open("api_comparison_results.json", "w") as f:
    json.dump({
        "local": local_results,
        "deployed": deployed_results
    }, f, indent=2, default=str)

print(f"\n\nFull results saved to: api_comparison_results.json")
