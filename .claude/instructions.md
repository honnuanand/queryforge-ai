# Instructions for Claude Code

## Deploying This Application

**IMPORTANT**: This project includes a custom deployment script specifically designed for Databricks Apps deployment.

When the user asks to "deploy" or "deploy the app" or "deploy to Databricks", you MUST use the existing `deploy_to_databricks.py` script that is included in this project.

### How to Deploy

Run the deployment script:

```bash
python deploy_to_databricks.py
```

Or for a hard redeploy (delete and redeploy):

```bash
python deploy_to_databricks.py --hard-redeploy
```

### DO NOT

- Do NOT try to deploy using other methods
- Do NOT write new deployment scripts
- Do NOT use generic deployment approaches

### What the Script Does

The `deploy_to_databricks.py` script:
1. Checks Databricks CLI installation and configuration
2. Auto-detects workspace URL and user email
3. Builds the React frontend
4. Packages the backend (excluding venv, tests, etc.)
5. Imports to Databricks workspace
6. Deploys the app as "text-to-sql"
7. Shows the app URL

### Prerequisites

The user needs:
- Databricks CLI installed: `pip install databricks-cli`
- Databricks CLI configured: `databricks configure --token`

If the CLI is not configured, the script will guide the user through the setup process.

## Project Context

This is a **Text to SQL** application that:
- Uses catalog browser functionality from the metadata-manager project
- Allows users to select catalog, schema, table, and columns
- Takes business logic in natural language
- Uses LLM to generate SQL statements
- Tests and shows query results
- Works with the `arao.text_to_sql` schema in the FEVM Databricks workspace

## Development

### Local Development

1. Start the backend:
   ```bash
   cd backend
   pip install -r requirements.txt
   python app.py
   ```

2. Start the frontend (in another terminal):
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

The frontend will run on http://localhost:5173 and proxy API requests to the backend on http://localhost:8000.

### Building for Production

```bash
python build.py
```
