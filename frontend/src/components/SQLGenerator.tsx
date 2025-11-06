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

export default function SQLGenerator() {
  const [models, setModels] = useState<Model[]>([])
  const [catalogs, setCatalogs] = useState<string[]>([])
  const [schemas, setSchemas] = useState<string[]>([])
  const [tables, setTables] = useState<string[]>([])
  const [columns, setColumns] = useState<Column[]>([])

  const [selectedCatalog, setSelectedCatalog] = useState('')
  const [selectedSchema, setSelectedSchema] = useState('')
  const [selectedTable, setSelectedTable] = useState('')
  const [selectedColumns, setSelectedColumns] = useState<string[]>([])
  const [selectedModel, setSelectedModel] = useState('')
  const [businessLogic, setBusinessLogic] = useState('')

  const [generatedSQL, setGeneratedSQL] = useState('')
  const [sqlExplanation, setSqlExplanation] = useState('')
  const [sqlResults, setSqlResults] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Business logic assistant state
  const [assistantDialogOpen, setAssistantDialogOpen] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)

  // Warehouse status state
  const [warehouseStatus, setWarehouseStatus] = useState<any>(null)
  const [loadingWarehouseStatus, setLoadingWarehouseStatus] = useState(true)

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

  // Fetch schemas when catalog changes
  useEffect(() => {
    if (selectedCatalog) {
      setSchemas([])
      setTables([])
      setColumns([])
      setSelectedSchema('')
      setSelectedTable('')
      setSelectedColumns([])

      fetch(`/api/catalogs/${selectedCatalog}/schemas`)
        .then(res => res.json())
        .then(data => {
          if (data && data.schemas && Array.isArray(data.schemas)) {
            setSchemas(data.schemas)
          } else {
            setSchemas([])
          }
        })
        .catch(() => {
          setSchemas([])
          setError('Failed to load schemas')
        })
    }
  }, [selectedCatalog])

  // Fetch tables when schema changes
  useEffect(() => {
    if (selectedCatalog && selectedSchema) {
      setTables([])
      setColumns([])
      setSelectedTable('')
      setSelectedColumns([])

      fetch(`/api/catalogs/${selectedCatalog}/schemas/${selectedSchema}/tables`)
        .then(res => res.json())
        .then(data => {
          if (data && data.tables && Array.isArray(data.tables)) {
            setTables(data.tables)
          } else {
            setTables([])
          }
        })
        .catch(() => {
          setTables([])
          setError('Failed to load tables')
        })
    }
  }, [selectedCatalog, selectedSchema])

  // Fetch columns when table changes
  useEffect(() => {
    if (selectedCatalog && selectedSchema && selectedTable) {
      setColumns([])
      setSelectedColumns([])

      fetch(`/api/catalogs/${selectedCatalog}/schemas/${selectedSchema}/tables/${selectedTable}/columns`)
        .then(res => res.json())
        .then(data => {
          if (data && data.columns && Array.isArray(data.columns)) {
            setColumns(data.columns)
          } else {
            setColumns([])
          }
        })
        .catch(() => {
          setColumns([])
          setError('Failed to load columns')
        })
    }
  }, [selectedCatalog, selectedSchema, selectedTable])

  const handleReset = () => {
    setSelectedCatalog('')
    setSelectedSchema('')
    setSelectedTable('')
    setSelectedColumns([])
    setBusinessLogic('')
    setGeneratedSQL('')
    setSqlExplanation('')
    setSqlResults(null)
    setError(null)
    setSchemas([])
    setTables([])
    setColumns([])
  }

  const handleOpenAssistant = async () => {
    if (!selectedCatalog || !selectedSchema || !selectedTable || selectedColumns.length === 0) {
      setError('Please select catalog, schema, table, and columns first')
      return
    }

    setAssistantDialogOpen(true)
    setLoadingSuggestions(true)
    setSuggestions([])

    try {
      const response = await fetch('/api/suggest-business-logic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          catalog: selectedCatalog,
          schema_name: selectedSchema,
          table: selectedTable,
          columns: selectedColumns,
          model_id: selectedModel,
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

  const handleGenerateSQL = async () => {
    if (!selectedCatalog || !selectedSchema || !selectedTable || selectedColumns.length === 0 || !businessLogic) {
      setError('Please fill in all required fields')
      return
    }

    setLoading(true)
    setError(null)
    setGeneratedSQL('')
    setSqlExplanation('')
    setSqlResults(null)

    try {
      const response = await fetch('/api/generate-sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tables: [
            {
              catalog: selectedCatalog,
              schema_name: selectedSchema,
              table: selectedTable,
              columns: selectedColumns,
            },
          ],
          business_logic: businessLogic,
          model_id: selectedModel,
        }),
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

    console.log('🚀 Executing SQL:', generatedSQL)
    setLoading(true)
    setError(null)
    setSqlResults(null)

    try {
      const response = await fetch('/api/execute-sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql_query: generatedSQL }),
      })

      console.log('📡 Response status:', response.status)
      const data = await response.json()
      console.log('📊 Response data:', data)

      if (response.ok) {
        console.log('✅ Setting SQL results:', data)
        setSqlResults(data)
      } else {
        console.error('❌ Error response:', data)
        setError(data.detail || 'Failed to execute SQL')
      }
    } catch (err) {
      console.error('❌ Fetch error:', err)
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
          <Typography
            variant="h4"
            sx={{
              fontWeight: 700,
              color: 'text.primary',
              mb: 1,
            }}
          >
            SQL Query Generator
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Transform natural language into powerful SQL queries with AI
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

      <motion.div
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        transition={{ delay: 0.2 }}
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
            <DatabaseIcon color="primary" />
            <Typography variant="h6" fontWeight="600" color="text.primary">
              1. Select Data Source
            </Typography>
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3, mt: 2 }}>
            <FormControl fullWidth variant="outlined">
              <InputLabel>Catalog</InputLabel>
              <Select
                value={selectedCatalog}
                label="Catalog"
                onChange={(e) => setSelectedCatalog(e.target.value)}
                sx={{
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'divider',
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'primary.main',
                  },
                }}
              >
                {catalogs.map((catalog) => (
                  <MenuItem key={catalog} value={catalog}>
                    {catalog}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth disabled={!selectedCatalog} variant="outlined">
              <InputLabel>Schema</InputLabel>
              <Select
                value={selectedSchema}
                label="Schema"
                onChange={(e) => setSelectedSchema(e.target.value)}
                sx={{
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'divider',
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'primary.main',
                  },
                }}
              >
                {schemas.map((schema) => (
                  <MenuItem key={schema} value={schema}>
                    {schema}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth disabled={!selectedSchema} variant="outlined">
              <InputLabel>Table</InputLabel>
              <Select
                value={selectedTable}
                label="Table"
                onChange={(e) => setSelectedTable(e.target.value)}
                sx={{
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'divider',
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'primary.main',
                  },
                }}
              >
                {tables.map((table) => (
                  <MenuItem key={table} value={table}>
                    {table}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth disabled={!selectedTable || columns.length === 0} variant="outlined">
              <InputLabel>Columns (Select Multiple)</InputLabel>
              <Select
                multiple
                value={selectedColumns}
                onChange={(e) => setSelectedColumns(e.target.value as string[])}
                input={<OutlinedInput label="Columns (Select Multiple)" />}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((value) => (
                      <Chip key={value} label={value} size="small" color="primary" variant="outlined" />
                    ))}
                  </Box>
                )}
                sx={{
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'divider',
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'primary.main',
                  },
                }}
              >
                {columns.map((column) => (
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

      <motion.div
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        transition={{ delay: 0.4 }}
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
              2. Describe Your Query
            </Typography>
          </Box>

          <FormControl fullWidth variant="outlined" sx={{ mb: 3 }}>
            <InputLabel>AI Model</InputLabel>
            <Select
              value={selectedModel}
              label="AI Model"
              onChange={(e) => setSelectedModel(e.target.value)}
              sx={{
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'divider',
                },
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'primary.main',
                },
              }}
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
              rows={4}
              label="Business Logic (in plain English)"
              placeholder="Example: Show me the top 10 customers by total purchases in the last month"
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
                disabled={!selectedTable || selectedColumns.length === 0}
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
            disabled={loading || !selectedTable || selectedColumns.length === 0 || !businessLogic}
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
                <CodeIcon fontSize="small" /> 3. Generated SQL Query
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

      {/* Debug: Show SQL Results State - Collapsible */}
      {sqlResults && (
        <Accordion sx={{ mb: 2 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
              Debug Output
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={{ p: 2, bgcolor: '#e3f2fd', border: '1px solid #2196f3', borderRadius: 1 }}>
              <Typography variant="caption" sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                {JSON.stringify(sqlResults, null, 2)}
              </Typography>
            </Box>
          </AccordionDetails>
        </Accordion>
      )}

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
                4. Query Results ({sqlResults.row_count || 0} rows)
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
