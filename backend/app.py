from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime
from pathlib import Path
import os
import openai
import uuid
import time
import json
import re
from dotenv import load_dotenv
from databricks import sql

load_dotenv()

app = FastAPI(
    title="Text to SQL API",
    description="Backend API for Text to SQL Application",
    version="1.0.0"
)

ENV = os.getenv("ENV", "development")
DEBUG = os.getenv("DEBUG", "False").lower() == "true"
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "").split(",")

# Databricks Configuration
DATABRICKS_HOST = os.getenv("DATABRICKS_HOST", "")
DATABRICKS_TOKEN = os.getenv("DATABRICKS_TOKEN", "")
DATABRICKS_CATALOG = os.getenv("DATABRICKS_CATALOG", "arao")
DATABRICKS_SCHEMA = os.getenv("DATABRICKS_SCHEMA", "text_to_sql")
DATABRICKS_HTTP_PATH = os.getenv("DATABRICKS_HTTP_PATH", "")

# Log configuration status (without exposing sensitive data)
import logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
logger.info(f"DATABRICKS_HOST configured: {bool(DATABRICKS_HOST)}")
logger.info(f"DATABRICKS_TOKEN configured: {bool(DATABRICKS_TOKEN)}")
logger.info(f"DATABRICKS_HTTP_PATH configured: {bool(DATABRICKS_HTTP_PATH)}")

# Available Foundation Models
AVAILABLE_MODELS = {
    "llama-maverick": {"id": "databricks-llama-4-maverick", "name": "Llama 4 Maverick", "description": "Fast and efficient for general tasks"},
    "llama-70b": {"id": "databricks-meta-llama-3-3-70b-instruct", "name": "Llama 3.3 70B", "description": "Powerful model for complex reasoning"},
    "llama-405b": {"id": "databricks-meta-llama-3-1-405b-instruct", "name": "Llama 3.1 405B", "description": "Largest Llama model for most complex tasks"},
    "claude-sonnet-4-5": {"id": "databricks-claude-sonnet-4-5", "name": "Claude Sonnet 4.5", "description": "Latest Claude model with superior reasoning"},
    "claude-opus-4-1": {"id": "databricks-claude-opus-4-1", "name": "Claude Opus 4.1", "description": "Most powerful Claude model"},
    "gpt-5": {"id": "databricks-gpt-5", "name": "GPT-5", "description": "Latest OpenAI model"},
    "gemini-2-5-pro": {"id": "databricks-gemini-2-5-pro", "name": "Gemini 2.5 Pro", "description": "Google's most capable model"},
    "qwen3-80b": {"id": "databricks-qwen3-next-80b-a3b-instruct", "name": "Qwen 3 80B", "description": "Advanced Qwen model"},
    "gpt-oss-120b": {"id": "databricks-gpt-oss-120b", "name": "GPT OSS 120B", "description": "Open source GPT-scale model"},
}

# Enable CORS for both development and production
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS if CORS_ORIGINS != [""] else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic Models
class SQLGenerationRequest(BaseModel):
    catalog: str
    schema_name: str  # Renamed from 'schema' to avoid conflict
    table: str
    columns: List[str]
    business_logic: str
    model_id: str = "databricks-llama-4-maverick"
    # Optional second table for joins
    catalog2: Optional[str] = None
    schema_name2: Optional[str] = None
    table2: Optional[str] = None
    columns2: Optional[List[str]] = None

class TableInfo(BaseModel):
    catalog: str
    schema_name: str  # Renamed from 'schema'
    table: str
    columns: List[str]

class MultiTableSQLGenerationRequest(BaseModel):
    tables: List[TableInfo]
    business_logic: str
    model_id: str = "databricks-llama-4-maverick"
    join_conditions: Optional[str] = None  # Optional explicit JOIN conditions

class SQLExecutionRequest(BaseModel):
    sql_query: str

class BusinessLogicSuggestionRequest(BaseModel):
    catalog: str
    schema_name: str  # Renamed from 'schema'
    table: str
    columns: List[str]
    model_id: str = "databricks-llama-4-maverick"
    additional_tables: Optional[List[TableInfo]] = None  # For multi-table queries

class JoinConditionSuggestionRequest(BaseModel):
    tables: List[TableInfo]
    model_id: str = "databricks-llama-4-maverick"

class SaveRequirementRequest(BaseModel):
    catalog: str
    schema_name: str
    table: str
    columns: List[str]
    business_logic: str
    generated_sql: Optional[str] = None
    model_id: str = "databricks-llama-4-maverick"

# LLM Cost calculation (approximate pricing per 1M tokens)
LLM_PRICING = {
    "databricks-llama-4-maverick": {"input": 0.15, "output": 0.60},  # Example pricing
    "databricks-meta-llama-3-1-70b-instruct": {"input": 0.20, "output": 0.80},
    "databricks-meta-llama-3-1-405b-instruct": {"input": 0.50, "output": 2.00},
    "databricks-dbrx-instruct": {"input": 0.75, "output": 2.25},
}

def calculate_llm_cost(model_id: str, prompt_tokens: int, completion_tokens: int) -> float:
    """Calculate estimated cost in USD for LLM usage"""
    if model_id not in LLM_PRICING:
        # Default pricing if model not found
        pricing = {"input": 0.15, "output": 0.60}
    else:
        pricing = LLM_PRICING[model_id]

    input_cost = (prompt_tokens / 1_000_000) * pricing["input"]
    output_cost = (completion_tokens / 1_000_000) * pricing["output"]
    return input_cost + output_cost

# Audit logging helper function
async def log_audit_event(
    event_type: str,
    catalog: str = None,
    schema_name: str = None,
    table_name: str = None,
    columns: List[str] = None,
    business_logic: str = None,
    generated_sql: str = None,
    model_id: str = None,
    execution_time_ms: int = None,
    row_count: int = None,
    status: str = "success",
    error_message: str = None,
    metadata: dict = None,
    prompt_tokens: int = None,
    completion_tokens: int = None,
    total_tokens: int = None,
    estimated_cost_usd: float = None,
    session_id: str = None
):
    """Log an audit event to the audit_logs table"""
    try:
        log_id = str(uuid.uuid4())
        timestamp = datetime.now()

        # Calculate text lengths
        business_logic_length = len(business_logic) if business_logic else None
        generated_sql_length = len(generated_sql) if generated_sql else None

        # Prepare the insert statement
        insert_sql = """
        INSERT INTO arao.text_to_sql.audit_logs
        (log_id, timestamp, event_type, user_id, catalog, schema_name, table_name,
         columns, business_logic, generated_sql, model_id, execution_time_ms,
         row_count, status, error_message, metadata, prompt_tokens, completion_tokens,
         total_tokens, estimated_cost_usd, business_logic_length, generated_sql_length, session_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """

        # Convert columns list to array format if present
        columns_array = columns if columns else None

        # Convert metadata dict to map format if present
        metadata_map = metadata if metadata else None

        with sql.connect(
            server_hostname=DATABRICKS_HOST.replace("https://", ""),
            http_path=DATABRICKS_HTTP_PATH,
            access_token=DATABRICKS_TOKEN
        ) as connection:
            with connection.cursor() as cursor:
                cursor.execute(insert_sql, (
                    log_id,
                    timestamp,
                    event_type,
                    "default_user",  # TODO: Add actual user tracking
                    catalog,
                    schema_name,
                    table_name,
                    columns_array,
                    business_logic,
                    generated_sql,
                    model_id,
                    execution_time_ms,
                    row_count,
                    status,
                    error_message,
                    metadata_map,
                    prompt_tokens,
                    completion_tokens,
                    total_tokens,
                    estimated_cost_usd,
                    business_logic_length,
                    generated_sql_length,
                    session_id
                ))

        logger.info(f"Logged audit event: {event_type} - {log_id}")
    except Exception as e:
        # Don't fail the main operation if audit logging fails
        logger.error(f"Failed to log audit event: {str(e)}", exc_info=True)
        logger.error(f"Event details - Type: {event_type}, Catalog: {catalog}, Schema: {schema_name}, Table: {table_name}")

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "environment": ENV
    }

@app.get("/api/debug/config")
async def debug_config():
    """Debug endpoint to check configuration"""
    return {
        "env": ENV,
        "databricks_host_configured": bool(DATABRICKS_HOST),
        "databricks_token_configured": bool(DATABRICKS_TOKEN),
        "databricks_token_length": len(DATABRICKS_TOKEN) if DATABRICKS_TOKEN else 0,
        "databricks_http_path_configured": bool(DATABRICKS_HTTP_PATH),
        "databricks_catalog": DATABRICKS_CATALOG,
        "databricks_schema": DATABRICKS_SCHEMA,
    }

@app.get("/api/warehouse-status")
async def get_warehouse_status():
    """Get SQL warehouse status"""
    try:
        # Extract warehouse ID from HTTP path
        warehouse_id = DATABRICKS_HTTP_PATH.split("/")[-1] if DATABRICKS_HTTP_PATH else None

        if not warehouse_id:
            return {
                "warehouse_id": None,
                "warehouse_name": "Not configured",
                "status": "UNKNOWN",
                "http_path": DATABRICKS_HTTP_PATH
            }

        # Try to connect to get warehouse info
        try:
            with sql.connect(
                server_hostname=DATABRICKS_HOST.replace("https://", ""),
                http_path=DATABRICKS_HTTP_PATH,
                access_token=DATABRICKS_TOKEN
            ) as connection:
                # Connection successful means warehouse is running
                return {
                    "warehouse_id": warehouse_id,
                    "warehouse_name": "patrick-warehouse",  # Could be fetched via API
                    "status": "RUNNING",
                    "http_path": DATABRICKS_HTTP_PATH
                }
        except Exception as conn_error:
            logger.error(f"Failed to connect to warehouse: {str(conn_error)}")
            return {
                "warehouse_id": warehouse_id,
                "warehouse_name": "patrick-warehouse",
                "status": "STOPPED",
                "http_path": DATABRICKS_HTTP_PATH,
                "error": str(conn_error)
            }
    except Exception as e:
        logger.error(f"Error getting warehouse status: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get warehouse status: {str(e)}")

@app.get("/api/models")
async def list_models():
    """List available foundation models"""
    try:
        return {"models": list(AVAILABLE_MODELS.values())}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list models: {str(e)}")

@app.get("/api/catalogs")
async def list_catalogs():
    """List available catalogs"""
    try:
        # Check if credentials are configured
        if not DATABRICKS_HOST or not DATABRICKS_TOKEN or not DATABRICKS_HTTP_PATH:
            logger.error("Missing credentials - Host: %s, Token: %s, HTTP Path: %s",
                        bool(DATABRICKS_HOST), bool(DATABRICKS_TOKEN), bool(DATABRICKS_HTTP_PATH))
            raise HTTPException(
                status_code=503,
                detail="Databricks credentials not configured. Please set DATABRICKS_HOST, DATABRICKS_TOKEN, and DATABRICKS_HTTP_PATH environment variables."
            )

        # Log connection attempt
        hostname = DATABRICKS_HOST.replace("https://", "")
        logger.info("Attempting to connect to Databricks: %s", hostname)
        logger.info("HTTP Path: %s", DATABRICKS_HTTP_PATH)
        logger.info("Token length: %d", len(DATABRICKS_TOKEN))

        with sql.connect(
            server_hostname=hostname,
            http_path=DATABRICKS_HTTP_PATH,
            access_token=DATABRICKS_TOKEN
        ) as connection:
            logger.info("Connection established successfully")
            with connection.cursor() as cursor:
                logger.info("Executing SHOW CATALOGS")
                cursor.execute("SHOW CATALOGS")
                catalogs = [row[0] for row in cursor.fetchall()]
                logger.info("Found %d catalogs: %s", len(catalogs), catalogs)
                return {"catalogs": catalogs}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error listing catalogs: %s", str(e), exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to list catalogs: {str(e)}")

@app.get("/api/catalogs/{catalog_name}/schemas")
async def list_schemas(catalog_name: str):
    """List schemas in a catalog"""
    try:
        with sql.connect(
            server_hostname=DATABRICKS_HOST.replace("https://", ""),
            http_path=DATABRICKS_HTTP_PATH,
            access_token=DATABRICKS_TOKEN
        ) as connection:
            with connection.cursor() as cursor:
                cursor.execute(f"SHOW SCHEMAS IN {catalog_name}")
                schemas = [row[0] for row in cursor.fetchall()]
                return {"schemas": schemas}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list schemas: {str(e)}")

@app.get("/api/catalogs/{catalog_name}/schemas/{schema_name}/tables")
async def list_tables(catalog_name: str, schema_name: str):
    """List tables in a schema"""
    try:
        with sql.connect(
            server_hostname=DATABRICKS_HOST.replace("https://", ""),
            http_path=DATABRICKS_HTTP_PATH,
            access_token=DATABRICKS_TOKEN
        ) as connection:
            with connection.cursor() as cursor:
                cursor.execute(f"SHOW TABLES IN {catalog_name}.{schema_name}")
                tables = [row[1] for row in cursor.fetchall()]  # row[1] is table name
                return {"tables": tables}
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Error listing tables: {error_msg}")

        if "SCHEMA_NOT_FOUND" in error_msg or ("schema" in error_msg.lower() and "cannot be found" in error_msg.lower()):
            raise HTTPException(status_code=404, detail=f"Schema '{schema_name}' not found in catalog '{catalog_name}'. You may not have access to this schema.")
        elif "CATALOG_NOT_FOUND" in error_msg or ("catalog" in error_msg.lower() and "cannot be found" in error_msg.lower()):
            raise HTTPException(status_code=404, detail=f"Catalog '{catalog_name}' not found. You may not have access to this catalog.")
        elif "PERMISSION_DENIED" in error_msg or "permission" in error_msg.lower() or "ACCESS_DENIED" in error_msg:
            raise HTTPException(status_code=403, detail=f"Permission denied: You don't have access to {catalog_name}.{schema_name}")
        elif "timeout" in error_msg.lower() or "timed out" in error_msg.lower():
            raise HTTPException(status_code=504, detail="Request timed out. Please try again.")
        elif "connection" in error_msg.lower():
            raise HTTPException(status_code=503, detail="Unable to connect to Databricks. Please try again.")
        else:
            raise HTTPException(status_code=500, detail=f"Failed to list tables: {error_msg}")

@app.get("/api/catalogs/{catalog_name}/schemas/{schema_name}/tables/{table_name}/columns")
async def list_columns(catalog_name: str, schema_name: str, table_name: str):
    """List columns in a table"""
    try:
        with sql.connect(
            server_hostname=DATABRICKS_HOST.replace("https://", ""),
            http_path=DATABRICKS_HTTP_PATH,
            access_token=DATABRICKS_TOKEN
        ) as connection:
            with connection.cursor() as cursor:
                cursor.execute(f"DESCRIBE {catalog_name}.{schema_name}.{table_name}")
                columns = [{"name": row[0], "type": row[1], "comment": row[2] if len(row) > 2 else None}
                          for row in cursor.fetchall()]
                return {"columns": columns}
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Error listing columns: {error_msg}")

        full_table_name = f"{catalog_name}.{schema_name}.{table_name}"
        if "TABLE_OR_VIEW_NOT_FOUND" in error_msg or ("table" in error_msg.lower() and "cannot be found" in error_msg.lower()):
            raise HTTPException(status_code=404, detail=f"Table '{full_table_name}' not found. You may not have access to this table.")
        elif "SCHEMA_NOT_FOUND" in error_msg or ("schema" in error_msg.lower() and "cannot be found" in error_msg.lower()):
            raise HTTPException(status_code=404, detail=f"Schema '{schema_name}' not found in catalog '{catalog_name}'. You may not have access to this schema.")
        elif "CATALOG_NOT_FOUND" in error_msg or ("catalog" in error_msg.lower() and "cannot be found" in error_msg.lower()):
            raise HTTPException(status_code=404, detail=f"Catalog '{catalog_name}' not found. You may not have access to this catalog.")
        elif "PERMISSION_DENIED" in error_msg or "permission" in error_msg.lower() or "ACCESS_DENIED" in error_msg:
            raise HTTPException(status_code=403, detail=f"Permission denied: You don't have access to {full_table_name}")
        elif "timeout" in error_msg.lower() or "timed out" in error_msg.lower():
            raise HTTPException(status_code=504, detail="Request timed out. Please try again.")
        elif "connection" in error_msg.lower():
            raise HTTPException(status_code=503, detail="Unable to connect to Databricks. Please try again.")
        else:
            raise HTTPException(status_code=500, detail=f"Failed to list columns: {error_msg}")

@app.post("/api/suggest-business-logic")
async def suggest_business_logic(request: BusinessLogicSuggestionRequest):
    """Generate business logic suggestions using Databricks Foundation Model"""
    start_time = time.time()
    try:
        # Initialize OpenAI client with Databricks endpoint
        client = openai.OpenAI(
            api_key=DATABRICKS_TOKEN,
            base_url=f"{DATABRICKS_HOST}/serving-endpoints"
        )

        # Build comprehensive context about all tables
        def fetch_table_metadata(table_info, idx):
            """Fetch metadata and sample data for a single table (runs in thread pool)"""
            full_table_name = f"{table_info.catalog}.{table_info.schema_name}.{table_info.table}"
            context = f"\nTable {idx}: {full_table_name}\n"

            try:
                conn = sql.connect(
                    server_hostname=DATABRICKS_HOST.replace("https://", ""),
                    http_path=DATABRICKS_HTTP_PATH,
                    access_token=DATABRICKS_TOKEN
                )
                cursor = conn.cursor()

                # Fetch table metadata and column descriptions
                describe_query = f"DESCRIBE TABLE EXTENDED {full_table_name}"
                cursor.execute(describe_query)
                describe_results = cursor.fetchall()

                # Parse column metadata
                column_metadata = {}
                table_comment = None
                in_detailed_info = False

                for row in describe_results:
                    col_name = row[0]
                    data_type = row[1]
                    comment = row[2] if len(row) > 2 else None

                    if col_name and '# Detailed Table Information' in col_name:
                        in_detailed_info = True
                        continue

                    if in_detailed_info and col_name and 'Comment' in col_name and comment:
                        table_comment = comment
                        continue

                    if not in_detailed_info and col_name and col_name.strip() and not col_name.startswith('#'):
                        if col_name in table_info.columns:
                            column_metadata[col_name] = {
                                'type': data_type,
                                'comment': comment if comment else ''
                            }

                # Add table comment if available
                if table_comment:
                    context += f"Table Description: {table_comment}\n"

                # Add column information with metadata
                context += "\nColumns:\n"
                for col in table_info.columns:
                    if col in column_metadata:
                        meta = column_metadata[col]
                        context += f"  - {col} ({meta['type']})"
                        if meta['comment']:
                            context += f": {meta['comment']}"
                        context += "\n"
                    else:
                        context += f"  - {col}\n"

                # Fetch sample data (first 5 rows)
                columns_str = ', '.join(table_info.columns)
                sample_query = f"SELECT {columns_str} FROM {full_table_name} LIMIT 5"
                cursor.execute(sample_query)
                rows = cursor.fetchall()

                if rows:
                    context += "\nSample Data (first 5 rows):\n"
                    context += " | ".join(table_info.columns) + "\n"
                    context += "-" * (len(" | ".join(table_info.columns))) + "\n"
                    for row in rows:
                        row_values = [str(val) if val is not None else 'NULL' for val in row]
                        context += " | ".join(row_values) + "\n"
                context += "\n"

                cursor.close()
                conn.close()
                return context
            except Exception as e:
                logger.warning(f"Failed to fetch metadata/data for {table_info.table}: {str(e)}")
                context += f"Columns: {', '.join(table_info.columns)}\n"
                context += "(Could not fetch metadata or sample data)\n\n"
                return context

        # Create a list of all tables to process
        all_tables = [TableInfo(
            catalog=request.catalog,
            schema_name=request.schema_name,
            table=request.table,
            columns=request.columns
        )]

        if request.additional_tables:
            all_tables.extend(request.additional_tables)

        # Fetch metadata for all tables with timeout (run in thread pool)
        import asyncio
        tables_context = ""
        try:
            for idx, table_info in enumerate(all_tables, 1):
                # Run each table fetch with timeout
                table_context = await asyncio.wait_for(
                    asyncio.to_thread(fetch_table_metadata, table_info, idx),
                    timeout=10.0  # 10 second timeout per table
                )
                tables_context += table_context
        except asyncio.TimeoutError:
            logger.warning(f"Timeout fetching metadata for table {idx}")
            tables_context += f"(Timeout fetching metadata)\n\n"
        except Exception as e:
            logger.warning(f"Error fetching table metadata: {str(e)}")
            tables_context += f"(Error fetching metadata)\n\n"

        # Create prompt for business logic suggestions
        is_multi_table = len(all_tables) > 1

        if is_multi_table:
            system_prompt = """You are a helpful data analyst assistant specializing in business intelligence and data analysis.
Generate diverse, comprehensive business logic examples for MULTI-TABLE queries.
Each suggestion should leverage data from multiple tables and demonstrate JOIN query scenarios.
Focus on realistic business scenarios that require combining data across tables."""

            user_prompt = f"""Based on these tables with their metadata and sample data:

{tables_context}

Generate 5 diverse business logic examples for analyzing this data with JOIN queries. Each suggestion should:
- Be a clear, natural language business question
- REQUIRE data from MULTIPLE tables (these are JOIN query suggestions!)
- Leverage the relationships between tables based on common columns
- Represent different query types (aggregation across tables, filtering with joins, ranking, comparisons)
- Be realistic and actionable for business users
- Be 1-2 sentences maximum

IMPORTANT: Since this is for multi-table queries, ensure suggestions explicitly need data from at least 2 tables!

Format your response as a simple numbered list (1. 2. 3. 4. 5.), with each suggestion on a new line.
Do NOT use bullet points, quotes, or JSON format. Just natural language numbered sentences."""
        else:
            system_prompt = """You are a helpful data analyst assistant specializing in business intelligence and data analysis.
Generate diverse, comprehensive business logic examples that demonstrate different types of analytical queries.
Each suggestion should be a clear business question that leverages multiple columns from the dataset.
Focus on realistic business scenarios including aggregations, filtering, grouping, and comparisons."""

            user_prompt = f"""Based on this table with its metadata and sample data:

{tables_context}

Generate 5 diverse business logic examples for analyzing this data. Each suggestion should:
- Be a clear, natural language business question
- Use multiple relevant columns (not just one or two)
- Represent different query types (aggregation, filtering, ranking, comparison, trends)
- Be realistic and actionable for business users
- Be 1-2 sentences maximum

Format your response as a simple numbered list (1. 2. 3. 4. 5.), with each suggestion on a new line.
Do NOT use bullet points, quotes, or JSON format. Just natural language numbered sentences."""

        # Call Databricks Foundation Model
        # Call Databricks Foundation Model for business logic suggestions
        # Note: Some models like GPT-5 only support default temperature (1.0)
        completion_params = {
            "model": request.model_id,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            "max_tokens": 300,
        }

        # Only set temperature for models that support it (not GPT-5)
        if "gpt-5" not in request.model_id.lower():
            completion_params["temperature"] = 0.7

        response = client.chat.completions.create(**completion_params)

        suggestions_text = response.choices[0].message.content.strip()

        # Extract token usage from response
        prompt_tokens = response.usage.prompt_tokens if response.usage else 0
        completion_tokens = response.usage.completion_tokens if response.usage else 0
        total_tokens = response.usage.total_tokens if response.usage else 0

        # Calculate cost
        estimated_cost = calculate_llm_cost(request.model_id, prompt_tokens, completion_tokens)

        # Parse numbered list format (1. 2. 3. etc.)
        import re
        suggestions = []
        lines = suggestions_text.split('\n')
        for line in lines:
            # Match lines that start with number and period (e.g., "1. ", "2. ")
            match = re.match(r'^\d+\.\s*(.+)$', line.strip())
            if match:
                suggestion = match.group(1).strip()
                # Remove any surrounding quotes
                suggestion = suggestion.strip('"').strip("'")
                if len(suggestion) > 15:  # Must be substantial
                    suggestions.append(suggestion)

        # Fallback if regex parsing fails: try JSON or simple cleanup
        if not suggestions:
            try:
                import json
                suggestions = json.loads(suggestions_text)
            except:
                # Simple fallback: split by newlines and clean up
                suggestions = [s.strip('- ').strip().strip('"').strip("'") for s in suggestions_text.split('\n') if s.strip()]
                suggestions = [s for s in suggestions if len(s) > 15][:5]

        # Limit to 5 suggestions
        suggestions = suggestions[:5]

        # Calculate execution time
        execution_time_ms = int((time.time() - start_time) * 1000)

        # Log audit event
        await log_audit_event(
            event_type="business_logic_suggestion",
            catalog=request.catalog,
            schema_name=request.schema_name,
            table_name=request.table,
            columns=request.columns,
            business_logic=str(suggestions),
            model_id=request.model_id,
            execution_time_ms=execution_time_ms,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens,
            estimated_cost_usd=estimated_cost,
            status="success"
        )

        return {
            "suggestions": suggestions,
            "model_used": request.model_id
        }
    except Exception as e:
        # Calculate execution time for error case
        execution_time_ms = int((time.time() - start_time) * 1000)

        # Log audit event for error
        await log_audit_event(
            event_type="business_logic_suggestion",
            catalog=request.catalog,
            schema_name=request.schema_name,
            table_name=request.table,
            columns=request.columns,
            model_id=request.model_id,
            execution_time_ms=execution_time_ms,
            status="error",
            error_message=str(e)
        )

        logger.error("Error generating business logic suggestions: %s", str(e), exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to generate suggestions: {str(e)}")

@app.post("/api/suggest-join-conditions")
async def suggest_join_conditions(request: JoinConditionSuggestionRequest):
    """Suggest JOIN conditions by analyzing table structures using AI"""
    start_time = time.time()
    try:
        if len(request.tables) < 2:
            raise HTTPException(status_code=400, detail="At least 2 tables required for join condition suggestions")

        # Initialize OpenAI client with Databricks endpoint
        client = openai.OpenAI(
            api_key=DATABRICKS_TOKEN,
            base_url=f"{DATABRICKS_HOST}/serving-endpoints"
        )

        # Build context about all tables including metadata and sample data
        def fetch_table_context(table, idx):
            """Fetch metadata and sample data for a single table (runs in thread pool)"""
            full_table_name = f"{table.catalog}.{table.schema_name}.{table.table}"
            context = f"\nTable {idx}: {full_table_name}\n"

            try:
                conn = sql.connect(
                    server_hostname=DATABRICKS_HOST.replace("https://", ""),
                    http_path=DATABRICKS_HTTP_PATH,
                    access_token=DATABRICKS_TOKEN
                )
                cursor = conn.cursor()

                # Fetch table metadata and column descriptions
                describe_query = f"DESCRIBE TABLE EXTENDED {full_table_name}"
                cursor.execute(describe_query)
                describe_results = cursor.fetchall()

                # Parse column metadata
                column_metadata = {}
                table_comment = None
                in_detailed_info = False

                for row in describe_results:
                    col_name = row[0]
                    data_type = row[1]
                    comment = row[2] if len(row) > 2 else None

                    # Check if we've reached the detailed table info section
                    if col_name and '# Detailed Table Information' in col_name:
                        in_detailed_info = True
                        continue

                    # Extract table comment from detailed info
                    if in_detailed_info and col_name and 'Comment' in col_name and comment:
                        table_comment = comment
                        continue

                    # Only process actual column metadata (before detailed info section)
                    if not in_detailed_info and col_name and col_name.strip() and not col_name.startswith('#'):
                        # Only include selected columns
                        if col_name in table.columns:
                            column_metadata[col_name] = {
                                'type': data_type,
                                'comment': comment if comment else ''
                            }

                # Add table comment if available
                if table_comment:
                    context += f"Table Description: {table_comment}\n"

                # Add column information with metadata
                context += "\nColumns:\n"
                for col in table.columns:
                    if col in column_metadata:
                        meta = column_metadata[col]
                        context += f"  - {col} ({meta['type']})"
                        if meta['comment']:
                            context += f": {meta['comment']}"
                        context += "\n"
                    else:
                        context += f"  - {col}\n"

                # Fetch sample data (first 5 rows)
                columns_str = ', '.join(table.columns)
                sample_query = f"SELECT {columns_str} FROM {full_table_name} LIMIT 5"
                cursor.execute(sample_query)
                rows = cursor.fetchall()

                if rows:
                    context += "\nSample Data (first 5 rows):\n"
                    # Add header
                    context += " | ".join(table.columns) + "\n"
                    context += "-" * (len(" | ".join(table.columns))) + "\n"
                    # Add rows
                    for row in rows:
                        row_values = [str(val) if val is not None else 'NULL' for val in row]
                        context += " | ".join(row_values) + "\n"
                context += "\n"

                cursor.close()
                conn.close()
                return context
            except Exception as e:
                logger.warning(f"Failed to fetch metadata/data for {table.table}: {str(e)}")
                context += f"Columns: {', '.join(table.columns)}\n"
                context += "(Could not fetch metadata or sample data)\n\n"
                return context

        # Fetch metadata for all tables with timeout (run in thread pool)
        import asyncio
        tables_context = ""
        try:
            for idx, table in enumerate(request.tables, 1):
                # Run each table fetch with timeout
                table_context = await asyncio.wait_for(
                    asyncio.to_thread(fetch_table_context, table, idx),
                    timeout=10.0  # 10 second timeout per table
                )
                tables_context += table_context
        except asyncio.TimeoutError:
            logger.warning(f"Timeout fetching metadata for table {idx}")
            tables_context += f"(Timeout fetching metadata)\n\n"
        except Exception as e:
            logger.warning(f"Error fetching table metadata: {str(e)}")
            tables_context += f"(Error fetching metadata)\n\n"

        # Create prompt for join condition suggestions
        system_prompt = """You are a database expert specializing in SQL joins.
You will receive:
1. Table and column descriptions/comments from the database metadata
2. Column data types
3. Actual sample data from each table

Use ALL this information to determine the most accurate JOIN conditions."""

        user_prompt = f"""Analyze these tables with their metadata and sample data to suggest JOIN conditions:

{tables_context}

Follow these ANALYSIS STEPS and show your reasoning:
### Step 1: Review Table and Column Descriptions
Review table and column descriptions/comments to understand what each represents

### Step 2: Check Data Types
Ensure matching columns have compatible data types

### Step 3: Examine Sample Data
Look at the actual values in each column across tables

### Step 4: Identify Matching Values
Find columns that contain the same or related values

### Step 5: Exact Column Name Matches and Semantic Relationships
Prioritize columns with identical names (e.g., "aircraft_id" in both tables) or semantic relationships

### Step 6: Foreign Key Patterns
Look for id/foreign_key patterns (e.g., users.id matches orders.user_id)

CRITICAL RULES (in priority order):
1. **EXACT MATCHES WITH DATA PROOF**: If columns have the same name AND matching values in sample data, use those!
2. **SEMANTIC + VALUE MATCH**: If descriptions indicate relationship AND values overlap, use those columns
3. **VALUE OVERLAP**: If you see the same values appearing in different columns across tables, those are join keys
4. **Foreign Key Patterns**: table1.id = table2.tablename_id (e.g., users.id = orders.user_id)
5. **Table Aliases**: Always use t1, t2, t3, etc. as table aliases
6. **Multiple Tables**: Chain joins logically (e.g., t1.id = t2.fk AND t2.id = t3.fk)

CRITICAL OUTPUT FORMAT:
After completing your step-by-step analysis above, end your response with:

### RECOMMENDED JOIN CONDITION:
[Write the join condition here using table aliases t1, t2, etc., such as: t1.aircraft_id = t2.aircraft_id]

EXAMPLES:
- t1.aircraft_id = t2.aircraft_id
- t1.user_id = t2.id
- t1.order_id = t2.id AND t2.customer_id = t3.id"""

        # Call Databricks Foundation Model
        # Call Databricks Foundation Model for join condition suggestions
        # Note: Some models like GPT-5 only support default temperature (1.0)
        completion_params = {
            "model": request.model_id,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            "max_tokens": 300,  # Increased for more complex analysis
        }

        # Only set temperature for models that support it (not GPT-5)
        if "gpt-5" not in request.model_id.lower():
            completion_params["temperature"] = 0.2  # Very low temperature for deterministic, data-driven decisions

        response = client.chat.completions.create(**completion_params)

        full_response = response.choices[0].message.content.strip()

        # Extract the recommended join condition from the response
        # Look for the "### RECOMMENDED JOIN CONDITION:" section
        import re
        condition_match = re.search(r'###\s*RECOMMENDED\s+JOIN\s+CONDITION:\s*\n(.+?)(?:\n###|\n\n|$)', full_response, re.IGNORECASE | re.DOTALL)

        if condition_match:
            suggested_condition = condition_match.group(1).strip()
        else:
            # Fallback: try to find a line that looks like a join condition
            lines = full_response.split('\n')
            suggested_condition = ""
            for line in lines:
                line = line.strip()
                # Check if line contains table aliases and equals sign (likely a join condition)
                if re.search(r't\d+\.\w+\s*=\s*t\d+\.\w+', line, re.IGNORECASE):
                    suggested_condition = line
                    break

        # Clean up the extracted condition
        suggested_condition = suggested_condition.strip('"').strip("'").strip('`').strip()

        # Remove common prefixes if present
        prefixes_to_remove = ["ON ", "WHERE ", "JOIN ON ", "```sql", "```", "-", "*"]
        for prefix in prefixes_to_remove:
            if suggested_condition.startswith(prefix):
                suggested_condition = suggested_condition[len(prefix):].strip()

        # Remove any trailing backticks or markdown
        suggested_condition = suggested_condition.replace("```", "").strip()

        # Extract token usage
        prompt_tokens = response.usage.prompt_tokens if response.usage else 0
        completion_tokens = response.usage.completion_tokens if response.usage else 0
        total_tokens = response.usage.total_tokens if response.usage else 0

        # Calculate cost
        estimated_cost = calculate_llm_cost(request.model_id, prompt_tokens, completion_tokens)

        # Calculate execution time
        execution_time_ms = int((time.time() - start_time) * 1000)

        # Log audit event
        table_names = [f"{t.catalog}.{t.schema_name}.{t.table}" for t in request.tables]
        all_columns = [col for table in request.tables for col in table.columns]
        await log_audit_event(
            event_type="join_condition_suggestion",
            catalog=request.tables[0].catalog,
            schema_name=request.tables[0].schema_name,
            table_name=f"[JOIN: {' + '.join([t.table for t in request.tables])}]",
            columns=all_columns,  # Pass list directly - Databricks SQL supports arrays
            business_logic=suggested_condition,
            model_id=request.model_id,
            execution_time_ms=execution_time_ms,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens,
            estimated_cost_usd=estimated_cost,
            status="success"
        )

        return {
            "join_condition": suggested_condition,
            "full_analysis": full_response,
            "model_used": request.model_id
        }
    except HTTPException:
        raise
    except Exception as e:
        # Calculate execution time for error case
        execution_time_ms = int((time.time() - start_time) * 1000)

        # Log audit event for error
        if len(request.tables) > 0:
            await log_audit_event(
                event_type="join_condition_suggestion",
                catalog=request.tables[0].catalog,
                schema_name=request.tables[0].schema_name,
                table_name=f"[JOIN: {' + '.join([t.table for t in request.tables])}]",
                model_id=request.model_id,
                execution_time_ms=execution_time_ms,
                status="error",
                error_message=str(e)
            )

        logger.error("Error suggesting join conditions: %s", str(e), exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to suggest join conditions: {str(e)}")

@app.post("/api/generate-sql")
async def generate_sql(request: MultiTableSQLGenerationRequest):
    """Generate SQL query using Databricks Foundation Model (supports multiple tables)"""
    start_time = time.time()
    try:
        # Initialize OpenAI client with Databricks endpoint
        client = openai.OpenAI(
            api_key=DATABRICKS_TOKEN,
            base_url=f"{DATABRICKS_HOST}/serving-endpoints"
        )

        # Build context about the table(s)
        if len(request.tables) == 1:
            # Single table query
            table = request.tables[0]
            table_context = f"""
        Table: {table.catalog}.{table.schema_name}.{table.table}
        Selected Columns: {', '.join(table.columns)}
        """
        else:
            # Multiple tables - prepare for JOIN query
            table_context = "Tables to JOIN:\n\n"
            for idx, table in enumerate(request.tables, 1):
                table_context += f"""
        Table {idx}: {table.catalog}.{table.schema_name}.{table.table}
        Table {idx} Columns: {', '.join(table.columns)}
"""

            # Add explicit join conditions if provided
            if request.join_conditions:
                table_context += f"""
        EXPLICIT JOIN CONDITIONS PROVIDED BY USER:
        {request.join_conditions}

        NOTE: Use the explicit JOIN conditions above. The user has specified exactly how these tables should be joined.
        """
            else:
                table_context += """
        NOTE: You should generate a query that JOINs these tables. Determine the appropriate JOIN type and join conditions based on the business logic and column names. Look for common columns like id, user_id, customer_id, etc. to infer relationships.
        """

        # Create prompt for SQL generation
        system_prompt = """You are an expert Databricks SQL query generator specializing in clear, executable data analysis queries.
Generate clean, efficient SQL queries using ONLY Databricks/Spark SQL syntax.

CRITICAL SYNTAX RULES:
- Use ONLY Databricks/Spark SQL syntax (NOT Oracle, SQL Server, or PostgreSQL-specific syntax)
- Do NOT use: KEEP, DENSE_RANK with KEEP, TOP N, LIMIT with OFFSET (use LIMIT only)
- For finding row with MAX/MIN value, use window functions (ROW_NUMBER() OVER) or correlated subqueries
- Use standard functions: ROUND(), COALESCE(), CASE WHEN, CAST, etc.
- Use GROUP BY, ORDER BY, HAVING, JOIN as needed
- Always qualify column names with table/alias when using JOINs

QUERY QUALITY REQUIREMENTS:
- Prefer focused, single-purpose queries over complex multi-CTE queries
- Use CTEs (WITH clauses) sparingly - only when necessary for clarity
- Use as many relevant columns as appropriate, but don't over-complicate
- Include appropriate column aliases for clarity
- Use proper formatting with clear indentation
- Apply relevant filters, aggregations, and ordering
- Consider edge cases (NULL values, empty results)
- IMPORTANT: Keep queries concise and executable - avoid excessive nesting

JOIN QUERY RULES (when multiple tables provided):
- Determine the appropriate JOIN type (INNER, LEFT, RIGHT, FULL OUTER) based on business logic
- Infer join conditions by identifying common column names (e.g., id, user_id, etc.)
- Use table aliases (e.g., t1, t2) for clarity
- Fully qualify all column names with table aliases
- Prefer INNER JOIN unless business logic suggests otherwise

QUERY LENGTH:
- Aim for queries under 50 lines when possible
- If using CTEs, limit to 2-3 CTEs maximum
- Focus on answering the specific business question asked"""

        user_prompt = f"""Generate a clear, focused Databricks SQL query for the following:

{table_context}

Business Logic:
{request.business_logic}

IMPORTANT GUIDELINES:
1. Use ONLY Databricks/Spark SQL syntax (no Oracle, SQL Server, or PostgreSQL syntax)
2. Do NOT use: KEEP, FIRST_VALUE with KEEP, DENSE_RANK with KEEP, TOP N
3. For MAX/MIN with specific rows, use: ROW_NUMBER() OVER (ORDER BY x DESC) or subqueries
4. Keep the query FOCUSED and CONCISE - answer the specific business question
5. Avoid complex nested CTEs unless absolutely necessary
6. Include relevant columns from the available set
7. Use proper column aliases for calculated fields
8. Handle NULL values with COALESCE or WHERE clauses
9. Include WHERE, GROUP BY, ORDER BY as appropriate
10. Format clearly with line breaks but keep under 50 lines total

Generate a clear, executable SELECT query that directly answers the business question.

CRITICAL OUTPUT FORMAT - YOU MUST FOLLOW THIS EXACTLY:
Return ONLY these two sections in this EXACT format with NO additional text, commentary, or explanations:

EXPLANATION: [Write a brief 1-2 sentence plain English explanation here]
SQL: [Write the complete SQL query here starting with SELECT or WITH]

DO NOT:
- Add any text before "EXPLANATION:"
- Add any text after the SQL query ends
- Include comments within the SQL query
- Add explanations between the EXPLANATION and SQL sections
- Use markdown code blocks or formatting
- Add any other sections or commentary

The response should contain ONLY the EXPLANATION line and the SQL query, nothing else."""

        # Call Databricks Foundation Model
        # Note: Some models like GPT-5 only support default temperature (1.0)
        completion_params = {
            "model": request.model_id,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            "max_tokens": 2000,  # Increased from 500 to support complex queries with CTEs and window functions
        }

        # Only set temperature for models that support it (not GPT-5)
        if "gpt-5" not in request.model_id.lower():
            completion_params["temperature"] = 0.3

        response = client.chat.completions.create(**completion_params)

        llm_response = response.choices[0].message.content.strip()

        # Check if response was truncated due to max_tokens
        finish_reason = response.choices[0].finish_reason if response.choices else None
        if finish_reason == "length":
            logger.warning("LLM response was truncated due to max_tokens limit. Query may be incomplete.")

        # Parse EXPLANATION and SQL from the response
        explanation = ""
        sql_query = ""

        if "EXPLANATION:" in llm_response and "SQL:" in llm_response:
            # Split by SQL: to get both parts
            parts = llm_response.split("SQL:", 1)
            explanation = parts[0].replace("EXPLANATION:", "").strip()
            sql_query = parts[1].strip()
        else:
            # Fallback if LLM doesn't follow format
            sql_query = llm_response
            explanation = "No explanation provided."

        # Remove markdown code blocks if present in SQL
        sql_query = sql_query.replace("```sql", "").replace("```", "").strip()

        # Remove any English text that appears before the SELECT statement
        # Look for the first SELECT and take everything from there
        select_match = re.search(r'\b(SELECT|WITH)\b', sql_query, re.IGNORECASE)
        if select_match:
            sql_query = sql_query[select_match.start():]

        # Remove any trailing English explanations after the SQL
        # SQL should end with a semicolon or the last valid SQL token
        # Remove anything that looks like prose after the query
        lines = sql_query.split('\n')
        cleaned_lines = []
        for line in lines:
            stripped = line.strip()
            # Skip lines that look like English prose (start with capital letter and have spaces but no SQL keywords)
            if stripped and not stripped[0].isupper() or any(keyword in stripped.upper() for keyword in ['SELECT', 'FROM', 'WHERE', 'JOIN', 'GROUP', 'ORDER', 'LIMIT', 'HAVING', 'AND', 'OR', 'ON', 'AS', 'BY', 'WITH', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'UNION', 'DISTINCT', 'COUNT', 'SUM', 'AVG', 'MAX', 'MIN', 'INNER', 'LEFT', 'RIGHT', 'OUTER', 'CROSS']):
                cleaned_lines.append(line)
            elif not stripped:
                # Keep empty lines for formatting
                cleaned_lines.append(line)
        sql_query = '\n'.join(cleaned_lines).strip()

        # Validate that SQL query appears complete (basic sanity check)
        # Check for common incomplete patterns
        incomplete_patterns = [
            r'\s+$',  # Ends with whitespace only
            r'[,\s]+$',  # Ends with comma or whitespace
            r'\s+(FROM|WHERE|AND|OR|JOIN|ON|GROUP|ORDER|HAVING)\s*$',  # Ends with SQL keyword
        ]
        looks_incomplete = any(re.search(pattern, sql_query, re.IGNORECASE) for pattern in incomplete_patterns)

        # Also check for unbalanced parentheses
        open_parens = sql_query.count('(')
        close_parens = sql_query.count(')')
        unbalanced_parens = open_parens != close_parens

        if looks_incomplete or unbalanced_parens or finish_reason == "length":
            error_msg = "Generated SQL query appears incomplete or truncated."
            if unbalanced_parens:
                error_msg += f" Unbalanced parentheses: {open_parens} open, {close_parens} close."
            if finish_reason == "length":
                error_msg += " Response hit max_tokens limit."
            logger.error(error_msg)
            logger.error(f"Incomplete query: {sql_query[:200]}...")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to generate complete SQL query. {error_msg} Please try simplifying your request or selecting fewer columns."
            )

        # Extract token usage from response
        prompt_tokens = response.usage.prompt_tokens if response.usage else 0
        completion_tokens = response.usage.completion_tokens if response.usage else 0
        total_tokens = response.usage.total_tokens if response.usage else 0

        # Calculate cost
        estimated_cost = calculate_llm_cost(request.model_id, prompt_tokens, completion_tokens)

        # Calculate execution time
        execution_time_ms = int((time.time() - start_time) * 1000)

        # Log audit event
        # For multi-table queries, log primary table info and note all tables in business_logic
        primary_table = request.tables[0]
        audit_business_logic = request.business_logic

        if len(request.tables) > 1:
            table_names = [t.table for t in request.tables]
            audit_business_logic = f"[JOIN: {' + '.join(table_names)}] {request.business_logic}"

        await log_audit_event(
            event_type="sql_generation",
            catalog=primary_table.catalog,
            schema_name=primary_table.schema_name,
            table_name=primary_table.table,
            columns=primary_table.columns,
            business_logic=audit_business_logic,
            generated_sql=sql_query,
            model_id=request.model_id,
            execution_time_ms=execution_time_ms,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens,
            estimated_cost_usd=estimated_cost,
            status="success"
        )

        return {
            "sql_query": sql_query,
            "explanation": explanation,
            "model_used": request.model_id
        }
    except Exception as e:
        # Calculate execution time for error case
        execution_time_ms = int((time.time() - start_time) * 1000)

        # Log audit event for error
        primary_table = request.tables[0] if request.tables else None
        if primary_table:
            await log_audit_event(
                event_type="sql_generation",
                catalog=primary_table.catalog,
                schema_name=primary_table.schema_name,
                table_name=primary_table.table,
                columns=primary_table.columns,
                business_logic=request.business_logic,
                model_id=request.model_id,
                execution_time_ms=execution_time_ms,
                status="error",
                error_message=str(e)
            )

        raise HTTPException(status_code=500, detail=f"Failed to generate SQL: {str(e)}")

@app.post("/api/execute-sql")
async def execute_sql(request: SQLExecutionRequest):
    """Execute SQL query and return results"""
    start_time = time.time()
    try:
        logger.info(f"Executing SQL query: {request.sql_query[:100]}...")

        with sql.connect(
            server_hostname=DATABRICKS_HOST.replace("https://", ""),
            http_path=DATABRICKS_HTTP_PATH,
            access_token=DATABRICKS_TOKEN
        ) as connection:
            with connection.cursor() as cursor:
                cursor.execute(request.sql_query)

                # Get column names
                columns = [desc[0] for desc in cursor.description] if cursor.description else []
                logger.info(f"Query returned {len(columns)} columns: {columns}")

                # Fetch results
                rows = cursor.fetchmany(100)  # Limit to 100 rows for safety
                logger.info(f"Fetched {len(rows)} rows")

                # Convert to list of dicts
                results = [dict(zip(columns, row)) for row in rows]
                logger.info(f"Converted {len(results)} results")

                # Calculate execution time
                execution_time_ms = int((time.time() - start_time) * 1000)

                # Log audit event
                await log_audit_event(
                    event_type="sql_execution",
                    generated_sql=request.sql_query,
                    execution_time_ms=execution_time_ms,
                    row_count=len(results),
                    status="success"
                )

                return {
                    "columns": columns,
                    "rows": results,
                    "row_count": len(results)
                }
    except Exception as e:
        # Calculate execution time for error case
        execution_time_ms = int((time.time() - start_time) * 1000)

        # Log audit event for error
        await log_audit_event(
            event_type="sql_execution",
            generated_sql=request.sql_query,
            execution_time_ms=execution_time_ms,
            status="error",
            error_message=str(e)
        )

        logger.error(f"Error executing SQL: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to execute SQL: {str(e)}")

@app.post("/api/save-requirement")
async def save_requirement(request: SaveRequirementRequest):
    """Save a query requirement to Delta table for future reference"""
    try:
        requirement_id = str(uuid.uuid4())
        timestamp = datetime.now()

        # Create the table if it doesn't exist
        create_table_sql = f"""
        CREATE TABLE IF NOT EXISTS {DATABRICKS_CATALOG}.{DATABRICKS_SCHEMA}.saved_requirements (
            requirement_id STRING,
            catalog STRING,
            schema_name STRING,
            table_name STRING,
            columns ARRAY<STRING>,
            business_logic STRING,
            generated_sql STRING,
            model_id STRING,
            created_at TIMESTAMP,
            created_by STRING
        ) USING DELTA
        """

        with sql.connect(
            server_hostname=DATABRICKS_HOST.replace("https://", ""),
            http_path=DATABRICKS_HTTP_PATH,
            access_token=DATABRICKS_TOKEN
        ) as connection:
            with connection.cursor() as cursor:
                # Create table if not exists
                cursor.execute(create_table_sql)

                # Insert the requirement
                columns_array = ",".join([f"'{col}'" for col in request.columns])
                insert_sql = f"""
                INSERT INTO {DATABRICKS_CATALOG}.{DATABRICKS_SCHEMA}.saved_requirements
                (requirement_id, catalog, schema_name, table_name, columns, business_logic, generated_sql, model_id, created_at, created_by)
                VALUES (
                    '{requirement_id}',
                    '{request.catalog}',
                    '{request.schema_name}',
                    '{request.table}',
                    ARRAY({columns_array}),
                    '{request.business_logic.replace("'", "''")}',
                    {f"'{request.generated_sql.replace(chr(39), chr(39)+chr(39))}'" if request.generated_sql else 'NULL'},
                    '{request.model_id}',
                    '{timestamp.isoformat()}',
                    'user'
                )
                """
                cursor.execute(insert_sql)

        logger.info(f"Saved requirement {requirement_id}")

        return {
            "success": True,
            "requirement_id": requirement_id,
            "message": "Requirement saved successfully"
        }

    except Exception as e:
        logger.error(f"Error saving requirement: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to save requirement: {str(e)}")

@app.get("/api/saved-requirements")
async def get_saved_requirements():
    """Get all saved requirements from Delta table"""
    try:
        with sql.connect(
            server_hostname=DATABRICKS_HOST.replace("https://", ""),
            http_path=DATABRICKS_HTTP_PATH,
            access_token=DATABRICKS_TOKEN
        ) as connection:
            with connection.cursor() as cursor:
                # Check if table exists first
                try:
                    cursor.execute(f"""
                        SELECT
                            requirement_id,
                            catalog,
                            schema_name,
                            table_name,
                            columns,
                            business_logic,
                            generated_sql,
                            model_id,
                            created_at,
                            created_by
                        FROM {DATABRICKS_CATALOG}.{DATABRICKS_SCHEMA}.saved_requirements
                        ORDER BY created_at DESC
                        LIMIT 100
                    """)

                    columns = [desc[0] for desc in cursor.description]
                    rows = cursor.fetchall()

                    requirements = []
                    for row in rows:
                        record = dict(zip(columns, row))
                        # Convert timestamp to ISO format
                        if record.get('created_at'):
                            record['created_at'] = record['created_at'].isoformat()
                        requirements.append(record)

                    return {
                        "requirements": requirements,
                        "total_count": len(requirements)
                    }
                except Exception as table_error:
                    if "TABLE_OR_VIEW_NOT_FOUND" in str(table_error) or "does not exist" in str(table_error).lower():
                        # Table doesn't exist yet
                        return {
                            "requirements": [],
                            "total_count": 0
                        }
                    raise
    except Exception as e:
        logger.error(f"Error fetching saved requirements: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch saved requirements: {str(e)}")

@app.delete("/api/saved-requirements/{requirement_id}")
async def delete_saved_requirement(requirement_id: str):
    """Delete a saved requirement by ID"""
    try:
        with sql.connect(
            server_hostname=DATABRICKS_HOST.replace("https://", ""),
            http_path=DATABRICKS_HTTP_PATH,
            access_token=DATABRICKS_TOKEN
        ) as connection:
            with connection.cursor() as cursor:
                cursor.execute(f"""
                    DELETE FROM {DATABRICKS_CATALOG}.{DATABRICKS_SCHEMA}.saved_requirements
                    WHERE requirement_id = '{requirement_id}'
                """)

        logger.info(f"Deleted requirement {requirement_id}")
        return {"success": True, "message": "Requirement deleted successfully"}
    except Exception as e:
        logger.error(f"Error deleting requirement: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to delete requirement: {str(e)}")

# Settings endpoints
class StorageSettingsRequest(BaseModel):
    storage_catalog: str
    storage_schema: str

class CreateTableRequest(BaseModel):
    catalog: str
    schema_name: str

# In-memory settings storage (in production, this would be persisted)
# Initialize with environment defaults
_storage_settings = {
    "storage_catalog": DATABRICKS_CATALOG,
    "storage_schema": DATABRICKS_SCHEMA,
}

@app.get("/api/settings/storage")
async def get_storage_settings():
    """Get current storage settings for saved requirements"""
    try:
        # Check if table exists
        table_exists = False
        try:
            with sql.connect(
                server_hostname=DATABRICKS_HOST.replace("https://", ""),
                http_path=DATABRICKS_HTTP_PATH,
                access_token=DATABRICKS_TOKEN
            ) as connection:
                with connection.cursor() as cursor:
                    cursor.execute(f"""
                        DESCRIBE TABLE {_storage_settings['storage_catalog']}.{_storage_settings['storage_schema']}.saved_requirements
                    """)
                    table_exists = True
        except Exception:
            table_exists = False

        return {
            "storage_catalog": _storage_settings["storage_catalog"],
            "storage_schema": _storage_settings["storage_schema"],
            "table_exists": table_exists,
        }
    except Exception as e:
        logger.error(f"Error getting storage settings: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get storage settings: {str(e)}")

@app.post("/api/settings/storage")
async def save_storage_settings(request: StorageSettingsRequest):
    """Save storage settings for saved requirements"""
    global _storage_settings, DATABRICKS_CATALOG, DATABRICKS_SCHEMA
    try:
        # Validate that catalog and schema exist
        with sql.connect(
            server_hostname=DATABRICKS_HOST.replace("https://", ""),
            http_path=DATABRICKS_HTTP_PATH,
            access_token=DATABRICKS_TOKEN
        ) as connection:
            with connection.cursor() as cursor:
                # Check catalog exists
                cursor.execute(f"SHOW SCHEMAS IN {request.storage_catalog}")
                schemas = [row[0] for row in cursor.fetchall()]
                if request.storage_schema not in schemas:
                    raise HTTPException(status_code=400, detail=f"Schema {request.storage_schema} not found in catalog {request.storage_catalog}")

        # Update settings
        _storage_settings["storage_catalog"] = request.storage_catalog
        _storage_settings["storage_schema"] = request.storage_schema

        # Also update the global variables used by other endpoints
        DATABRICKS_CATALOG = request.storage_catalog
        DATABRICKS_SCHEMA = request.storage_schema

        logger.info(f"Storage settings updated: {request.storage_catalog}.{request.storage_schema}")
        return {"success": True, "message": "Storage settings saved successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error saving storage settings: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to save storage settings: {str(e)}")

@app.get("/api/settings/check-table")
async def check_table_exists(catalog: str, schema: str):
    """Check if saved_requirements table exists in the specified location"""
    try:
        with sql.connect(
            server_hostname=DATABRICKS_HOST.replace("https://", ""),
            http_path=DATABRICKS_HTTP_PATH,
            access_token=DATABRICKS_TOKEN
        ) as connection:
            with connection.cursor() as cursor:
                try:
                    cursor.execute(f"""
                        DESCRIBE TABLE {catalog}.{schema}.saved_requirements
                    """)
                    return {"exists": True}
                except Exception:
                    return {"exists": False}
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Error checking table: {error_msg}", exc_info=True)

        # Return user-friendly error messages
        if "timeout" in error_msg.lower() or "timed out" in error_msg.lower():
            raise HTTPException(status_code=504, detail="Request timed out. The Databricks warehouse may be starting up. Please try again in a few moments.")
        elif "connection" in error_msg.lower():
            raise HTTPException(status_code=503, detail="Unable to connect to Databricks. Please check your network connection and try again.")
        else:
            raise HTTPException(status_code=500, detail=f"Failed to check table: {error_msg}")

@app.post("/api/settings/create-table")
async def create_saved_requirements_table(request: CreateTableRequest):
    """Create the saved_requirements Delta table in the specified location"""
    service_principal = "unknown"

    try:
        with sql.connect(
            server_hostname=DATABRICKS_HOST.replace("https://", ""),
            http_path=DATABRICKS_HTTP_PATH,
            access_token=DATABRICKS_TOKEN
        ) as connection:
            with connection.cursor() as cursor:
                # Get current user/service principal first
                try:
                    cursor.execute("SELECT current_user()")
                    result = cursor.fetchone()
                    if result:
                        service_principal = result[0]
                except Exception:
                    pass

                # Create the table
                cursor.execute(f"""
                    CREATE TABLE IF NOT EXISTS {request.catalog}.{request.schema_name}.saved_requirements (
                        requirement_id STRING NOT NULL,
                        catalog STRING NOT NULL,
                        schema_name STRING NOT NULL,
                        table_name STRING NOT NULL,
                        columns ARRAY<STRING>,
                        business_logic STRING,
                        generated_sql STRING,
                        model_id STRING,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
                        created_by STRING DEFAULT 'system'
                    )
                    USING DELTA
                    COMMENT 'Stores saved SQL query requirements'
                """)

        logger.info(f"Created saved_requirements table in {request.catalog}.{request.schema_name}")
        return {"success": True, "message": f"Table created successfully at {request.catalog}.{request.schema_name}.saved_requirements"}
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Error creating table: {error_msg}", exc_info=True)

        # Build grant suggestions for permission errors
        grant_suggestions = f"""
To fix this, ask a catalog admin to run these commands:

-- Grant catalog access
GRANT USE CATALOG ON CATALOG {request.catalog} TO `{service_principal}`;

-- Grant schema access
GRANT USE SCHEMA ON SCHEMA {request.catalog}.{request.schema_name} TO `{service_principal}`;

-- Grant ability to create tables in schema
GRANT CREATE TABLE ON SCHEMA {request.catalog}.{request.schema_name} TO `{service_principal}`;
"""

        # Return user-friendly error messages with grant suggestions
        if "SCHEMA_NOT_FOUND" in error_msg or ("Schema" in error_msg and "not found" in error_msg.lower()):
            raise HTTPException(
                status_code=404,
                detail=f"Schema '{request.schema_name}' not found in catalog '{request.catalog}'. This could be a permission issue - you may not have USE CATALOG or USE SCHEMA access.\n{grant_suggestions}"
            )
        elif "CATALOG_NOT_FOUND" in error_msg or ("Catalog" in error_msg and "not found" in error_msg.lower()):
            raise HTTPException(
                status_code=404,
                detail=f"Catalog '{request.catalog}' not found. This could be a permission issue - you may not have USE CATALOG access.\n\nTo fix this, ask a catalog admin to run:\nGRANT USE CATALOG ON CATALOG {request.catalog} TO `{service_principal}`;"
            )
        elif "PERMISSION_DENIED" in error_msg or "permission" in error_msg.lower() or "ACCESS_DENIED" in error_msg:
            raise HTTPException(
                status_code=403,
                detail=f"Permission denied: You don't have permission to create tables in {request.catalog}.{request.schema_name}.\n{grant_suggestions}"
            )
        elif "already exists" in error_msg.lower():
            return {"success": True, "message": f"Table already exists at {request.catalog}.{request.schema_name}.saved_requirements"}
        elif "timeout" in error_msg.lower() or "timed out" in error_msg.lower():
            raise HTTPException(status_code=504, detail="Request timed out. The Databricks warehouse may be starting up. Please try again in a few moments.")
        elif "connection" in error_msg.lower():
            raise HTTPException(status_code=503, detail="Unable to connect to Databricks. Please check your network connection and try again.")
        else:
            raise HTTPException(status_code=500, detail=f"Failed to create table: {error_msg}\n{grant_suggestions}")

@app.get("/api/settings/check-permissions")
async def check_table_permissions(catalog: str, schema: str):
    """Check if the service principal has required permissions on the saved_requirements table"""
    try:
        # Get the service principal identity from the current connection
        service_principal = "unknown"
        has_select = False
        has_insert = False
        has_delete = False

        with sql.connect(
            server_hostname=DATABRICKS_HOST.replace("https://", ""),
            http_path=DATABRICKS_HTTP_PATH,
            access_token=DATABRICKS_TOKEN
        ) as connection:
            with connection.cursor() as cursor:
                # Get current user/service principal
                try:
                    cursor.execute("SELECT current_user()")
                    result = cursor.fetchone()
                    if result:
                        service_principal = result[0]
                except Exception as e:
                    logger.warning(f"Could not get current user: {e}")

                # Try to check permissions by attempting operations
                table_name = f"{catalog}.{schema}.saved_requirements"

                # Check SELECT permission
                try:
                    cursor.execute(f"SELECT 1 FROM {table_name} LIMIT 1")
                    has_select = True
                except Exception:
                    has_select = False

                # Check INSERT permission by checking grants (can't actually insert without data)
                # We'll use SHOW GRANTS if available, otherwise try a dry-run approach
                try:
                    cursor.execute(f"SHOW GRANTS ON TABLE {table_name}")
                    grants = cursor.fetchall()
                    for grant in grants:
                        grant_str = str(grant).upper()
                        if service_principal.lower() in str(grant).lower() or 'ALL' in grant_str:
                            if 'INSERT' in grant_str or 'MODIFY' in grant_str or 'ALL PRIVILEGES' in grant_str or 'ALL' in grant_str:
                                has_insert = True
                            if 'DELETE' in grant_str or 'MODIFY' in grant_str or 'ALL PRIVILEGES' in grant_str or 'ALL' in grant_str:
                                has_delete = True
                            if 'SELECT' in grant_str or 'ALL PRIVILEGES' in grant_str or 'ALL' in grant_str:
                                has_select = True
                except Exception as e:
                    logger.warning(f"Could not check grants: {e}")
                    # If we can SELECT, assume we have basic access
                    # For INSERT/DELETE, we'll optimistically assume they work if SELECT works
                    if has_select:
                        has_insert = True
                        has_delete = True

        return {
            "service_principal": service_principal,
            "has_select": has_select,
            "has_insert": has_insert,
            "has_delete": has_delete,
            "has_all_permissions": has_select and has_insert and has_delete
        }
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Error checking permissions: {error_msg}", exc_info=True)

        # Return user-friendly error messages
        if "timeout" in error_msg.lower() or "timed out" in error_msg.lower():
            raise HTTPException(status_code=504, detail="Request timed out. The Databricks warehouse may be starting up. Please try again in a few moments.")
        elif "connection" in error_msg.lower():
            raise HTTPException(status_code=503, detail="Unable to connect to Databricks. Please check your network connection and try again.")
        else:
            raise HTTPException(status_code=500, detail=f"Failed to check permissions: {error_msg}")

class GrantPermissionsRequest(BaseModel):
    catalog: str
    schema_name: str

@app.post("/api/settings/grant-permissions")
async def grant_table_permissions(request: GrantPermissionsRequest):
    """Grant required permissions on the saved_requirements table to the current service principal"""
    try:
        with sql.connect(
            server_hostname=DATABRICKS_HOST.replace("https://", ""),
            http_path=DATABRICKS_HTTP_PATH,
            access_token=DATABRICKS_TOKEN
        ) as connection:
            with connection.cursor() as cursor:
                # Get current user/service principal
                cursor.execute("SELECT current_user()")
                result = cursor.fetchone()
                service_principal = result[0] if result else None

                if not service_principal:
                    raise HTTPException(status_code=400, detail="Could not determine current service principal")

                table_name = f"{request.catalog}.{request.schema_name}.saved_requirements"

                # Grant permissions
                # Note: The user running this needs to have GRANT privileges on the table
                # For Unity Catalog Delta tables, use SELECT and MODIFY (MODIFY covers INSERT/UPDATE/DELETE)
                try:
                    cursor.execute(f"GRANT SELECT, MODIFY ON TABLE {table_name} TO `{service_principal}`")
                    logger.info(f"Granted permissions on {table_name} to {service_principal}")
                    return {
                        "success": True,
                        "message": f"Permissions granted to {service_principal}",
                        "service_principal": service_principal
                    }
                except Exception as grant_error:
                    error_msg = str(grant_error)
                    if "PERMISSION_DENIED" in error_msg or "permission" in error_msg.lower() or "INVALID_PARAMETER_VALUE" in error_msg:
                        raise HTTPException(
                            status_code=403,
                            detail=f"Cannot grant permissions. The current user may not have GRANT privileges. "
                                   f"Please ask a catalog admin to run: GRANT SELECT, MODIFY ON TABLE {table_name} TO `{service_principal}`"
                        )
                    raise

    except HTTPException:
        raise
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Error granting permissions: {error_msg}", exc_info=True)

        # Return user-friendly error messages
        if "timeout" in error_msg.lower() or "timed out" in error_msg.lower():
            raise HTTPException(status_code=504, detail="Request timed out. The Databricks warehouse may be starting up. Please try again in a few moments.")
        elif "connection" in error_msg.lower():
            raise HTTPException(status_code=503, detail="Unable to connect to Databricks. Please check your network connection and try again.")
        else:
            raise HTTPException(status_code=500, detail=f"Failed to grant permissions: {error_msg}")

@app.get("/api/dashboard-statistics")
async def get_dashboard_statistics():
    """Get dashboard statistics from audit logs - using SELECT * approach like query-history"""
    try:
        with sql.connect(
            server_hostname=DATABRICKS_HOST.replace("https://", ""),
            http_path=DATABRICKS_HTTP_PATH,
            access_token=DATABRICKS_TOKEN
        ) as connection:
            with connection.cursor() as cursor:
                # Fetch ALL audit log records and aggregate in Python
                # This avoids the pandas/Arrow conversion issues with SQL aggregates
                cursor.execute("""
                    SELECT
                        event_type,
                        execution_time_ms,
                        row_count,
                        status,
                        table_name
                    FROM arao.text_to_sql.audit_logs
                """)

                columns = [desc[0] for desc in cursor.description]
                rows = cursor.fetchall()

                # Convert to list of dicts
                records = [dict(zip(columns, row)) for row in rows]

                # Aggregate in Python
                total_executions = sum(1 for r in records if r['event_type'] == 'sql_execution')
                total_llm_calls = sum(1 for r in records if r['event_type'] in ('business_logic_suggestion', 'sql_generation'))

                # Average execution time for SQL executions
                sql_execution_times = [r['execution_time_ms'] for r in records
                                      if r['event_type'] == 'sql_execution'
                                      and r['status'] == 'success'
                                      and r['execution_time_ms'] is not None]
                avg_execution_time = int(sum(sql_execution_times) / len(sql_execution_times)) if sql_execution_times else 0

                # Success rate
                total_records = len(records)
                successful_records = sum(1 for r in records if r['status'] == 'success')
                success_rate = round((successful_records * 100.0 / total_records), 2) if total_records > 0 else 0.0

                # Total rows returned
                total_rows = sum(r['row_count'] for r in records
                               if r['event_type'] == 'sql_execution'
                               and r['status'] == 'success'
                               and r['row_count'] is not None)

                # Unique tables
                unique_tables = len(set(r['table_name'] for r in records if r['table_name'] is not None))

                logger.info(f"Dashboard stats - total_executions: {total_executions}, total_llm_calls: {total_llm_calls}")
                logger.info(f"Dashboard stats - avg_time: {avg_execution_time}, success_rate: {success_rate}")
                logger.info(f"Dashboard stats - total_rows: {total_rows}, unique_tables: {unique_tables}")

                return {
                    "total_executions": total_executions,
                    "total_llm_calls": total_llm_calls,
                    "avg_execution_time_ms": avg_execution_time,
                    "success_rate": success_rate,
                    "total_rows_returned": total_rows,
                    "unique_tables_analyzed": unique_tables
                }
    except Exception as e:
        logger.error(f"Error fetching dashboard statistics: {str(e)}", exc_info=True)
        # Return default values instead of failing
        return {
            "total_executions": 0,
            "total_llm_calls": 0,
            "avg_execution_time_ms": 0,
            "success_rate": 0.0,
            "total_rows_returned": 0,
            "unique_tables_analyzed": 0
        }

@app.get("/api/query-history")
async def get_query_history():
    """Get query history with grouped LLM calls and execution details"""
    try:
        with sql.connect(
            server_hostname=DATABRICKS_HOST.replace("https://", ""),
            http_path=DATABRICKS_HTTP_PATH,
            access_token=DATABRICKS_TOKEN
        ) as connection:
            with connection.cursor() as cursor:
                # Get all events ordered by timestamp ASC for proper grouping
                cursor.execute("""
                    SELECT
                        log_id,
                        timestamp,
                        event_type,
                        catalog,
                        schema_name,
                        table_name,
                        columns,
                        business_logic,
                        generated_sql,
                        model_id,
                        execution_time_ms,
                        row_count,
                        status,
                        error_message,
                        prompt_tokens,
                        completion_tokens,
                        total_tokens,
                        estimated_cost_usd,
                        business_logic_length,
                        generated_sql_length
                    FROM arao.text_to_sql.audit_logs
                    ORDER BY timestamp ASC
                    LIMIT 200
                """)

                columns = [desc[0] for desc in cursor.description]
                rows = cursor.fetchall()

                # Group events by table and timestamp proximity (within 30 seconds)
                # IMPORTANT: Now handles queries without business_logic_suggestion
                query_sessions = []
                current_session = None

                for row in rows:
                    record = dict(zip(columns, row))
                    if record.get('timestamp'):
                        record['timestamp'] = record['timestamp'].isoformat()

                    event_type = record['event_type']

                    # Start a new session if we encounter a business_logic_suggestion
                    if event_type == 'business_logic_suggestion':
                        if current_session:
                            query_sessions.append(current_session)
                        current_session = {
                            'session_id': record['log_id'],
                            'timestamp': record['timestamp'],
                            'table_name': record['table_name'],
                            'catalog': record['catalog'],
                            'schema_name': record['schema_name'],
                            'columns': record['columns'],
                            'business_logic': record['business_logic'],
                            'business_logic_suggestion': record,
                            'sql_generation': None,
                            'sql_execution': None,
                            'total_cost_usd': record['estimated_cost_usd'] or 0,
                            'total_tokens': record['total_tokens'] or 0,
                            'total_time_ms': record['execution_time_ms'] or 0,
                            'status': 'incomplete'
                        }

                    # Handle sql_generation - add to current session OR create new session if orphaned
                    elif event_type == 'sql_generation':
                        if current_session:
                            # Add to existing session
                            current_session['sql_generation'] = record
                            current_session['generated_sql'] = record['generated_sql']
                            current_session['total_cost_usd'] += record['estimated_cost_usd'] or 0
                            current_session['total_tokens'] += record['total_tokens'] or 0
                            current_session['total_time_ms'] += record['execution_time_ms'] or 0
                        else:
                            # Create new session starting with sql_generation (no suggestion)
                            current_session = {
                                'session_id': record['log_id'],
                                'timestamp': record['timestamp'],
                                'table_name': record['table_name'],
                                'catalog': record['catalog'],
                                'schema_name': record['schema_name'],
                                'columns': record['columns'],
                                'business_logic': record['business_logic'],
                                'business_logic_suggestion': None,
                                'sql_generation': record,
                                'sql_execution': None,
                                'generated_sql': record['generated_sql'],
                                'total_cost_usd': record['estimated_cost_usd'] or 0,
                                'total_tokens': record['total_tokens'] or 0,
                                'total_time_ms': record['execution_time_ms'] or 0,
                                'status': 'incomplete'
                            }

                    # Handle sql_execution - add to current session OR create standalone entry
                    elif event_type == 'sql_execution':
                        if current_session:
                            # Add to existing session and complete it
                            current_session['sql_execution'] = record
                            current_session['row_count'] = record['row_count']
                            current_session['total_time_ms'] += record['execution_time_ms'] or 0
                            current_session['status'] = record['status']
                            # Execution marks end of session
                            query_sessions.append(current_session)
                            current_session = None
                        else:
                            # Create standalone execution entry (orphaned execution)
                            query_sessions.append({
                                'session_id': record['log_id'],
                                'timestamp': record['timestamp'],
                                'table_name': record['table_name'],
                                'catalog': record['catalog'],
                                'schema_name': record['schema_name'],
                                'columns': record['columns'],
                                'business_logic': None,
                                'business_logic_suggestion': None,
                                'sql_generation': None,
                                'sql_execution': record,
                                'generated_sql': record['generated_sql'],
                                'row_count': record['row_count'],
                                'total_cost_usd': 0,
                                'total_tokens': 0,
                                'total_time_ms': record['execution_time_ms'] or 0,
                                'status': record['status']
                            })

                # Add last session if exists (incomplete session)
                if current_session:
                    query_sessions.append(current_session)

                # Reverse to show most recent first
                query_sessions.reverse()

                return {
                    "query_sessions": query_sessions,
                    "total_count": len(query_sessions)
                }
    except Exception as e:
        logger.error(f"Error fetching query history: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch query history: {str(e)}")

@app.get("/api/llm-analytics")
async def get_llm_analytics():
    """Get detailed LLM analytics per query"""
    try:
        with sql.connect(
            server_hostname=DATABRICKS_HOST.replace("https://", ""),
            http_path=DATABRICKS_HTTP_PATH,
            access_token=DATABRICKS_TOKEN
        ) as connection:
            with connection.cursor() as cursor:
                # Get per-query LLM costs and details
                cursor.execute("""
                    SELECT
                        log_id,
                        timestamp,
                        event_type,
                        table_name,
                        business_logic,
                        generated_sql,
                        model_id,
                        prompt_tokens,
                        completion_tokens,
                        total_tokens,
                        estimated_cost_usd,
                        business_logic_length,
                        generated_sql_length,
                        execution_time_ms,
                        status
                    FROM arao.text_to_sql.audit_logs
                    WHERE event_type IN ('business_logic_suggestion', 'sql_generation')
                    ORDER BY timestamp DESC
                    LIMIT 100
                """)

                columns = [desc[0] for desc in cursor.description]
                rows = cursor.fetchall()

                analytics = []
                for row in rows:
                    record = dict(zip(columns, row))
                    # Convert timestamp to ISO format
                    if record.get('timestamp'):
                        record['timestamp'] = record['timestamp'].isoformat()
                    analytics.append(record)

                # Get aggregate LLM metrics
                cursor.execute("""
                    SELECT
                        SUM(prompt_tokens) as total_prompt_tokens,
                        SUM(completion_tokens) as total_completion_tokens,
                        SUM(total_tokens) as total_tokens,
                        SUM(estimated_cost_usd) as total_cost,
                        AVG(estimated_cost_usd) as avg_cost_per_call,
                        COUNT(*) as total_llm_calls
                    FROM arao.text_to_sql.audit_logs
                    WHERE event_type IN ('business_logic_suggestion', 'sql_generation')
                    AND status = 'success'
                """)

                agg_row = cursor.fetchone()
                aggregates = {
                    "total_prompt_tokens": int(agg_row[0] or 0),
                    "total_completion_tokens": int(agg_row[1] or 0),
                    "total_tokens": int(agg_row[2] or 0),
                    "total_cost_usd": round(float(agg_row[3] or 0), 4),
                    "avg_cost_per_call_usd": round(float(agg_row[4] or 0), 6),
                    "total_llm_calls": int(agg_row[5] or 0)
                }

                return {
                    "details": analytics,
                    "aggregates": aggregates
                }
    except Exception as e:
        logger.error(f"Error fetching LLM analytics: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch LLM analytics: {str(e)}")

@app.get("/api/llm-costs-by-model")
async def get_llm_costs_by_model():
    """Get aggregated LLM costs grouped by model"""

    def fetch_costs():
        """Run blocking SQL query in thread pool"""
        try:
            with sql.connect(
                server_hostname=DATABRICKS_HOST.replace("https://", ""),
                http_path=DATABRICKS_HTTP_PATH,
                access_token=DATABRICKS_TOKEN,
                _socket_timeout=3  # 3 second socket timeout
            ) as connection:
                with connection.cursor() as cursor:
                    # Get costs aggregated by model
                    cursor.execute("""
                        SELECT
                            model_id,
                            SUM(prompt_tokens) as total_prompt_tokens,
                            SUM(completion_tokens) as total_completion_tokens,
                            SUM(total_tokens) as total_tokens,
                            SUM(estimated_cost_usd) as total_cost,
                            COUNT(*) as call_count
                        FROM arao.text_to_sql.audit_logs
                        WHERE event_type IN ('business_logic_suggestion', 'sql_generation')
                        AND status = 'success'
                        AND model_id IS NOT NULL
                        GROUP BY model_id
                        ORDER BY total_cost DESC
                    """)

                    columns = [desc[0] for desc in cursor.description]
                    rows = cursor.fetchall()

                    models = []
                    total_cost = 0
                    total_prompt_tokens = 0
                    total_completion_tokens = 0

                    for row in rows:
                        record = dict(zip(columns, row))
                        models.append(record)
                        total_cost += record['total_cost'] or 0
                        total_prompt_tokens += record['total_prompt_tokens'] or 0
                        total_completion_tokens += record['total_completion_tokens'] or 0

                    return {
                        "models": models,
                        "total_cost": total_cost,
                        "total_prompt_tokens": total_prompt_tokens,
                        "total_completion_tokens": total_completion_tokens
                    }
        except Exception as e:
            logger.warning(f"Error fetching LLM costs: {str(e)}")
            raise

    try:
        # Run blocking query in thread pool with timeout
        import asyncio
        result = await asyncio.wait_for(
            asyncio.to_thread(fetch_costs),
            timeout=12.0  # 12 second total timeout to accommodate slow Databricks queries
        )
        return result
    except asyncio.TimeoutError:
        logger.warning("LLM costs query timed out after 12 seconds")
        return {
            "models": [],
            "total_cost": 0.0,
            "total_prompt_tokens": 0,
            "total_completion_tokens": 0
        }
    except Exception as e:
        logger.error(f"Error fetching LLM costs by model: {str(e)}", exc_info=True)
        # Return default values instead of failing
        return {
            "models": [],
            "total_cost": 0.0,
            "total_prompt_tokens": 0,
            "total_completion_tokens": 0
        }

@app.get("/api/analytics/llm-usage")
async def get_llm_usage_analytics():
    """Get detailed LLM usage analytics including most used, most costly, and slowest models"""
    try:
        with sql.connect(
            server_hostname=DATABRICKS_HOST.replace("https://", ""),
            http_path=DATABRICKS_HTTP_PATH,
            access_token=DATABRICKS_TOKEN
        ) as connection:
            with connection.cursor() as cursor:
                # Most used LLMs
                cursor.execute("""
                    SELECT
                        model_id,
                        COUNT(*) as usage_count,
                        SUM(estimated_cost_usd) as total_cost,
                        AVG(execution_time_ms) as avg_execution_time,
                        SUM(prompt_tokens) as total_prompt_tokens,
                        SUM(completion_tokens) as total_completion_tokens
                    FROM arao.text_to_sql.audit_logs
                    WHERE event_type IN ('business_logic_suggestion', 'sql_generation')
                    AND status = 'success'
                    AND model_id IS NOT NULL
                    GROUP BY model_id
                    ORDER BY usage_count DESC
                """)

                columns = [desc[0] for desc in cursor.description]
                rows = cursor.fetchall()

                llm_stats = []
                for row in rows:
                    record = dict(zip(columns, row))
                    llm_stats.append(record)

                # Sort by different metrics
                most_used = sorted(llm_stats, key=lambda x: x['usage_count'], reverse=True)[:5]
                most_costly = sorted(llm_stats, key=lambda x: x['total_cost'] or 0, reverse=True)[:5]
                slowest = sorted(llm_stats, key=lambda x: x['avg_execution_time'] or 0, reverse=True)[:5]
                fastest = sorted(llm_stats, key=lambda x: x['avg_execution_time'] or float('inf'))[:5]

                return {
                    "most_used": most_used,
                    "most_costly": most_costly,
                    "slowest": slowest,
                    "fastest": fastest,
                    "all_models": llm_stats
                }
    except Exception as e:
        logger.error(f"Error fetching LLM usage analytics: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch LLM usage analytics: {str(e)}")

@app.get("/api/analytics/top-queries")
async def get_top_queries_analytics():
    """Get analytics about top queries - most costly, slowest, longest execution"""
    try:
        with sql.connect(
            server_hostname=DATABRICKS_HOST.replace("https://", ""),
            http_path=DATABRICKS_HTTP_PATH,
            access_token=DATABRICKS_TOKEN
        ) as connection:
            with connection.cursor() as cursor:
                # Get query sessions with aggregated metrics
                cursor.execute("""
                    WITH query_metrics AS (
                        SELECT
                            session_id,
                            MAX(CASE WHEN event_type = 'query_session_start' THEN timestamp END) as timestamp,
                            MAX(CASE WHEN event_type = 'query_session_start' THEN catalog END) as catalog,
                            MAX(CASE WHEN event_type = 'query_session_start' THEN schema_name END) as schema_name,
                            MAX(CASE WHEN event_type = 'query_session_start' THEN table_name END) as table_name,
                            MAX(CASE WHEN event_type = 'sql_generation' THEN generated_sql END) as generated_sql,
                            MAX(CASE WHEN event_type = 'sql_generation' THEN business_logic END) as business_logic,
                            SUM(CASE WHEN status = 'success' THEN estimated_cost_usd ELSE 0 END) as total_cost_usd,
                            SUM(CASE WHEN status = 'success' THEN execution_time_ms ELSE 0 END) as total_time_ms,
                            SUM(CASE WHEN status = 'success' THEN prompt_tokens + completion_tokens ELSE 0 END) as total_tokens,
                            MAX(CASE WHEN event_type = 'sql_execution' THEN row_count END) as row_count,
                            MAX(CASE WHEN event_type = 'sql_execution' THEN execution_time_ms END) as sql_execution_time_ms
                        FROM arao.text_to_sql.audit_logs
                        WHERE status = 'success'
                        GROUP BY session_id
                    )
                    SELECT *
                    FROM query_metrics
                    WHERE timestamp IS NOT NULL
                    ORDER BY timestamp DESC
                    LIMIT 100
                """)

                columns = [desc[0] for desc in cursor.description]
                rows = cursor.fetchall()

                queries = []
                for row in rows:
                    record = dict(zip(columns, row))
                    queries.append(record)

                # Sort by different metrics
                most_costly = sorted(queries, key=lambda x: x['total_cost_usd'] or 0, reverse=True)[:10]
                slowest_total = sorted(queries, key=lambda x: x['total_time_ms'] or 0, reverse=True)[:10]
                slowest_execution = sorted(
                    [q for q in queries if q.get('sql_execution_time_ms')],
                    key=lambda x: x['sql_execution_time_ms'] or 0,
                    reverse=True
                )[:10]
                most_rows = sorted(
                    [q for q in queries if q.get('row_count')],
                    key=lambda x: x['row_count'] or 0,
                    reverse=True
                )[:10]

                return {
                    "most_costly": most_costly,
                    "slowest_total_time": slowest_total,
                    "slowest_execution": slowest_execution,
                    "most_rows_returned": most_rows,
                    "recent_queries": queries[:20]
                }
    except Exception as e:
        logger.error(f"Error fetching top queries analytics: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch top queries analytics: {str(e)}")

@app.get("/api/analytics/summary")
async def get_analytics_summary():
    """Get comprehensive analytics summary with comparisons and trends"""
    try:
        with sql.connect(
            server_hostname=DATABRICKS_HOST.replace("https://", ""),
            http_path=DATABRICKS_HTTP_PATH,
            access_token=DATABRICKS_TOKEN
        ) as connection:
            with connection.cursor() as cursor:
                # Overall statistics with comparisons
                cursor.execute("""
                    SELECT
                        COUNT(DISTINCT session_id) as total_queries,
                        COUNT(DISTINCT CASE WHEN event_type IN ('business_logic_suggestion', 'sql_generation') THEN model_id END) as unique_models_used,
                        AVG(CASE WHEN status = 'success' THEN estimated_cost_usd END) as avg_cost_per_query,
                        MAX(CASE WHEN status = 'success' THEN estimated_cost_usd END) as max_cost_query,
                        MIN(CASE WHEN status = 'success' AND estimated_cost_usd > 0 THEN estimated_cost_usd END) as min_cost_query,
                        AVG(CASE WHEN status = 'success' THEN execution_time_ms END) as avg_time_per_event,
                        MAX(CASE WHEN status = 'success' THEN execution_time_ms END) as max_time_event,
                        SUM(CASE WHEN status = 'success' THEN prompt_tokens END) as total_prompt_tokens,
                        SUM(CASE WHEN status = 'success' THEN completion_tokens END) as total_completion_tokens,
                        AVG(CASE WHEN event_type = 'sql_execution' AND status = 'success' THEN row_count END) as avg_rows_returned
                    FROM arao.text_to_sql.audit_logs
                """)

                row = cursor.fetchone()
                columns = [desc[0] for desc in cursor.description]
                summary = dict(zip(columns, row)) if row else {}

                # Cost efficiency (tokens per dollar)
                total_tokens = (summary.get('total_prompt_tokens') or 0) + (summary.get('total_completion_tokens') or 0)
                total_cost = summary.get('avg_cost_per_query', 0) * summary.get('total_queries', 1)
                summary['tokens_per_dollar'] = total_tokens / total_cost if total_cost > 0 else 0

                return summary
    except Exception as e:
        logger.error(f"Error fetching analytics summary: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch analytics summary: {str(e)}")

@app.get("/api/data")
async def get_data():
    """Sample data endpoint"""
    return [
        {"id": 1, "name": "Query Executions", "value": 1234},
        {"id": 2, "name": "Tables Analyzed", "value": 567},
        {"id": 3, "name": "Successful Conversions", "value": 890},
        {"id": 4, "name": "Active Users", "value": 45},
        {"id": 5, "name": "Avg Response Time (ms)", "value": 234},
        {"id": 6, "name": "Cache Hit Rate (%)", "value": 87}
    ]

static_dir = Path(__file__).parent / "static"

if static_dir.exists():
    app.mount("/assets", StaticFiles(directory=static_dir / "assets"), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        """Serve the React SPA for all other routes"""
        if full_path.startswith("api/") or full_path.startswith("docs") or full_path.startswith("openapi.json"):
            raise HTTPException(status_code=404, detail="Not found")

        file_path = static_dir / full_path

        if file_path.is_file():
            return FileResponse(file_path)

        index_path = static_dir / "index.html"
        if index_path.is_file():
            return FileResponse(index_path)

        raise HTTPException(status_code=404, detail="Not found")

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=DEBUG)
