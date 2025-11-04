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
  IconButton,
  Tooltip,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Card,
  CardContent,
} from '@mui/material'
import {
  PlayArrow as RunIcon,
  AutoAwesome as GenerateIcon,
  Storage as DatabaseIcon,
  Code as CodeIcon,
  Lightbulb as LightbulbIcon,
  Close as CloseIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
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
  availableSchemas: string[]
  availableTables: string[]
  availableColumns: Column[]
}

export default function SQLGeneratorMultiTable() {
  const [models, setModels] = useState<Model[]>([])
  const [catalogs, setCatalogs] = useState<string[]>([])
  const [selectedModel, setSelectedModel] = useState('')
  const [businessLogic, setBusinessLogic] = useState('')

  // Multiple table selections
  const [tableSelections, setTableSelections] = useState<TableSelection[]>([
    {
      id: '1',
      catalog: '',
      schema: '',
      table: '',
      columns: [],
      availableSchemas: [],
      availableTables: [],
      availableColumns: []
    }
  ])

  const [generatedSQL, setGeneratedSQL] = useState('')
  const [sqlResults, setSqlResults] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Business logic assistant state
  const [assistantDialogOpen, setAssistantDialogOpen] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)

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

  // Fetch catalogs
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

  // Helper function to add a new table selection
  const addTableSelection = () => {
    const newId = (Math.max(...tableSelections.map(t => parseInt(t.id)), 0) + 1).toString()
    setTableSelections([...tableSelections, {
      id: newId,
      catalog: '',
      schema: '',
      table: '',
      columns: [],
      availableSchemas: [],
      availableTables: [],
      availableColumns: []
    }])
  }

  // Helper function to remove a table selection
  const removeTableSelection = (id: string) => {
    if (tableSelections.length > 1) {
      setTableSelections(tableSelections.filter(t => t.id !== id))
    }
  }

  // Handle catalog change
  const handleCatalogChange = async (id: string, catalog: string) => {
    const updated = tableSelections.map(t => {
      if (t.id === id) {
        return { ...t, catalog, schema: '', table: '', columns: [], availableSchemas: [], availableTables: [], availableColumns: [] }
      }
      return t
    })
    setTableSelections(updated)

    // Fetch schemas
    if (catalog) {
      try {
        const res = await fetch(`/api/catalogs/${catalog}/schemas`)
        const data = await res.json()
        if (data && data.schemas && Array.isArray(data.schemas)) {
          setTableSelections(prev => prev.map(t =>
            t.id === id ? { ...t, availableSchemas: data.schemas } : t
          ))
        }
      } catch (err) {
        setError('Failed to load schemas')
      }
    }
  }

  // Handle schema change
  const handleSchemaChange = async (id: string, schema: string) => {
    const selection = tableSelections.find(t => t.id === id)
    if (!selection) return

    const updated = tableSelections.map(t => {
      if (t.id === id) {
        return { ...t, schema, table: '', columns: [], availableTables: [], availableColumns: [] }
      }
      return t
    })
    setTableSelections(updated)

    // Fetch tables
    if (selection.catalog && schema) {
      try {
        const res = await fetch(`/api/catalogs/${selection.catalog}/schemas/${schema}/tables`)
        const data = await res.json()
        if (data && data.tables && Array.isArray(data.tables)) {
          setTableSelections(prev => prev.map(t =>
            t.id === id ? { ...t, availableTables: data.tables } : t
          ))
        }
      } catch (err) {
        setError('Failed to load tables')
      }
    }
  }

  // Handle table change
  const handleTableChange = async (id: string, table: string) => {
    const selection = tableSelections.find(t => t.id === id)
    if (!selection) return

    const updated = tableSelections.map(t => {
      if (t.id === id) {
        return { ...t, table, columns: [], availableColumns: [] }
      }
      return t
    })
    setTableSelections(updated)

    // Fetch columns
    if (selection.catalog && selection.schema && table) {
      try {
        const res = await fetch(`/api/catalogs/${selection.catalog}/schemas/${selection.schema}/tables/${table}/columns`)
        const data = await res.json()
        if (data && data.columns && Array.isArray(data.columns)) {
          setTableSelections(prev => prev.map(t =>
            t.id === id ? { ...t, availableColumns: data.columns } : t
          ))
        }
      } catch (err) {
        setError('Failed to load columns')
      }
    }
  }

  // Handle column selection change
  const handleColumnsChange = (id: string, columns: string[]) => {
    setTableSelections(prev => prev.map(t =>
      t.id === id ? { ...t, columns } : t
    ))
  }

  const handleOpenAssistant = async () => {
    const hasData = tableSelections.some(t => t.table && t.columns.length > 0)
    if (!hasData) {
      setError('Please select at least one table with columns first')
      return
    }
    setAssistantDialogOpen(true)
    setLoadingSuggestions(true)
    setError(null)

    try {
      const firstSelection = tableSelections.find(t => t.table && t.columns.length > 0)!
      const response = await fetch('/api/suggest-business-logic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          catalog: firstSelection.catalog,
          schema: firstSelection.schema,
          table: firstSelection.table,
          columns: firstSelection.columns,
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
    const hasData = tableSelections.some(t => t.table && t.columns.length > 0)
    if (!hasData || !businessLogic) {
      setError('Please select at least one table with columns and provide business logic')
      return
    }

    setLoading(true)
    setError(null)
    setGeneratedSQL('')
    setSqlResults(null)

    try {
      // Format tables for API
      const tables = tableSelections
        .filter(t => t.table && t.columns.length > 0)
        .map(t => ({
          catalog: t.catalog,
          schema: t.schema,
          table: t.table,
          columns: t.columns
        }))

      const response = await fetch('/api/generate-sql-multi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tables,
          business_logic: businessLogic,
          model_id: selectedModel,
        }),
      })

      const data = await response.json()
      if (response.ok) {
        setGeneratedSQL(data.sql_query)
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
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Box
          sx={{
            mb: 4,
            textAlign: 'center',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: 3,
            py: 3,
            px: 2,
            boxShadow: '0 10px 30px rgba(102, 126, 234, 0.4)',
          }}
        >
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <Typography
              variant="h3"
              sx={{
                fontWeight: 'bold',
                color: 'white',
                textShadow: '2px 2px 4px rgba(0,0,0,0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
              }}
            >
              <motion.span
                animate={{ rotate: [0, 360] }}
                transition={{
                  repeat: Infinity,
                  duration: 3,
                  ease: "linear"
                }}
                style={{ display: 'inline-block' }}
              >
                ✨
              </motion.span>
              Multi-Table SQL Generator
              <motion.span
                animate={{ rotate: [0, -360] }}
                transition={{
                  repeat: Infinity,
                  duration: 3,
                  ease: "linear"
                }}
                style={{ display: 'inline-block' }}
              >
                ✨
              </motion.span>
            </Typography>
            <Typography variant="subtitle1" sx={{ color: 'rgba(255,255,255,0.95)', mt: 1, fontWeight: 500 }}>
              Build complex queries across multiple tables with AI-powered generation
            </Typography>
          </motion.div>
        </Box>
      </motion.div>

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
          sx={{
            p: 3,
            mb: 3,
            background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            boxShadow: '0 8px 25px rgba(240, 147, 251, 0.3)',
          }}
        >
          <Typography
            variant="h6"
            gutterBottom
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: 'white',
              fontWeight: 'bold',
              mb: 3,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
              >
                <DatabaseIcon fontSize="small" />
              </motion.div>
              1. Select Data Sources
            </Box>
            <Tooltip title="Add Another Table">
              <IconButton
                onClick={addTableSelection}
                sx={{ color: 'white', bgcolor: 'rgba(255,255,255,0.2)' }}
              >
                <AddIcon />
              </IconButton>
            </Tooltip>
          </Typography>

          {tableSelections.map((selection, index) => (
            <Card
              key={selection.id}
              sx={{
                mb: 2,
                bgcolor: 'white',
                boxShadow: 3,
              }}
            >
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="subtitle1" fontWeight="bold" color="primary">
                    Table #{index + 1}
                  </Typography>
                  {tableSelections.length > 1 && (
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => removeTableSelection(selection.id)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  )}
                </Box>

                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                  <FormControl fullWidth>
                    <InputLabel>Catalog</InputLabel>
                    <Select
                      value={selection.catalog}
                      label="Catalog"
                      onChange={(e) => handleCatalogChange(selection.id, e.target.value)}
                    >
                      {catalogs.map((catalog) => (
                        <MenuItem key={catalog} value={catalog}>
                          {catalog}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <FormControl fullWidth disabled={!selection.catalog}>
                    <InputLabel>Schema</InputLabel>
                    <Select
                      value={selection.schema}
                      label="Schema"
                      onChange={(e) => handleSchemaChange(selection.id, e.target.value)}
                    >
                      {selection.availableSchemas.map((schema) => (
                        <MenuItem key={schema} value={schema}>
                          {schema}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <FormControl fullWidth disabled={!selection.schema}>
                    <InputLabel>Table</InputLabel>
                    <Select
                      value={selection.table}
                      label="Table"
                      onChange={(e) => handleTableChange(selection.id, e.target.value)}
                    >
                      {selection.availableTables.map((table) => (
                        <MenuItem key={table} value={table}>
                          {table}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <FormControl fullWidth disabled={!selection.table || selection.availableColumns.length === 0}>
                    <InputLabel>Columns (Multiple Selection)</InputLabel>
                    <Select
                      multiple
                      value={selection.columns}
                      onChange={(e) => handleColumnsChange(selection.id, e.target.value as string[])}
                      input={<OutlinedInput label="Columns (Multiple Selection)" />}
                      renderValue={(selected) => (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {selected.map((value) => (
                            <Chip key={value} label={value} size="small" color="primary" />
                          ))}
                        </Box>
                      )}
                    >
                      {selection.availableColumns.map((column) => (
                        <MenuItem key={column.name} value={column.name}>
                          {column.name} ({column.type})
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Paper>
      </motion.div>

      <motion.div
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        transition={{ delay: 0.4 }}
        whileHover={{ scale: 1.01 }}
      >
        <Paper
          sx={{
            p: 3,
            mb: 3,
            background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
            boxShadow: '0 8px 25px rgba(79, 172, 254, 0.3)',
          }}
        >
          <Typography
            variant="h6"
            gutterBottom
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              color: 'white',
              fontWeight: 'bold',
            }}
          >
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ repeat: Infinity, duration: 2, delay: 0.5 }}
            >
              <GenerateIcon fontSize="small" />
            </motion.div>
            2. Describe Your Query
          </Typography>

          <FormControl fullWidth sx={{ mt: 2, mb: 2, bgcolor: 'white', borderRadius: 1 }}>
            <InputLabel>AI Model</InputLabel>
            <Select
              value={selectedModel}
              label="AI Model"
              onChange={(e) => setSelectedModel(e.target.value)}
            >
              {models.map((model) => (
                <MenuItem key={model.id} value={model.id}>
                  <Box>
                    <Typography variant="body2">{model.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {model.description}
                    </Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Box sx={{ position: 'relative' }}>
            <TextField
              fullWidth
              multiline
              rows={4}
              label="Business Logic (in plain English)"
              placeholder="Example: Show me the top 10 customers by total purchases in the last month"
              value={businessLogic}
              onChange={(e) => setBusinessLogic(e.target.value)}
              sx={{ mb: 2, bgcolor: 'white', borderRadius: 1 }}
            />
            <Tooltip title="AI Assistant: Get suggestions for business logic">
              <IconButton
                color="primary"
                onClick={handleOpenAssistant}
                disabled={!tableSelections.some(t => t.table && t.columns.length > 0)}
                sx={{
                  position: 'absolute',
                  right: 8,
                  top: 8,
                  bgcolor: 'rgba(255,255,255,0.9)',
                  '&:hover': { bgcolor: 'white' },
                }}
              >
                <LightbulbIcon />
              </IconButton>
            </Tooltip>
          </Box>

          <Button
            variant="contained"
            size="large"
            startIcon={loading ? <CircularProgress size={20} /> : <GenerateIcon />}
            onClick={handleGenerateSQL}
            disabled={loading || !tableSelections.some(t => t.table && t.columns.length > 0) || !businessLogic}
            fullWidth
            sx={{ bgcolor: 'white', color: '#4facfe', '&:hover': { bgcolor: '#f0f0f0' } }}
          >
            {loading ? 'Generating...' : 'Generate SQL'}
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
            <Paper sx={{ p: 3, mb: 3, bgcolor: '#1e1e1e', color: '#d4d4d4' }}>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#4facfe' }}>
                <CodeIcon fontSize="small" /> 3. Generated SQL Query
              </Typography>

              <Box
                component="pre"
                sx={{
                  p: 2,
                  bgcolor: '#2d2d2d',
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

      <AnimatePresence>
        {sqlResults && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
          >
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom sx={{ color: '#4facfe' }}>
                4. Query Results ({sqlResults.row_count} rows)
              </Typography>

              <TableContainer sx={{ mt: 2, maxHeight: 440 }}>
                <Table stickyHeader>
                  <TableHead>
                    <TableRow>
                      {sqlResults.columns.map((col: string) => (
                        <TableCell key={col} sx={{ fontWeight: 'bold', bgcolor: '#4facfe', color: 'white' }}>
                          {col}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {sqlResults.rows.map((row: any, idx: number) => (
                      <TableRow key={idx} hover>
                        {sqlResults.columns.map((col: string) => (
                          <TableCell key={col}>{String(row[col] ?? '')}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
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
                          borderColor: 'primary.main',
                          borderRadius: 1,
                          '&:hover': {
                            bgcolor: 'primary.light',
                            color: 'white',
                          },
                        }}
                      >
                        <ListItemText primary={suggestion} />
                      </ListItemButton>
                    </ListItem>
                  </motion.div>
                ))}
              </List>
            </>
          ) : (
            <Typography color="text.secondary">No suggestions available</Typography>
          )}
        </DialogContent>
      </Dialog>
    </Container>
  )
}
