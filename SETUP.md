# QueryForge AI - Complete Setup Guide

This guide will walk you through setting up QueryForge AI from scratch, including creating all necessary databases, schemas, tables, and deploying the application.

## Prerequisites

- Databricks workspace with Unity Catalog enabled
- Python 3.9 or higher
- Node.js 18 or higher
- Git
- Databricks CLI installed and configured
- GitHub CLI (gh) for repository management

## Step 1: Environment Setup

### 1.1 Clone the Repository

```bash
git clone https://github.com/honnuanand/queryforge-ai.git
cd queryforge-ai
```

### 1.2 Create Backend Environment File

```bash
cd backend
cp .env.example .env
```

Edit the `.env` file with your Databricks credentials:

```env
DATABRICKS_HOST=https://your-workspace.cloud.databricks.com
DATABRICKS_TOKEN=your_databricks_personal_access_token
DATABRICKS_HTTP_PATH=/sql/1.0/warehouses/your_warehouse_id
DATABRICKS_CATALOG=your_catalog_name
DATABRICKS_SCHEMA=text_to_sql
OPENAI_API_KEY=your_openai_api_key
ENV=development
```

**How to get these values:**
- **DATABRICKS_HOST**: Your Databricks workspace URL
- **DATABRICKS_TOKEN**: Generate from User Settings > Developer > Access Tokens
- **DATABRICKS_HTTP_PATH**: From SQL Warehouse > Connection Details
- **DATABRICKS_CATALOG**: The Unity Catalog you want to use (e.g., "main" or create new)
- **OPENAI_API_KEY**: From OpenAI platform (https://platform.openai.com/api-keys)

## Step 2: Create Database Infrastructure

### 2.1 Create Catalog and Schema

Run this SQL in your Databricks SQL Editor or notebook:

```sql
-- Create catalog if it doesn't exist
CREATE CATALOG IF NOT EXISTS your_catalog_name;

-- Use the catalog
USE CATALOG your_catalog_name;

-- Create schema for QueryForge AI
CREATE SCHEMA IF NOT EXISTS text_to_sql
COMMENT 'Schema for QueryForge AI application - natural language to SQL conversion with LLM tracking';

-- Use the schema
USE SCHEMA text_to_sql;
```

### 2.2 Create the Audit Logs Table

**Option A: Using Python Script (Recommended)**

```bash
cd backend
python3 setup_audit_table.py
```

This script will:
- Connect to your Databricks workspace
- Create the `audit_logs` table with all required columns
- Verify the table was created successfully

**Option B: Using SQL Directly**

Run the SQL in `backend/create_audit_table.sql`:

```bash
databricks sql execute --file backend/create_audit_table.sql
```

Or copy the contents and run in Databricks SQL Editor.

### 2.3 Verify Table Creation

```sql
-- Verify the audit_logs table exists
DESCRIBE TABLE your_catalog_name.text_to_sql.audit_logs;

-- Check column structure
SHOW COLUMNS IN your_catalog_name.text_to_sql.audit_logs;
```

You should see columns:
- event_id (STRING)
- event_type (STRING)
- user_id (STRING)
- session_id (STRING)
- timestamp (TIMESTAMP)
- event_data (STRING)
- status (STRING)
- error_message (STRING)
- execution_time_ms (BIGINT)
- model_used (STRING)
- prompt_tokens (BIGINT)
- completion_tokens (BIGINT)
- total_cost (DOUBLE)

### 2.4 Add Token Tracking Columns (If Upgrading Existing Table)

If you already have an audit_logs table without token tracking:

```bash
cd backend
python3 add_token_tracking.py
```

Or run the SQL in `backend/add_token_columns.sql`.

## Step 3: Install Dependencies

### 3.1 Backend Dependencies

```bash
cd backend
pip install -r requirements.txt
pip install -r requirements-test.txt  # For running tests
```

### 3.2 Frontend Dependencies

```bash
cd frontend
npm install
npx playwright install  # For UI tests
```

## Step 4: Test Locally

### 4.1 Start Backend Server

```bash
cd backend
python3 app.py
```

The backend should start on http://localhost:8680

Verify it's working:
```bash
curl http://localhost:8680/api/health
```

You should see: `{"status":"healthy","timestamp":"..."}`

### 4.2 Start Frontend Development Server

In a new terminal:

```bash
cd frontend
npm run dev
```

The frontend should start on http://localhost:5173

Open http://localhost:5173 in your browser to test the application.

### 4.3 Run Tests

**Backend API Tests:**
```bash
cd backend
pytest tests/test_api_integration.py -v
```

**Frontend UI Tests:**
```bash
cd frontend
npm test
```

## Step 5: Deploy to Databricks Apps

### 5.1 Update app.yaml

Edit `app.yaml` and ensure all environment variables are set correctly:

```yaml
env:
  - name: ENV
    value: "production"
  - name: DATABRICKS_HOST
    value: "https://your-workspace.cloud.databricks.com"
  - name: DATABRICKS_TOKEN
    value: "your_service_principal_token"  # Use service principal, not personal token
  - name: DATABRICKS_CATALOG
    value: "your_catalog_name"
  - name: DATABRICKS_SCHEMA
    value: "text_to_sql"
  - name: DATABRICKS_HTTP_PATH
    value: "/sql/1.0/warehouses/your_warehouse_id"
```

**IMPORTANT:** For production, use a Service Principal token, not a personal access token.

### 5.2 Create Service Principal (Production Best Practice)

```sql
-- Create service principal (run in Databricks UI or via API)
-- Go to Settings > Identity & Access > Service Principals > Add Service Principal

-- Name: queryforge-app
-- Generate an access token for this service principal
```

### 5.3 Grant Permissions to Service Principal

```bash
python3 grant_app_permissions.py
```

Or run the SQL in `grant_permissions.sql`:

```sql
-- Replace with your actual service principal name
GRANT USAGE ON CATALOG your_catalog_name TO `app-xxxxx queryforge`;
GRANT USAGE ON SCHEMA your_catalog_name.text_to_sql TO `app-xxxxx queryforge`;
GRANT SELECT ON TABLE your_catalog_name.text_to_sql.audit_logs TO `app-xxxxx queryforge`;
GRANT MODIFY ON TABLE your_catalog_name.text_to_sql.audit_logs TO `app-xxxxx queryforge`;
```

### 5.4 Build Frontend

```bash
cd frontend
npm run build
```

This creates optimized production files in `frontend/dist/`.

### 5.5 Copy Built Files to Backend

```bash
python3 build.py
```

This copies `frontend/dist/` to `backend/static/` for serving.

### 5.6 Deploy to Databricks Apps

**First-time deployment:**
```bash
databricks apps create queryforge
```

**Update app configuration and deploy:**
```bash
python3 deploy_to_databricks.py
```

**For subsequent code-only updates (soft deploy):**
```bash
python3 deploy_to_databricks.py
```

**For infrastructure changes (hard redeploy):**
```bash
python3 deploy_to_databricks.py --hard-redeploy
```

### 5.7 Verify Deployment

After deployment completes, you'll see the app URL:
```
✅ App URL: https://queryforge-xxxxxxxxxxxxx.aws.databricksapps.com
```

Visit this URL to verify the app is running.

## Step 6: Post-Deployment Verification

### 6.1 Check Health Endpoint

```bash
curl https://your-app-url.databricksapps.com/api/health
```

### 6.2 Check Dashboard Statistics

```bash
curl https://your-app-url.databricksapps.com/api/dashboard-statistics
```

Should return:
```json
{
  "total_executions": 0,
  "total_llm_calls": 0,
  "avg_execution_time_ms": 0,
  "success_rate": 0.0,
  "total_rows_returned": 0,
  "unique_tables_analyzed": 0
}
```

### 6.3 Test the UI

1. Open the app URL in your browser
2. Navigate through all pages:
   - Dashboard
   - SQL Generator
   - Query History
   - Analytics
3. Verify no console errors (F12 > Console)
4. Check that metrics load correctly

## Troubleshooting

### Error: "500 Internal Server Error"

**Problem:** NULL handling in SQL queries
**Solution:** The code has been updated to handle NULL values with COALESCE. Ensure you're running the latest version.

### Error: "401 Unauthorized"

**Problem:** Service principal doesn't have permissions
**Solution:** Run `python3 grant_app_permissions.py` to grant necessary permissions

### Error: "Table not found"

**Problem:** audit_logs table doesn't exist
**Solution:** Run `python3 backend/setup_audit_table.py` to create the table

### Error: "CORS policy" in browser console

**Problem:** CORS not enabled
**Solution:** The code has been updated to enable CORS in production. Redeploy the app.

## Maintenance

### Regular Tasks

1. **Monitor Costs:** Check the Dashboard for LLM usage costs
2. **Review Logs:** Check audit_logs table for errors
3. **Update Dependencies:** Regularly update Python and npm packages
4. **Run Tests:** Before each deployment, run all tests

### Updating the Application

1. Pull latest changes:
   ```bash
   git pull origin main
   ```

2. Run tests:
   ```bash
   cd backend && pytest tests/test_api_integration.py -v
   cd frontend && npm test
   ```

3. Build frontend:
   ```bash
   cd frontend && npm run build
   python3 build.py
   ```

4. Deploy (soft deploy for code changes):
   ```bash
   python3 deploy_to_databricks.py
   ```

## Summary of Setup Scripts

| Script | Purpose | When to Use |
|--------|---------|-------------|
| `backend/setup_audit_table.py` | Create audit_logs table | First-time setup |
| `backend/add_token_tracking.py` | Add token columns to existing table | Upgrading from old version |
| `grant_app_permissions.py` | Grant service principal permissions | First-time setup, permission issues |
| `build.py` | Copy frontend dist to backend static | Before every deployment |
| `deploy_to_databricks.py` | Deploy app to Databricks Apps | Every deployment |
| `backend/tests/test_api_integration.py` | Test all API endpoints | Before deployment |
| `frontend/tests/ui.spec.ts` | Test all UI screens | Before deployment |

## Environment Variables Reference

### Backend (.env file)

| Variable | Description | Example |
|----------|-------------|---------|
| DATABRICKS_HOST | Databricks workspace URL | https://your-workspace.cloud.databricks.com |
| DATABRICKS_TOKEN | Personal or service principal token | dapi... |
| DATABRICKS_HTTP_PATH | SQL Warehouse connection path | /sql/1.0/warehouses/abc123 |
| DATABRICKS_CATALOG | Unity Catalog name | main or arao |
| DATABRICKS_SCHEMA | Schema for audit logs | text_to_sql |
| OPENAI_API_KEY | OpenAI API key | sk-... |
| ENV | Environment mode | development or production |
| DEBUG | Enable debug logging | True or False |

### Production (app.yaml)

All the same variables as above, but set in app.yaml instead of .env file.

## Support

For issues or questions:
- GitHub Issues: https://github.com/honnuanand/queryforge-ai/issues
- Documentation: See TESTING.md for testing guide
- README: See README.md for project overview
