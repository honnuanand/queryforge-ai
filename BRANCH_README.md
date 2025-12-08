# QueryForge AI - Single Query Branch

This branch (`single-query-only`) contains a streamlined version of QueryForge AI focused on single-table SQL query generation with enhanced features.

## Features

### 1. SQL Query Generator
- **Compact Data Source Selection**: Three dropdowns (Catalog, Schema, Table) displayed on a single line with equal widths
- **Collapsible Sample Data Preview**: View sample data from the selected table in an expandable accordion
- **Business Logic Input**: Enter natural language business requirements to generate SQL queries
- **Editable SQL Output**: Generated SQL queries can be edited directly before execution
- **Query Execution**: Execute the generated/edited SQL and view results
- **LLM Model Selection**: Choose from multiple foundation models (Llama, Claude, GPT, etc.)

### 2. Save Requirements
- **Save SQL Requirements**: Save your business logic and generated SQL for future reference
- **Persistent Storage**: Requirements are stored in a Delta table on Databricks
- **Associated Metadata**: Each saved requirement includes catalog, schema, table, columns, model used, and timestamp

### 3. Saved Requirements Page
- **View All Requirements**: Browse all saved requirements in a sortable table
- **Detailed View**: Click to view full details including generated SQL code
- **Delete Functionality**: Remove requirements with confirmation dialog
- **Auto/Manual Refresh**: Keep the list up to date

### 4. Settings Page
- **Storage Configuration**: Choose which Databricks catalog and schema to store saved requirements
- **Table Status Check**: See if the `saved_requirements` table exists in the selected location
- **One-Click Table Creation**: Create the Delta table automatically if it doesn't exist
- **Dynamic Configuration**: Change storage location at runtime

### 5. LLM Cost Tracking
- **Real-time Cost Display**: View accumulated LLM costs in the navigation drawer
- **Per-Model Breakdown**: See costs broken down by model with token counts
- **Call Statistics**: Track number of API calls per model

## Technical Stack

### Frontend
- **React 18** with TypeScript
- **Material-UI (MUI)** for components
- **Framer Motion** for animations
- **Vite** for build tooling

### Backend
- **FastAPI** (Python)
- **Databricks SQL Connector** for data operations
- **OpenAI-compatible API** for LLM calls via Databricks Foundation Models

### Storage
- **Delta Tables** on Databricks for:
  - Saved requirements
  - Audit logs
  - LLM cost tracking

## API Endpoints

### SQL Generation
- `GET /api/catalogs` - List available catalogs
- `GET /api/schemas` - List schemas in a catalog
- `GET /api/tables` - List tables in a schema
- `GET /api/columns` - Get columns for a table
- `GET /api/sample-data` - Fetch sample data from a table
- `POST /api/generate-sql` - Generate SQL from business logic
- `POST /api/execute-sql` - Execute SQL query

### Saved Requirements
- `GET /api/saved-requirements` - List all saved requirements
- `POST /api/save-requirement` - Save a new requirement
- `DELETE /api/saved-requirements/{id}` - Delete a requirement

### Settings
- `GET /api/settings/storage` - Get current storage settings
- `POST /api/settings/storage` - Save storage settings
- `GET /api/settings/check-table` - Check if table exists
- `POST /api/settings/create-table` - Create the saved_requirements table

### Monitoring
- `GET /api/llm-costs-by-model` - Get LLM costs breakdown
- `GET /api/health` - Health check endpoint

## Environment Variables

```bash
# Databricks Configuration
DATABRICKS_HOST=https://your-workspace.cloud.databricks.com
DATABRICKS_TOKEN=your-token
DATABRICKS_HTTP_PATH=/sql/1.0/warehouses/your-warehouse
DATABRICKS_CATALOG=your_catalog
DATABRICKS_SCHEMA=your_schema

# Application Configuration
ENV=development
DEBUG=false
CORS_ORIGINS=http://localhost:5173
```

## Running Locally

### Backend
```bash
cd backend
pip install -r requirements.txt
python app.py
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Testing

### Playwright E2E Tests
```bash
cd frontend
npx playwright test
```

Tests include:
- Dropdown layout verification (equal widths)
- No horizontal scroll after data loads
- Sample data preview functionality

## Project Structure

```
text2sql/
├── backend/
│   ├── app.py              # FastAPI application
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── SQLGenerator.tsx      # Main query generator
│   │   │   ├── SavedRequirements.tsx # View saved requirements
│   │   │   ├── Settings.tsx          # Storage configuration
│   │   │   ├── NavigationDrawer.tsx  # Navigation sidebar
│   │   │   └── MainContent.tsx       # Page routing
│   │   └── App.tsx
│   └── tests/
│       └── dropdown-layout.spec.ts   # Playwright tests
└── BRANCH_README.md
```
