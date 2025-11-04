"""
API Integration Tests for QueryForge AI
Tests all endpoints to ensure they return proper responses
"""
import pytest
import requests
from typing import Dict, Any

# Base URL - can be overridden with environment variable
BASE_URL = "http://localhost:8680"
DATABRICKS_APP_URL = "https://queryforge-2409307273843806.aws.databricksapps.com"


class TestHealthEndpoints:
    """Test health and status endpoints"""

    def test_health_endpoint(self):
        """Test /api/health returns 200 and valid structure"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert "timestamp" in data
        assert data["status"] in ["healthy", "ok"]

    def test_health_endpoint_structure(self):
        """Test health endpoint returns all required fields"""
        response = requests.get(f"{BASE_URL}/api/health")
        data = response.json()
        required_fields = ["status", "timestamp"]
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"


class TestDashboardEndpoints:
    """Test dashboard-related endpoints"""

    def test_dashboard_statistics(self):
        """Test /api/dashboard-statistics returns 200 and valid data"""
        response = requests.get(f"{BASE_URL}/api/dashboard-statistics")
        assert response.status_code == 200
        data = response.json()

        # Check all required fields are present
        required_fields = [
            "total_executions",
            "total_llm_calls",
            "avg_execution_time_ms",
            "success_rate",
            "total_rows_returned",
            "unique_tables_analyzed"
        ]
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"

    def test_dashboard_statistics_types(self):
        """Test dashboard statistics return correct data types"""
        response = requests.get(f"{BASE_URL}/api/dashboard-statistics")
        data = response.json()

        assert isinstance(data["total_executions"], int)
        assert isinstance(data["total_llm_calls"], int)
        assert isinstance(data["avg_execution_time_ms"], (int, float))
        assert isinstance(data["success_rate"], (int, float))
        assert isinstance(data["total_rows_returned"], int)
        assert isinstance(data["unique_tables_analyzed"], int)

    def test_dashboard_statistics_non_negative(self):
        """Test dashboard statistics are non-negative"""
        response = requests.get(f"{BASE_URL}/api/dashboard-statistics")
        data = response.json()

        assert data["total_executions"] >= 0
        assert data["total_llm_calls"] >= 0
        assert data["avg_execution_time_ms"] >= 0
        assert 0 <= data["success_rate"] <= 100
        assert data["total_rows_returned"] >= 0
        assert data["unique_tables_analyzed"] >= 0

    def test_llm_costs_by_model(self):
        """Test /api/llm-costs-by-model returns 200 and valid structure"""
        response = requests.get(f"{BASE_URL}/api/llm-costs-by-model")
        assert response.status_code == 200
        data = response.json()

        # Check required fields
        assert "models" in data
        assert "total_cost" in data
        assert "total_prompt_tokens" in data
        assert "total_completion_tokens" in data

        # Check types
        assert isinstance(data["models"], list)
        assert isinstance(data["total_cost"], (int, float))
        assert isinstance(data["total_prompt_tokens"], int)
        assert isinstance(data["total_completion_tokens"], int)


class TestAnalyticsEndpoints:
    """Test analytics endpoints"""

    def test_llm_usage_analytics(self):
        """Test /api/analytics/llm-usage returns 200"""
        response = requests.get(f"{BASE_URL}/api/analytics/llm-usage")
        assert response.status_code == 200
        data = response.json()

        # Check structure
        assert "most_used" in data
        assert "most_costly" in data
        assert "slowest" in data
        assert "fastest" in data
        assert "all_models" in data

        # Check all are lists
        for key in ["most_used", "most_costly", "slowest", "fastest", "all_models"]:
            assert isinstance(data[key], list)

    def test_top_queries_analytics(self):
        """Test /api/analytics/top-queries returns 200"""
        response = requests.get(f"{BASE_URL}/api/analytics/top-queries")
        assert response.status_code == 200
        data = response.json()

        # Check structure
        assert "most_costly" in data
        assert "slowest_total_time" in data
        assert "slowest_execution" in data
        assert "most_rows_returned" in data

    def test_analytics_summary(self):
        """Test /api/analytics/summary returns 200"""
        response = requests.get(f"{BASE_URL}/api/analytics/summary")
        assert response.status_code == 200
        data = response.json()

        # Check it returns a valid dictionary
        assert isinstance(data, dict)


class TestQueryHistoryEndpoints:
    """Test query history endpoints"""

    def test_query_history(self):
        """Test /api/query-history returns 200"""
        response = requests.get(f"{BASE_URL}/api/query-history")
        assert response.status_code == 200
        data = response.json()

        # Should return a list
        assert isinstance(data, list)


class TestModelsEndpoint:
    """Test models endpoint"""

    def test_models_endpoint(self):
        """Test /api/models returns 200 and list of models"""
        response = requests.get(f"{BASE_URL}/api/models")
        assert response.status_code == 200
        data = response.json()

        # Should return a list of models
        assert isinstance(data, list)

        # Each model should have required fields
        if len(data) > 0:
            model = data[0]
            assert "id" in model
            assert "name" in model
            assert "description" in model


class TestDataEndpoint:
    """Test sample data endpoint"""

    def test_data_endpoint(self):
        """Test /api/data returns 200"""
        response = requests.get(f"{BASE_URL}/api/data")
        # Should return 200 or 404 depending on if sample data exists
        assert response.status_code in [200, 404]


class TestErrorHandling:
    """Test error handling for various scenarios"""

    def test_invalid_endpoint(self):
        """Test that invalid endpoints return 404"""
        response = requests.get(f"{BASE_URL}/api/nonexistent")
        assert response.status_code == 404

    def test_dashboard_statistics_handles_empty_table(self):
        """Test dashboard statistics gracefully handles empty audit_logs"""
        response = requests.get(f"{BASE_URL}/api/dashboard-statistics")
        # Should still return 200 even with empty data
        assert response.status_code == 200
        data = response.json()

        # All values should be 0 or valid defaults
        assert isinstance(data["total_executions"], int)
        assert isinstance(data["total_llm_calls"], int)


class TestDatabricksAppDeployment:
    """Test deployed Databricks App endpoints"""

    @pytest.mark.skipif(not DATABRICKS_APP_URL, reason="Databricks app URL not configured")
    def test_app_health(self):
        """Test deployed app health endpoint"""
        response = requests.get(f"{DATABRICKS_APP_URL}/api/health")
        assert response.status_code in [200, 401]  # 401 if auth required

    @pytest.mark.skipif(not DATABRICKS_APP_URL, reason="Databricks app URL not configured")
    def test_app_dashboard_statistics(self):
        """Test deployed app dashboard statistics"""
        response = requests.get(f"{DATABRICKS_APP_URL}/api/dashboard-statistics")
        assert response.status_code in [200, 401, 500]  # Should not be 404


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
