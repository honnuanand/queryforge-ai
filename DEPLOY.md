# QueryForge AI - Deployment Guide

This guide covers deploying QueryForge AI to Databricks Apps.

## Quick Start

```bash
# 1. Configure your environment
cp app.yaml.template app.yaml
# Edit app.yaml with your values

# 2. Deploy (skip secrets if already configured)
python deploy_to_databricks.py --skip-secrets
```

## Prerequisites

1. **Databricks CLI** configured with your workspace profile:
   ```bash
   databricks auth login --profile fe-ai
   ```

2. **Node.js** and npm for frontend build

3. **Python 3.9+** with required packages:
   ```bash
   pip install pyyaml
   ```

## Configuration

### app.yaml Structure

```yaml
# Deployment metadata (removed before deployment)
deployment:
  app_name: "queryforge"      # Your Databricks App name
  profile: "fe-ai"            # Databricks CLI profile

command: ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]

env:
  - name: DATABRICKS_HOST
    value: "https://your-workspace.cloud.databricks.com"
  - name: DATABRICKS_TOKEN
    valueFrom: "your-scope/databricks-token"
  # ... other env vars
```

### Multiple Environments

Create environment-specific configs:
- `app.yaml.dev` - Development
- `app.yaml.prod` - Production

Deploy to specific environment:
```bash
python deploy_to_databricks.py --config app.yaml.prod --skip-secrets
```

## Deployment Commands

### Standard Deployment
```bash
# Uses app.yaml for config
python deploy_to_databricks.py --skip-secrets
```

### Override App Name or Profile
```bash
python deploy_to_databricks.py --app-name my-app --profile my-profile --skip-secrets
```

### Hard Redeploy (Delete and Recreate)
```bash
python deploy_to_databricks.py --hard-redeploy --skip-secrets
```

### First-Time Deployment (with Secrets Setup)
```bash
python deploy_to_databricks.py
# Follow prompts to set up secrets
```

## Priority for App Name

The deploy script resolves `app_name` in this order:
1. `--app-name` CLI argument
2. `DATABRICKS_APP_NAME` environment variable
3. `deployment.app_name` in app.yaml

## Service Principal Permissions

When deploying a new app, you need to grant the Service Principal access to your Unity Catalog resources.

### Get SP Information

```bash
# List service principals
databricks service-principals list --profile fe-ai --output json

# Find your app's SP and note:
# - applicationId (UUID) - used as role name
# - id (numeric) - used in security label
```

### Grant Unity Catalog Access

Run the grant script (or execute manually):

```python
from databricks.sdk import WorkspaceClient

w = WorkspaceClient(profile="fe-ai")

# Grant catalog access
w.grants.update(
    securable_type="catalog",
    full_name="your_catalog",
    changes=[{
        "principal": "SP_APPLICATION_ID",
        "add": ["USE_CATALOG", "USE_SCHEMA", "SELECT"]
    }]
)
```

See `scripts/grant_permissions.py` for a full example.

## Troubleshooting

### 401 Unauthorized
- Ensure OBO (On-Behalf-Of) token is being passed
- Check that the SP has proper Unity Catalog grants

### 500 Internal Server Error
- Check app logs: `databricks apps logs queryforge --profile fe-ai`
- Verify DATABRICKS_TOKEN secret is set correctly
- Ensure SQL warehouse is running

### App Not Starting
- Check app status: `databricks apps get queryforge --profile fe-ai`
- Review logs for startup errors

### Permission Denied on Tables
- Run the grant permissions script
- Redeploy the app after granting permissions

## Architecture

```
text2sql/
├── app.yaml              # Deployment config (with deployment metadata)
├── app.yaml.template     # Template for new environments
├── deploy_to_databricks.py  # Deployment script
├── backend/
│   ├── app.py           # FastAPI application
│   ├── requirements.txt
│   └── static/          # Built frontend (generated)
└── frontend/
    ├── src/
    └── dist/            # Build output
```

The deploy script:
1. Builds the frontend (`npm run build`)
2. Copies built files to `backend/static/`
3. Packages backend (excluding dev files)
4. Uploads to Databricks Workspace
5. Deploys as Databricks App
