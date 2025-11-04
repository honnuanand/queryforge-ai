# Testing Guide for QueryForge AI

This document describes how to run tests for QueryForge AI to ensure quality before deployment.

## Backend API Tests

### Setup
```bash
cd backend
pip install -r requirements-test.txt
```

### Run Tests
```bash
# Make sure the backend is running on localhost:8680
cd backend
python3 app.py

# In another terminal, run the tests
cd backend/tests
python3 test_api_integration.py
```

Or use pytest:
```bash
cd backend
pytest tests/test_api_integration.py -v
```

### What is Tested
- Health endpoint validation
- Dashboard statistics (all fields, types, non-negative values)
- LLM costs by model
- Analytics endpoints (LLM usage, top queries, summary)
- Query history
- Models endpoint
- Error handling for empty tables
- Invalid endpoints (404 handling)

## Frontend UI Tests

### Setup
```bash
cd frontend
npm install
npx playwright install
```

### Run Tests
```bash
# Make sure the frontend is running on localhost:5173
cd frontend
npm run dev

# In another terminal, run the tests
npm test                 # Run all tests headless
npm run test:headed      # Run with browser visible
npm run test:ui          # Run in interactive UI mode
npm run test:report      # View test report
```

### What is Tested
- Dashboard page load without errors
- Navigation between pages (Dashboard, SQL Generator, Query History, Analytics)
- App information accordion expand/collapse
- Key metrics cards display
- Auto-refresh toggle and refresh button
- API integration (no 500 errors)
- Error recovery and graceful handling
- Responsive design (mobile, tablet)
- Network failure handling

## Pre-Deployment Checklist

Before deploying to Databricks Apps:

1. **Run Backend Tests**
   ```bash
   cd backend && pytest tests/test_api_integration.py -v
   ```
   ✅ All tests should pass

2. **Run Frontend Tests**
   ```bash
   cd frontend && npm test
   ```
   ✅ All tests should pass

3. **Build Frontend**
   ```bash
   cd frontend && npm run build
   ```
   ✅ Build should complete without errors

4. **Deploy to Databricks**
   ```bash
   python3 deploy_to_databricks.py
   ```
   ✅ Use regular deploy for code changes
   ✅ Only use `--hard-redeploy` for infrastructure changes

## Continuous Integration

These tests should be run automatically in CI/CD pipeline before any deployment to production.
