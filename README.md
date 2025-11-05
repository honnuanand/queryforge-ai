# QueryForge - AI-Powered SQL Query Generator

> **🚀 Quick Deploy**: To deploy this app to Databricks, run `python deploy_to_databricks.py`

A modern web application that converts natural language business logic into SQL queries using AI. Built with React, FastAPI, and Databricks Foundation Models, designed for deployment on Databricks Apps.

## Features

### Core Functionality
- 🎯 **Catalog Browser**: Browse and select tables and columns from your Databricks Unity Catalog
- 🤖 **AI-Powered SQL Generation**: Convert natural language to SQL using Databricks Foundation Models (Meta Llama)
- ⚡ **Query Execution**: Execute generated SQL queries against Databricks SQL Warehouses
- 📊 **Results Visualization**: View query results in a clean, modern table interface
- 📜 **Query History**: Track all executed queries with timestamps and status
- 💰 **LLM Cost Tracking**: Monitor AI model usage and costs in real-time

### Advanced Features
- 🔗 **Multi-Table Join Queries**: Generate SQL queries that join multiple tables with AI-assisted join condition suggestions
- 💡 **AI Business Logic Assistant**: Get intelligent suggestions for business logic based on table metadata and sample data
- 🎨 **Modern UI**: Built with Material-UI and Framer Motion animations
- 🔄 **Real-time Updates**: Smooth transitions and responsive design
- 📈 **Analytics Dashboard**: View statistics on query execution, table usage, and model performance

## Project Structure

```
text2sql/
├── frontend/                 # React TypeScript application
│   ├── src/
│   │   ├── App.tsx          # Main application component
│   │   ├── components/      # React components
│   │   │   ├── SQLGenerator.tsx        # Single table query generator
│   │   │   ├── JoinQueryGenerator.tsx  # Multi-table join query generator
│   │   │   ├── QueryHistory.tsx        # Query history viewer
│   │   │   ├── Dashboard.tsx           # Analytics dashboard
│   │   │   ├── NavigationDrawer.tsx    # Sidebar navigation
│   │   │   └── MainContent.tsx         # Main content router
│   │   └── main.tsx         # Application entry point
│   ├── package.json         # Frontend dependencies
│   ├── tsconfig.json        # TypeScript configuration
│   └── vite.config.ts       # Vite build configuration
├── backend/                  # FastAPI application
│   ├── app.py               # Main FastAPI server with all endpoints
│   ├── requirements.txt     # Python dependencies
│   └── .env                 # Environment configuration (local dev)
├── build.py                 # Build script for production
├── deploy_to_databricks.py  # Databricks deployment script
├── app.yaml                 # Databricks app configuration
└── README.md                # This file
```

## Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.9+
- **Databricks Workspace** with Unity Catalog
- **Databricks SQL Warehouse** (Serverless recommended)
- **Databricks CLI** (for deployment)

## Local Development

### 1. Backend Setup

```bash
cd backend

# Create a .env file with your Databricks credentials
cat > .env << EOF
ENV=development
PORT=8680
DEBUG=True
CORS_ORIGINS=http://localhost:5673

# Databricks Configuration
DATABRICKS_HOST=https://your-workspace.cloud.databricks.com
DATABRICKS_TOKEN=your-databricks-token
DATABRICKS_CATALOG=your_catalog
DATABRICKS_SCHEMA=your_schema
DATABRICKS_HTTP_PATH=/sql/1.0/warehouses/your-warehouse-id
EOF

# Install dependencies
pip install -r requirements.txt

# Run the backend
python app.py
```

The backend will run on http://localhost:8680

### 2. Frontend Setup

In a new terminal:

```bash
cd frontend
npm install
npm run dev
```

The frontend will run on http://localhost:5673 with API proxying to the backend.

### 3. Access the Application

Open your browser to http://localhost:5673

- **Frontend**: http://localhost:5673
- **Backend API**: http://localhost:8680
- **API Docs**: http://localhost:8680/docs

## Key API Endpoints

### Catalog Management
- `GET /api/catalogs` - List all available catalogs
- `GET /api/catalogs/{catalog}/schemas` - List schemas in a catalog
- `GET /api/catalogs/{catalog}/schemas/{schema}/tables` - List tables in a schema
- `GET /api/catalogs/{catalog}/schemas/{schema}/tables/{table}/columns` - Get table columns with metadata

### AI-Powered Features
- `POST /api/suggest-business-logic` - Get AI suggestions for business logic based on table metadata and sample data
- `POST /api/suggest-join-conditions` - Get AI-generated join conditions for multiple tables
- `POST /api/generate-sql` - Generate SQL from natural language business logic

### Query Execution
- `POST /api/execute-sql` - Execute SQL query against Databricks warehouse
- `GET /api/query-history` - Retrieve query execution history

### Analytics
- `GET /api/dashboard-statistics` - Get dashboard metrics
- `GET /api/llm-costs-by-model` - Get LLM usage costs grouped by model

### System
- `GET /api/health` - Health check endpoint
- `GET /api/warehouse-status` - Check Databricks SQL Warehouse status
- `GET /api/models` - List available AI models

## Building for Production

Run the build script to compile everything:

```bash
python build.py
```

This will:
1. Install frontend dependencies
2. Build the React app to static files
3. Copy static files to `backend/static`
4. Prepare the project for deployment

## Deployment to Databricks

### Prerequisites

1. Install Databricks CLI:
   ```bash
   pip install databricks-cli
   ```

2. Configure Databricks CLI:
   ```bash
   databricks configure --token
   ```
   - Enter your workspace URL (e.g., https://your-workspace.cloud.databricks.com)
   - Enter your personal access token

3. Update `app.yaml` with your configuration:
   - Set the correct compute resource
   - Configure environment variables
   - Set up Databricks secrets for sensitive data

### Deploy the App

#### Standard Deployment

```bash
python deploy_to_databricks.py
```

The script will:
- ✅ Check Databricks CLI configuration
- 🔨 Build the frontend
- 📦 Package the backend
- 📤 Import to Databricks workspace
- 🚀 Deploy the app as "queryforge"
- 🌐 Show the app URL

#### Hard Redeploy (Delete and Redeploy)

```bash
python deploy_to_databricks.py --hard-redeploy
```

This will:
- 🗑️ Delete the existing app
- ⏳ Wait for deletion to complete
- 🚀 Deploy a fresh instance

## Technology Stack

### Frontend
- **React 18** - UI library
- **TypeScript** - Type safety
- **Material-UI (MUI)** - Component library
- **Framer Motion** - Animations
- **Vite** - Build tool

### Backend
- **FastAPI** - Python web framework
- **Uvicorn** - ASGI server
- **Databricks SQL Connector** - Database connectivity
- **OpenAI SDK** - For Databricks Foundation Model APIs
- **Python-dotenv** - Environment management

### AI Models
- **Meta Llama 4 Maverick** - Primary model for SQL generation
- **Meta Llama 3.1 70B Instruct** - Alternative high-performance model
- **DBRX Instruct** - Databricks research model

### Deployment
- **Databricks Apps** - Hosting platform
- **Databricks CLI** - Deployment automation
- **Unity Catalog** - Data catalog and governance

## Database Schema

The application uses the **`arao.text_to_sql`** schema for audit logging:

### Audit Logs Table
```sql
CREATE TABLE IF NOT EXISTS arao.text_to_sql.audit_logs (
  id STRING,
  timestamp TIMESTAMP,
  event_type STRING,
  user_id STRING,
  catalog STRING,
  schema_name STRING,
  table_name STRING,
  business_logic STRING,
  generated_sql STRING,
  sql_explanation STRING,
  execution_status STRING,
  execution_time_ms BIGINT,
  row_count BIGINT,
  error_message STRING,
  model_id STRING,
  prompt_tokens INT,
  completion_tokens INT,
  total_tokens INT,
  estimated_cost_usd DOUBLE,
  status STRING
)
```

## Configuration

### Environment Variables

Backend (`.env` for local development):
```env
ENV=development
PORT=8680
DEBUG=True
CORS_ORIGINS=http://localhost:5673

# Databricks Configuration
DATABRICKS_HOST=https://your-workspace.cloud.databricks.com
DATABRICKS_TOKEN=your-token
DATABRICKS_CATALOG=your_catalog
DATABRICKS_SCHEMA=your_schema
DATABRICKS_HTTP_PATH=/sql/1.0/warehouses/your-warehouse-id
```

Production configuration is in `app.yaml` using Databricks secrets:
```yaml
env:
  - name: DATABRICKS_HOST
    value: "{{secrets/queryforge/databricks_host}}"
  - name: DATABRICKS_TOKEN
    value: "{{secrets/queryforge/databricks_token}}"
```

## Features Deep Dive

### Single Table Query Generator
1. Select catalog, schema, and table
2. Choose specific columns
3. Select AI model
4. Get AI-suggested business logic questions
5. Describe your query in natural language
6. Generate SQL with AI
7. Execute and view results

### Multi-Table Join Query Generator
1. Add multiple tables with their columns
2. Get AI-suggested join conditions based on:
   - Column names and data types
   - Table and column descriptions from Unity Catalog
   - Sample data analysis
3. Define business logic across all tables
4. Generate complex JOIN queries automatically
5. Execute and analyze results

### Query History
- View all executed queries
- Filter by status (success/error)
- See execution time and row counts
- Track LLM costs per query
- Rerun previous queries

### Analytics Dashboard
- Total queries executed
- Success/failure rates
- Most queried tables
- Model usage statistics
- Cost tracking

## Troubleshooting

### Backend Connection Issues

If metadata fetching times out:
- Check Databricks SQL Warehouse is running
- Verify network connectivity to Databricks
- Ensure proper authentication token
- Check warehouse HTTP path is correct

### Frontend Build Fails

```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Port Already in Use

Backend (change in `.env`):
```env
PORT=8681
```

Frontend (change in `vite.config.ts`):
```typescript
server: {
  port: 5674,
  // ...
}
```

### Deployment Fails

1. Check Databricks CLI configuration:
   ```bash
   databricks workspace list /
   ```

2. Verify app doesn't already exist:
   ```bash
   databricks apps list
   ```

3. Try hard redeploy:
   ```bash
   python deploy_to_databricks.py --hard-redeploy
   ```

## Development Workflow

1. **Make changes** to frontend or backend code
2. **Test locally** using the local development setup
3. **Verify features** work with real Databricks data
4. **Build** using `python build.py`
5. **Deploy** using `python deploy_to_databricks.py`
6. **Monitor** using the analytics dashboard

## Performance Optimizations

- **Async query execution** - All database operations use thread pools to prevent blocking
- **Query timeouts** - 10-second timeouts on metadata fetching, configurable per operation
- **Connection pooling** - Efficient Databricks SQL connection management
- **Graceful degradation** - Non-critical features (like LLM costs) fail silently
- **Sample data limits** - Only fetch first 5 rows for metadata analysis

## Security Considerations

- **Token Management** - Use Databricks secrets for production deployments
- **SQL Injection Prevention** - Parameterized queries and input validation
- **CORS Configuration** - Strict origin policies
- **Audit Logging** - All queries tracked with user context
- **Error Handling** - Sensitive information not exposed in error messages

## Future Enhancements

- [ ] Query result export (CSV, JSON, Parquet)
- [ ] Saved query templates
- [ ] Collaborative query sharing
- [ ] Advanced query optimization suggestions
- [ ] Natural language query editing
- [ ] Integration with Databricks notebooks

## Acknowledgments

### About the Name "QueryForge"

The name "QueryForge" was independently chosen for this project as a descriptive combination of "Query" + "Forge" (as in forging/creating queries). We later discovered that others in the AI-to-SQL space have arrived at similar naming, which speaks to how intuitive the metaphor is for this type of tool.

Notably, [Soumyajit Mallick built a similar tool called QueryForge](https://www.linkedin.com/pulse/i-built-queryforge-turn-natural-language-sql-queries-ai-mallick-m1vfc/) for converting natural language to SQL queries. While our implementations and architectures differ (ours being built specifically for Databricks with Unity Catalog integration, multi-table join capabilities, and Foundation Model APIs), we share the common goal of making data more accessible through natural language interfaces.

This convergence of naming reflects the growing recognition in the data community that AI-powered SQL generation tools are "forging" a new way to interact with data. We're excited to be part of this movement alongside other innovators in the space.

## License

MIT License - feel free to use this project as a template for your own applications.

## Support

For issues or questions:
- Check the [Troubleshooting](#troubleshooting) section
- Review the [API Documentation](#key-api-endpoints)
- Check Databricks Apps documentation
- Review Databricks SQL Connector documentation

---

Built with ❤️ using React, FastAPI, Databricks Foundation Models, and Unity Catalog
