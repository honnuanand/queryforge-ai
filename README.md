# Text to SQL Application

> **🚀 Quick Deploy**: To deploy this app to Databricks, run `python deploy_to_databricks.py`

A modern web application that converts natural language business logic into SQL queries using AI. Built with React, FastAPI, and designed for deployment on Databricks Apps.

## Features

- 🎯 **Catalog Browser**: Browse and select tables and columns from your Databricks workspace
- 🤖 **AI-Powered SQL Generation**: Convert natural language to SQL using LLM
- ⚡ **Query Execution**: Test generated SQL queries against your data
- 📊 **Results Visualization**: View query results in a clean, modern interface
- 🎨 **Modern UI**: Built with Material-UI and Framer Motion animations
- 🔄 **Real-time Updates**: Smooth transitions and responsive design

## Project Structure

```
text2sql/
├── frontend/                 # React TypeScript application
│   ├── src/
│   │   ├── App.tsx          # Main application component
│   │   ├── components/      # React components
│   │   └── main.tsx         # Application entry point
│   ├── package.json         # Frontend dependencies
│   ├── tsconfig.json        # TypeScript configuration
│   └── vite.config.ts       # Vite build configuration
├── backend/                  # FastAPI application
│   ├── app.py               # Main FastAPI server
│   ├── requirements.txt     # Python dependencies
│   └── .env                 # Environment configuration
├── build.py                 # Build script for production
├── deploy_to_databricks.py  # Databricks deployment script
├── app.yaml                 # Databricks app configuration
└── README.md                # This file
```

## Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.9+
- **Databricks CLI** (for deployment)

## Local Development

### 1. Backend Setup

```bash
cd backend
pip install -r requirements.txt
python app.py
```

The backend will run on http://localhost:8000

### 2. Frontend Setup

In a new terminal:

```bash
cd frontend
npm install
npm run dev
```

The frontend will run on http://localhost:5173 with API proxying to the backend.

### 3. Access the Application

Open your browser to http://localhost:5173

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

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
- 🚀 Deploy the app as "text-to-sql"
- 🌐 Show the app URL

#### Hard Redeploy (Delete and Redeploy)

```bash
python deploy_to_databricks.py --hard-redeploy
```

This will:
- 🗑️ Delete the existing app
- ⏳ Wait for deletion to complete
- 🚀 Deploy a fresh instance

#### Custom App Name/Location

```bash
python deploy_to_databricks.py --app-name my-custom-name --app-folder /Workspace/Users/user@example.com/my-app
```

## API Documentation

### Health Check

```http
GET /api/health
```

Returns the health status of the API.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00",
  "environment": "development"
}
```

### Sample Data

```http
GET /api/data
```

Returns sample metrics data.

**Response:**
```json
[
  {"id": 1, "name": "Query Executions", "value": 1234},
  {"id": 2, "name": "Tables Analyzed", "value": 567},
  ...
]
```

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
- **Python-dotenv** - Environment management

### Deployment
- **Databricks Apps** - Hosting platform
- **Databricks CLI** - Deployment automation

## Configuration

### Environment Variables

Backend (`.env`):
```env
ENV=development
PORT=8000
DEBUG=True
CORS_ORIGINS=http://localhost:5173
```

Production environment variables are configured in `app.yaml`:
- `ENV=production`
- `PORT=8000`
- `DEBUG=False`

## Troubleshooting

### Port Already in Use

If port 8000 or 5173 is already in use:

**Backend:**
```bash
# Change PORT in backend/.env
PORT=8001
```

**Frontend:**
```bash
# Vite will automatically try the next available port
# Or specify a different port in vite.config.ts
```

### Databricks CLI Not Configured

```bash
databricks configure --token
```

Enter your workspace URL and personal access token when prompted.

### Frontend Build Fails

```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Backend Import Error

Ensure all dependencies are installed:
```bash
cd backend
pip install -r requirements.txt
```

### Deployment Fails

1. Check Databricks CLI is configured:
   ```bash
   databricks workspace list /
   ```

2. Verify you have permissions to create apps in your workspace

3. Check the app doesn't already exist:
   ```bash
   databricks apps list
   ```

4. Try a hard redeploy:
   ```bash
   python deploy_to_databricks.py --hard-redeploy
   ```

## Development Workflow

1. **Make changes** to frontend or backend code
2. **Test locally** using the local development setup
3. **Build** using `python build.py`
4. **Deploy** using `python deploy_to_databricks.py`

## Database Schema

The application works with the **`arao.text_to_sql`** schema in the FEVM Databricks workspace.

## Contributing

1. Create a feature branch
2. Make your changes
3. Test locally
4. Submit a pull request

## License

MIT License - feel free to use this project as a template for your own applications.

## Support

For issues or questions:
- Check the [Troubleshooting](#troubleshooting) section
- Review the [API Documentation](#api-documentation)
- Check Databricks Apps documentation

---

Built with ❤️ using React, FastAPI, and Databricks
