import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Container,
  Paper,
  Typography,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Button,
  Chip,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  OutlinedInput,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  IconButton,
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material'
import {
  PlayArrow as RunIcon,
  AutoAwesome as GenerateIcon,
  Storage as DatabaseIcon,
  Code as CodeIcon,
  Lightbulb as LightbulbIcon,
  Close as CloseIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Psychology as AiIcon,
} from '@mui/icons-material'

interface Model {
  id: string
  name: string
  description: string
}

interface Column {
  name: string
  type: string
  comment: string | null
}

interface TableSelection {
  id: string
  catalog: string
  schema: string
  table: string
  columns: string[]
  // Available options
  schemas: string[]
  tables: string[]
  columnsList: Column[]
}

export default function JoinQueryGenerator() {
  const [models, setModels] = useState<Model[]>([])
  const [catalogs, setCatalogs] = useState<string[]>([])
  const [selectedModel, setSelectedModel] = useState('')
  const [businessLogic, setBusinessLogic] = useState('')
  const [joinConditions, setJoinConditions] = useState('')

  // Dynamic tables array
  const [tables, setTables] = useState<TableSelection[]>([
    { id: crypto.randomUUID(), catalog: '', schema: '', table: '', columns: [], schemas: [], tables: [], columnsList: [] },
    { id: crypto.randomUUID(), catalog: '', schema: '', table: '', columns: [], schemas: [], tables: [], columnsList: [] },
  ])

  const [generatedSQL, setGeneratedSQL] = useState('')
  const [sqlExplanation, setSqlExplanation] = useState('')
  const [sqlResults, setSqlResults] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Business logic assistant state
  const [assistantDialogOpen, setAssistantDialogOpen] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [loadingJoinSuggestion, setLoadingJoinSuggestion] = useState(false)

  // Warehouse status state
  const [warehouseStatus, setWarehouseStatus] = useState<any>(null)
  const [loadingWarehouseStatus, setLoadingWarehouseStatus] = useState(true)

  // Helper function to create an empty table
  const createEmptyTable = (): TableSelection => ({
    id: crypto.randomUUID(),
    catalog: '',
    schema: '',
    table: '',
    columns: [],
    schemas: [],
    tables: [],
    columnsList: [],
  })

  // Add a new table
  const addTable = () => {
    setTables(prevTables => [...prevTables, createEmptyTable()])
  }

  // Remove a table
  const removeTable = (id: string) => {
    setTables(prevTables => {
      if (prevTables.length > 2) {
        return prevTables.filter(t => t.id !== id)
      }
      return prevTables
    })
  }

  // Update a specific table's field
  const updateTable = (id: string, updates: Partial<TableSelection>) => {
    setTables(prevTables => prevTables.map(t => (t.id === id ? { ...t, ...updates } : t)))
  }

  // Fetch schemas for a table when catalog changes
  const fetchSchemas = async (tableId: string, catalog: string) => {
    if (!catalog) return
    try {
      const res = await fetch(`/api/catalogs/${catalog}/schemas`)
      const data = await res.json()
      if (data && data.schemas && Array.isArray(data.schemas)) {
        updateTable(tableId, { schemas: data.schemas })
      }
    } catch (err) {
      updateTable(tableId, { schemas: [] })
    }
  }

  // Fetch tables for a table when schema changes
  const fetchTables = async (tableId: string, catalog: string, schema: string) => {
    if (!catalog || !schema) return
    try {
      const res = await fetch(`/api/catalogs/${catalog}/schemas/${schema}/tables`)
      const data = await res.json()
      if (data && data.tables && Array.isArray(data.tables)) {
        updateTable(tableId, { tables: data.tables })
      }
    } catch (err) {
      updateTable(tableId, { tables: [] })
    }
  }

  // Fetch columns for a table when table changes
  const fetchColumns = async (tableId: string, catalog: string, schema: string, table: string) => {
    if (!catalog || !schema || !table) return
    try {
      const res = await fetch(`/api/catalogs/${catalog}/schemas/${schema}/tables/${table}/columns`)
      const data = await res.json()
      if (data && data.columns && Array.isArray(data.columns)) {
        updateTable(tableId, { columnsList: data.columns })
      }
    } catch (err) {
      updateTable(tableId, { columnsList: [] })
    }
  }

  // Fetch available models
  useEffect(() => {
    fetch('/api/models')
      .then(res => res.json())
      .then(data => {
        if (data && data.models && Array.isArray(data.models)) {
          setModels(data.models)
          if (data.models.length > 0) {
            setSelectedModel(data.models[0].id)
          }
        } else {
          setModels([])
          setError('Invalid models data received')
        }
      })
      .catch(() => {
        setModels([])
        setError('Failed to load models')
      })
  }, [])

  // Fetch warehouse status
  useEffect(() => {
    fetch('/api/warehouse-status')
      .then(res => res.json())
      .then(data => {
        setWarehouseStatus(data)
        setLoadingWarehouseStatus(false)
      })
      .catch(() => {
        setLoadingWarehouseStatus(false)
      })
  }, [])

  // Fetch catalogs on mount
  useEffect(() => {
    fetch('/api/catalogs')
      .then(res => res.json())
      .then(data => {
        if (data && data.catalogs && Array.isArray(data.catalogs)) {
          setCatalogs(data.catalogs)
        } else {
          setCatalogs([])
          setError('Invalid catalogs data received')
        }
      })
      .catch(() => {
        setCatalogs([])
        setError('Failed to load catalogs')
      })
  }, [])

  const handleReset = () => {
    setTables([createEmptyTable(), createEmptyTable()])
    setBusinessLogic('')
    setJoinConditions('')
    setGeneratedSQL('')
    setSqlExplanation('')
    setSqlResults(null)
    setError(null)
  }

  const handleOpenAssistant = async () => {
    // Get all valid tables
    const validTables = tables.filter(t => t.catalog && t.schema && t.table && t.columns.length > 0)
    if (validTables.length === 0) {
      setError('Please select at least one table with columns to get AI suggestions')
      return
    }

    setAssistantDialogOpen(true)
    setLoadingSuggestions(true)
    setSuggestions([])

    try {
      // Use the first table as primary, send remaining as additional_tables
      const primaryTable = validTables[0]
      const additionalTables = validTables.length > 1
        ? validTables.slice(1).map(t => ({
            catalog: t.catalog,
            schema_name: t.schema,
            table: t.table,
            columns: t.columns,
          }))
        : undefined

      const response = await fetch('/api/suggest-business-logic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          catalog: primaryTable.catalog,
          schema_name: primaryTable.schema,
          table: primaryTable.table,
          columns: primaryTable.columns,
          model_id: selectedModel,
          // Send additional tables for comprehensive context
          additional_tables: additionalTables,
        }),
      })

      const data = await response.json()
      if (response.ok) {
        setSuggestions(data.suggestions || [])
      } else {
        setError(data.detail || 'Failed to generate suggestions')
      }
    } catch (err) {
      setError('Failed to generate suggestions')
    } finally {
      setLoadingSuggestions(false)
    }
  }

  const handleSelectSuggestion = (suggestion: string) => {
    setBusinessLogic(suggestion)
    setAssistantDialogOpen(false)
  }

  const handleSuggestJoinConditions = async () => {
    // Get all valid tables with at least 2 tables required
    const validTables = tables.filter(t => t.catalog && t.schema && t.table && t.columns.length > 0)
    if (validTables.length < 2) {
      setError('Please select at least 2 tables to get AI-suggested join conditions')
      return
    }

    setLoadingJoinSuggestion(true)
    setError(null)

    try {
      const response = await fetch('/api/suggest-join-conditions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tables: validTables.map(t => ({
            catalog: t.catalog,
            schema_name: t.schema,
            table: t.table,
            columns: t.columns,
          })),
          model_id: selectedModel,
        }),
      })

      const data = await response.json()
      if (response.ok) {
        setJoinConditions(data.join_condition || '')
      } else {
        setError(data.detail || 'Failed to suggest join conditions')
      }
    } catch (err) {
      setError('Failed to suggest join conditions')
    } finally {
      setLoadingJoinSuggestion(false)
    }
  }

  const handleGenerateSQL = async () => {
    // Validate all tables have required fields
    const invalidTable = tables.find(t => !t.catalog || !t.schema || !t.table || t.columns.length === 0)
    if (invalidTable || !businessLogic) {
      setError('Please select all tables with their catalogs, schemas, tables, and columns, and provide business logic')
      return
    }

    setLoading(true)
    setError(null)
    setGeneratedSQL('')
    setSqlExplanation('')
    setSqlResults(null)

    try {
      const payload = {
        tables: tables.map(t => ({
          catalog: t.catalog,
          schema_name: t.schema,
          table: t.table,
          columns: t.columns,
        })),
        business_logic: businessLogic,
        model_id: selectedModel,
        join_conditions: joinConditions || null,
      }

      const response = await fetch('/api/generate-sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json()
      if (response.ok) {
        setGeneratedSQL(data.sql_query)
        setSqlExplanation(data.explanation || '')
      } else {
        setError(data.detail || 'Failed to generate SQL')
      }
    } catch (err) {
      setError('Failed to generate SQL')
    } finally {
      setLoading(false)
    }
  }

  const handleExecuteSQL = async () => {
    if (!generatedSQL) return

    setLoading(true)
    setError(null)
    setSqlResults(null)

    try {
      const response = await fetch('/api/execute-sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql_query: generatedSQL }),
      })

      const data = await response.json()

      if (response.ok) {
        setSqlResults(data)
      } else {
        setError(data.detail || 'Failed to execute SQL')
      }
    } catch (err) {
      setError('Failed to execute SQL')
    } finally {
      setLoading(false)
    }
  }

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, color: 'text.primary', mb: 1 }}>
            Join Query Generator
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Generate SQL queries that join multiple tables with AI
          </Typography>
        </Box>
        <Button
          variant="outlined"
          color="primary"
          startIcon={<RefreshIcon />}
          onClick={handleReset}
          sx={{ mt: 1 }}
        >
          Reset
        </Button>
      </Box>

      {/* Warehouse Status Accordion */}
      <Accordion sx={{ mb: 2 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
            <DatabaseIcon color="primary" />
            <Typography variant="h6" fontWeight="600">
              Warehouse Status
            </Typography>
            {!loadingWarehouseStatus && warehouseStatus && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 'auto', mr: 2 }}>
                {warehouseStatus.status === 'RUNNING' ? (
                  <><CheckCircleIcon color="success" fontSize="small" /><Typography variant="body2" color="success.main">Running</Typography></>
                ) : (
                  <><ErrorIcon color="error" fontSize="small" /><Typography variant="body2" color="error.main">Stopped</Typography></>
                )}
              </Box>
            )}
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          {loadingWarehouseStatus ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
              <CircularProgress size={24} />
            </Box>
          ) : warehouseStatus ? (
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">Warehouse Name</Typography>
                <Typography variant="body2" fontWeight="500">{warehouseStatus.warehouse_name || 'N/A'}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Warehouse ID</Typography>
                <Typography variant="body2" fontWeight="500">{warehouseStatus.warehouse_id || 'N/A'}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Status</Typography>
                <Chip
                  label={warehouseStatus.status}
                  color={warehouseStatus.status === 'RUNNING' ? 'success' : 'error'}
                  size="small"
                />
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">HTTP Path</Typography>
                <Typography variant="body2" fontWeight="500" sx={{ fontSize: '0.75rem' }}>
                  {warehouseStatus.http_path || 'N/A'}
                </Typography>
              </Box>
            </Box>
          ) : (
            <Typography color="text.secondary">Unable to load warehouse status</Typography>
          )}
        </AccordionDetails>
      </Accordion>

      {error && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        </motion.div>
      )}

      {/* Dynamic Table Selection Cards */}
      {tables.map((table, index) => (
        <motion.div
          key={table.id}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.1 * (index + 1) }}
        >
          <Paper
            elevation={2}
            sx={{
              p: 3,
              mb: 3,
              bgcolor: 'white',
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <DatabaseIcon color="primary" />
                <Typography variant="h6" fontWeight="600" color="text.primary">
                  {index + 1}. Select Table {index + 1}
                </Typography>
              </Box>
              {tables.length > 2 && (
                <Tooltip title="Remove this table">
                  <IconButton onClick={() => removeTable(table.id)} color="error" size="small">
                    <DeleteIcon />
                  </IconButton>
                </Tooltip>
              )}
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3, mt: 2 }}>
              <FormControl fullWidth variant="outlined">
                <InputLabel>Catalog</InputLabel>
                <Select
                  value={table.catalog}
                  label="Catalog"
                  onChange={(e) => {
                    const newCatalog = e.target.value
                    updateTable(table.id, {
                      catalog: newCatalog,
                      schema: '',
                      table: '',
                      columns: [],
                      schemas: [],
                      tables: [],
                      columnsList: []
                    })
                    fetchSchemas(table.id, newCatalog)
                  }}
                >
                  {catalogs.map((catalog) => (
                    <MenuItem key={catalog} value={catalog}>
                      {catalog}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth disabled={!table.catalog} variant="outlined">
                <InputLabel>Schema</InputLabel>
                <Select
                  value={table.schema}
                  label="Schema"
                  onChange={(e) => {
                    const newSchema = e.target.value
                    updateTable(table.id, {
                      schema: newSchema,
                      table: '',
                      columns: [],
                      tables: [],
                      columnsList: []
                    })
                    fetchTables(table.id, table.catalog, newSchema)
                  }}
                >
                  {table.schemas.map((schema) => (
                    <MenuItem key={schema} value={schema}>
                      {schema}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth disabled={!table.schema} variant="outlined">
                <InputLabel>Table</InputLabel>
                <Select
                  value={table.table}
                  label="Table"
                  onChange={(e) => {
                    const newTable = e.target.value
                    updateTable(table.id, {
                      table: newTable,
                      columns: [],
                      columnsList: []
                    })
                    fetchColumns(table.id, table.catalog, table.schema, newTable)
                  }}
                >
                  {table.tables.map((tbl) => (
                    <MenuItem key={tbl} value={tbl}>
                      {tbl}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth disabled={!table.table || table.columnsList.length === 0} variant="outlined">
                <InputLabel>Columns (Select Multiple)</InputLabel>
                <Select
                  multiple
                  value={table.columns}
                  onChange={(e) => updateTable(table.id, { columns: e.target.value as string[] })}
                  input={<OutlinedInput label="Columns (Select Multiple)" />}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {selected.map((value) => (
                        <Chip key={value} label={value} size="small" color="primary" variant="outlined" />
                      ))}
                    </Box>
                  )}
                >
                  {table.columnsList.map((column) => (
                    <MenuItem key={column.name} value={column.name}>
                      <Box>
                        <Typography variant="body2">{column.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {column.type}
                        </Typography>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          </Paper>
        </motion.div>
      ))}

      {/* Add Table Button */}
      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={addTable}
          sx={{ textTransform: 'none' }}
        >
          Add Another Table
        </Button>
      </Box>

      {/* Business Logic and Join Conditions */}
      <motion.div
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        transition={{ delay: 0.5 }}
      >
        <Paper
          elevation={2}
          sx={{
            p: 3,
            mb: 3,
            bgcolor: 'white',
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
            <GenerateIcon color="primary" />
            <Typography variant="h6" fontWeight="600" color="text.primary">
              {tables.length + 1}. Describe Your Query
            </Typography>
          </Box>

          <FormControl fullWidth variant="outlined" sx={{ mb: 3 }}>
            <InputLabel>AI Model</InputLabel>
            <Select
              value={selectedModel}
              label="AI Model"
              onChange={(e) => setSelectedModel(e.target.value)}
            >
              {models.map((model) => (
                <MenuItem key={model.id} value={model.id}>
                  <Box>
                    <Typography variant="body2" fontWeight="500">{model.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {model.description}
                    </Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Box sx={{ position: 'relative', mb: 3 }}>
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Join Conditions (Optional)"
              placeholder="Example: t1.user_id = t2.id AND t2.order_date = t3.date"
              value={joinConditions}
              onChange={(e) => setJoinConditions(e.target.value)}
              variant="outlined"
              helperText="Click the AI button to auto-generate join conditions, or leave blank to let SQL generation determine them"
              sx={{
                '& .MuiOutlinedInput-root': {
                  '& fieldset': {
                    borderColor: 'divider',
                  },
                  '&:hover fieldset': {
                    borderColor: 'primary.main',
                  },
                },
              }}
            />
            <Tooltip title="AI Suggestion: Generate join conditions based on table structures">
              <IconButton
                color="secondary"
                onClick={handleSuggestJoinConditions}
                disabled={loadingJoinSuggestion || tables.filter(t => t.catalog && t.schema && t.table && t.columns.length > 0).length < 2}
                sx={{
                  position: 'absolute',
                  right: 8,
                  top: 8,
                  bgcolor: 'background.paper',
                  boxShadow: 1,
                  '&:hover': {
                    bgcolor: 'secondary.light',
                    color: 'white',
                  },
                }}
              >
                {loadingJoinSuggestion ? <CircularProgress size={20} /> : <AiIcon />}
              </IconButton>
            </Tooltip>
          </Box>

          <Box sx={{ position: 'relative', mb: 3 }}>
            <TextField
              fullWidth
              multiline
              rows={4}
              label="Business Logic (in plain English)"
              placeholder="Example: Show me all users with their orders from the last month"
              value={businessLogic}
              onChange={(e) => setBusinessLogic(e.target.value)}
              variant="outlined"
              sx={{
                '& .MuiOutlinedInput-root': {
                  '& fieldset': {
                    borderColor: 'divider',
                  },
                  '&:hover fieldset': {
                    borderColor: 'primary.main',
                  },
                },
              }}
            />
            <Tooltip title="AI Assistant: Get suggestions for business logic">
              <IconButton
                color="primary"
                onClick={handleOpenAssistant}
                disabled={tables.every(t => !t.table || t.columns.length === 0)}
                sx={{
                  position: 'absolute',
                  right: 8,
                  top: 8,
                  bgcolor: 'background.paper',
                  boxShadow: 1,
                  '&:hover': {
                    bgcolor: 'primary.light',
                    color: 'white',
                  },
                }}
              >
                <LightbulbIcon />
              </IconButton>
            </Tooltip>
          </Box>

          <Button
            variant="contained"
            size="large"
            startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <GenerateIcon />}
            onClick={handleGenerateSQL}
            disabled={loading || !businessLogic}
            fullWidth
            sx={{
              py: 1.5,
              textTransform: 'none',
              fontSize: '1rem',
              fontWeight: 600,
            }}
          >
            {loading ? 'Generating SQL Query...' : 'Generate SQL Query'}
          </Button>
        </Paper>
      </motion.div>

      {/* Generated SQL */}
      <AnimatePresence>
        {generatedSQL && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Paper sx={{ p: 3, mb: 3, bgcolor: '#f5f5f5' }}>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CodeIcon fontSize="small" /> {tables.length + 2}. Generated SQL Query
              </Typography>

              {sqlExplanation && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {sqlExplanation}
                  </Typography>
                </Alert>
              )}

              <Box
                component="pre"
                sx={{
                  p: 2,
                  bgcolor: '#1e1e1e',
                  color: '#d4d4d4',
                  borderRadius: 1,
                  overflow: 'auto',
                  fontFamily: 'monospace',
                  fontSize: '0.875rem',
                }}
              >
                {generatedSQL}
              </Box>

              <Button
                variant="contained"
                color="success"
                size="large"
                startIcon={loading ? <CircularProgress size={20} /> : <RunIcon />}
                onClick={handleExecuteSQL}
                disabled={loading}
                fullWidth
                sx={{ mt: 2 }}
              >
                {loading ? 'Executing...' : 'Execute Query'}
              </Button>
            </Paper>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Query Results */}
      <AnimatePresence>
        {sqlResults && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
          >
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                {tables.length + 3}. Query Results ({sqlResults.row_count || 0} rows)
              </Typography>

              {sqlResults.columns && sqlResults.columns.length > 0 ? (
                <TableContainer sx={{ mt: 2, maxHeight: 440 }}>
                  <Table stickyHeader>
                    <TableHead>
                      <TableRow>
                        {sqlResults.columns.map((col: string) => (
                          <TableCell key={col} sx={{ fontWeight: 'bold', bgcolor: 'primary.main', color: 'white' }}>
                            {col}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {sqlResults.rows && sqlResults.rows.length > 0 ? (
                        sqlResults.rows.map((row: any, idx: number) => (
                          <TableRow key={idx} hover>
                            {sqlResults.columns.map((col: string) => (
                              <TableCell key={col}>{String(row[col] ?? '')}</TableCell>
                            ))}
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={sqlResults.columns.length} align="center">
                            No rows returned
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Typography color="text.secondary">No data to display</Typography>
              )}
            </Paper>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Business Logic Assistant Dialog */}
      <Dialog
        open={assistantDialogOpen}
        onClose={() => setAssistantDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <LightbulbIcon color="primary" />
            <Typography variant="h6">AI Business Logic Assistant</Typography>
          </Box>
          <IconButton onClick={() => setAssistantDialogOpen(false)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {loadingSuggestions ? (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
              <CircularProgress />
              <Typography sx={{ ml: 2 }}>Generating suggestions...</Typography>
            </Box>
          ) : suggestions.length > 0 ? (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Click on a suggestion to use it, or use it as inspiration to write your own:
              </Typography>
              <List>
                {suggestions.map((suggestion, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <ListItem disablePadding sx={{ mb: 1 }}>
                      <ListItemButton
                        onClick={() => handleSelectSuggestion(suggestion)}
                        sx={{
                          border: '1px solid',
                          borderColor: 'divider',
                          borderRadius: 1,
                          '&:hover': {
                            borderColor: 'primary.main',
                            bgcolor: 'primary.50',
                          },
                        }}
                      >
                        <ListItemText
                          primary={suggestion}
                          primaryTypographyProps={{ variant: 'body1' }}
                        />
                      </ListItemButton>
                    </ListItem>
                  </motion.div>
                ))}
              </List>
            </>
          ) : (
            <Typography color="text.secondary">
              No suggestions generated. Please try again.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssistantDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Container>
  )
}
