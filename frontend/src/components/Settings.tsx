import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Paper,
  Typography,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  CircularProgress,
  Alert,
  Chip,
  Divider,
} from '@mui/material'
import {
  Settings as SettingsIcon,
  Save as SaveIcon,
  Storage as StorageIcon,
  Check as CheckIcon,
  TableChart as TableChartIcon,
} from '@mui/icons-material'

interface SettingsData {
  storage_catalog: string
  storage_schema: string
  table_exists: boolean
}

export default function Settings() {
  const [catalogs, setCatalogs] = useState<string[]>([])
  const [schemas, setSchemas] = useState<string[]>([])
  const [selectedCatalog, setSelectedCatalog] = useState('')
  const [selectedSchema, setSelectedSchema] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [creatingTable, setCreatingTable] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [currentSettings, setCurrentSettings] = useState<SettingsData | null>(null)
  const [tableExists, setTableExists] = useState(false)

  // Fetch catalogs on mount
  useEffect(() => {
    fetchCatalogs()
    fetchCurrentSettings()
  }, [])

  // Fetch schemas when catalog changes
  useEffect(() => {
    if (selectedCatalog) {
      fetchSchemas(selectedCatalog)
    } else {
      setSchemas([])
      setSelectedSchema('')
    }
  }, [selectedCatalog])

  // Check table existence when schema changes
  useEffect(() => {
    if (selectedCatalog && selectedSchema) {
      checkTableExists()
    } else {
      setTableExists(false)
    }
  }, [selectedCatalog, selectedSchema])

  const fetchCatalogs = async () => {
    try {
      const response = await fetch('/api/catalogs')
      const data = await response.json()
      if (response.ok) {
        setCatalogs(data.catalogs || [])
      }
    } catch (err) {
      console.error('Failed to fetch catalogs:', err)
    }
  }

  const fetchSchemas = async (catalog: string) => {
    try {
      const response = await fetch(`/api/schemas?catalog=${catalog}`)
      const data = await response.json()
      if (response.ok) {
        setSchemas(data.schemas || [])
      }
    } catch (err) {
      console.error('Failed to fetch schemas:', err)
    }
  }

  const fetchCurrentSettings = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/settings/storage')
      const data = await response.json()
      if (response.ok) {
        setCurrentSettings(data)
        setSelectedCatalog(data.storage_catalog || '')
        setSelectedSchema(data.storage_schema || '')
        setTableExists(data.table_exists || false)
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err)
    } finally {
      setLoading(false)
    }
  }

  const checkTableExists = async () => {
    try {
      const response = await fetch(
        `/api/settings/check-table?catalog=${selectedCatalog}&schema=${selectedSchema}`
      )
      const data = await response.json()
      if (response.ok) {
        setTableExists(data.exists)
      }
    } catch (err) {
      console.error('Failed to check table:', err)
    }
  }

  const handleSaveSettings = async () => {
    if (!selectedCatalog || !selectedSchema) {
      setError('Please select both catalog and schema')
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/settings/storage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storage_catalog: selectedCatalog,
          storage_schema: selectedSchema,
        }),
      })

      const data = await response.json()
      if (response.ok) {
        setSuccess('Settings saved successfully!')
        setCurrentSettings({
          storage_catalog: selectedCatalog,
          storage_schema: selectedSchema,
          table_exists: tableExists,
        })
      } else {
        setError(data.detail || 'Failed to save settings')
      }
    } catch (err) {
      setError('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const handleCreateTable = async () => {
    if (!selectedCatalog || !selectedSchema) {
      setError('Please select both catalog and schema first')
      return
    }

    setCreatingTable(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/settings/create-table', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          catalog: selectedCatalog,
          schema: selectedSchema,
        }),
      })

      const data = await response.json()
      if (response.ok) {
        setSuccess('Table created successfully!')
        setTableExists(true)
      } else {
        setError(data.detail || 'Failed to create table')
      }
    } catch (err) {
      setError('Failed to create table')
    } finally {
      setCreatingTable(false)
    }
  }

  const hasChanges =
    currentSettings &&
    (selectedCatalog !== currentSettings.storage_catalog ||
      selectedSchema !== currentSettings.storage_schema)

  return (
    <Box sx={{ mt: 1, mb: 4, overflow: 'hidden', width: '100%', maxWidth: '100%', minWidth: 0 }}>
      <Box sx={{ mb: 4 }}>
        <Typography
          variant="h4"
          sx={{
            fontWeight: 700,
            color: 'text.primary',
            mb: 1,
          }}
        >
          Settings
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Configure storage location for saved requirements
        </Typography>
      </Box>

      {error && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        </motion.div>
      )}

      {success && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
            {success}
          </Alert>
        </motion.div>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Paper
          elevation={2}
          sx={{
            p: 3,
            bgcolor: 'white',
            border: '1px solid',
            borderColor: 'divider',
            maxWidth: 600,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
            <StorageIcon color="primary" />
            <Typography variant="h6" fontWeight="600">
              Storage Configuration
            </Typography>
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Select the Databricks catalog and schema where saved requirements will be stored.
            A Delta table named <code>saved_requirements</code> will be created in the selected location.
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <FormControl fullWidth variant="outlined">
              <InputLabel>Catalog</InputLabel>
              <Select
                value={selectedCatalog}
                label="Catalog"
                onChange={(e) => {
                  setSelectedCatalog(e.target.value)
                  setSelectedSchema('')
                }}
              >
                {catalogs.map((catalog) => (
                  <MenuItem key={catalog} value={catalog}>
                    {catalog}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth variant="outlined" disabled={!selectedCatalog}>
              <InputLabel>Schema</InputLabel>
              <Select
                value={selectedSchema}
                label="Schema"
                onChange={(e) => setSelectedSchema(e.target.value)}
              >
                {schemas.map((schema) => (
                  <MenuItem key={schema} value={schema}>
                    {schema}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {selectedCatalog && selectedSchema && (
              <Box
                sx={{
                  p: 2,
                  bgcolor: tableExists ? 'success.50' : 'warning.50',
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: tableExists ? 'success.200' : 'warning.200',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <TableChartIcon
                    fontSize="small"
                    color={tableExists ? 'success' : 'warning'}
                  />
                  <Typography variant="subtitle2" fontWeight="600">
                    Table Status
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  {`${selectedCatalog}.${selectedSchema}.saved_requirements`}
                </Typography>
                {tableExists ? (
                  <Chip
                    icon={<CheckIcon />}
                    label="Table exists"
                    color="success"
                    size="small"
                    variant="outlined"
                  />
                ) : (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Chip
                      label="Table does not exist"
                      color="warning"
                      size="small"
                      variant="outlined"
                    />
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={creatingTable ? <CircularProgress size={16} /> : <TableChartIcon />}
                      onClick={handleCreateTable}
                      disabled={creatingTable}
                    >
                      {creatingTable ? 'Creating...' : 'Create Table'}
                    </Button>
                  </Box>
                )}
              </Box>
            )}

            <Divider />

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
              <Button
                variant="contained"
                color="primary"
                startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
                onClick={handleSaveSettings}
                disabled={saving || !selectedCatalog || !selectedSchema}
              >
                {saving ? 'Saving...' : 'Save Settings'}
              </Button>
            </Box>

            {currentSettings && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  Current configuration:{' '}
                  <strong>
                    {currentSettings.storage_catalog}.{currentSettings.storage_schema}
                  </strong>
                </Typography>
              </Box>
            )}
          </Box>
        </Paper>
      )}
    </Box>
  )
}
