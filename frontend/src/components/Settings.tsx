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
  Save as SaveIcon,
  Storage as StorageIcon,
  Check as CheckIcon,
  TableChart as TableChartIcon,
  Security as SecurityIcon,
  ContentCopy as CopyIcon,
  PlayArrow as ApplyIcon,
} from '@mui/icons-material'

interface SettingsData {
  storage_catalog: string
  storage_schema: string
  table_exists: boolean
  service_principal?: string
}

interface PermissionStatus {
  has_select: boolean
  has_insert: boolean
  has_delete: boolean
  has_all_permissions: boolean
  service_principal: string
  error?: string
}

export default function Settings() {
  const [catalogs, setCatalogs] = useState<string[]>([])
  const [schemas, setSchemas] = useState<string[]>([])
  const [selectedCatalog, setSelectedCatalog] = useState('')
  const [selectedSchema, setSelectedSchema] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [creatingTable, setCreatingTable] = useState(false)
  const [grantingPermissions, setGrantingPermissions] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [currentSettings, setCurrentSettings] = useState<SettingsData | null>(null)
  const [tableExists, setTableExists] = useState(false)
  const [permissions, setPermissions] = useState<PermissionStatus | null>(null)
  const [checkingPermissions, setCheckingPermissions] = useState(false)

  // Fetch catalogs on mount
  useEffect(() => {
    fetchCatalogs()
    fetchCurrentSettings()
  }, [])

  // Fetch schemas when catalog changes
  // Note: fetchCurrentSettings handles initial load, this handles user changes
  useEffect(() => {
    if (!selectedCatalog) {
      setSchemas([])
      setSelectedSchema('')
    }
    // Don't auto-fetch here during initial load - fetchCurrentSettings handles it
    // The fetchSchemas is called manually from the onChange handler
  }, [selectedCatalog])

  // Check table existence when schema changes
  useEffect(() => {
    if (selectedCatalog && selectedSchema) {
      checkTableExists()
    } else {
      setTableExists(false)
      setPermissions(null)
    }
  }, [selectedCatalog, selectedSchema])

  // Check permissions when table exists
  useEffect(() => {
    if (tableExists && selectedCatalog && selectedSchema) {
      checkPermissions()
    } else {
      setPermissions(null)
    }
  }, [tableExists, selectedCatalog, selectedSchema])

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
      const response = await fetch(`/api/catalogs/${catalog}/schemas`)
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
        const catalog = data.storage_catalog || ''
        const schema = data.storage_schema || ''
        setSelectedCatalog(catalog)
        setTableExists(data.table_exists || false)

        // Fetch schemas for the catalog, then set the schema
        // This prevents the MUI "out-of-range" warning
        if (catalog) {
          try {
            const schemaResponse = await fetch(`/api/catalogs/${catalog}/schemas`)
            const schemaData = await schemaResponse.json()
            if (schemaResponse.ok) {
              setSchemas(schemaData.schemas || [])
              // Only set selected schema after schemas are loaded
              if (schemaData.schemas?.includes(schema)) {
                setSelectedSchema(schema)
              }
            }
          } catch {
            console.error('Failed to fetch schemas')
          }
        }
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

  const checkPermissions = async () => {
    setCheckingPermissions(true)
    try {
      const response = await fetch(
        `/api/settings/check-permissions?catalog=${selectedCatalog}&schema=${selectedSchema}`
      )
      const data = await response.json()
      if (response.ok) {
        setPermissions(data)
      }
    } catch (err) {
      console.error('Failed to check permissions:', err)
    } finally {
      setCheckingPermissions(false)
    }
  }

  const handleGrantPermissions = async () => {
    setGrantingPermissions(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/settings/grant-permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          catalog: selectedCatalog,
          schema_name: selectedSchema,
        }),
      })

      const data = await response.json()
      if (response.ok) {
        setSuccess('Permissions granted successfully!')
        // Refresh permissions status
        checkPermissions()
      } else {
        setError(data.detail || 'Failed to grant permissions')
      }
    } catch (err) {
      // Network-level error (no response from server)
      if (err instanceof TypeError && err.message.includes('fetch')) {
        setError('Unable to connect to the server. Please check your network connection.')
      } else {
        setError('Failed to grant permissions. Please try again.')
      }
    } finally {
      setGrantingPermissions(false)
    }
  }

  const copyGrantSQL = () => {
    const sql = `-- Grant permissions to the service principal on the saved_requirements table
-- For Unity Catalog Delta tables, use SELECT and MODIFY (MODIFY covers INSERT/UPDATE/DELETE)
GRANT SELECT, MODIFY ON TABLE ${selectedCatalog}.${selectedSchema}.saved_requirements TO \`${permissions?.service_principal || 'your-service-principal'}\`;

-- Or grant all privileges
GRANT ALL PRIVILEGES ON TABLE ${selectedCatalog}.${selectedSchema}.saved_requirements TO \`${permissions?.service_principal || 'your-service-principal'}\`;`

    navigator.clipboard.writeText(sql)
    setSuccess('SQL copied to clipboard!')
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
      // Network-level error (no response from server)
      if (err instanceof TypeError && err.message.includes('fetch')) {
        setError('Unable to connect to the server. Please check your network connection.')
      } else {
        setError('Failed to save settings. Please try again.')
      }
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
          schema_name: selectedSchema,
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
      // Network-level error (no response from server)
      if (err instanceof TypeError && err.message.includes('fetch')) {
        setError('Unable to connect to the server. Please check your network connection.')
      } else {
        setError('Failed to create table. Please try again.')
      }
    } finally {
      setCreatingTable(false)
    }
  }

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
          <Alert severity="error" sx={{ mb: 2, whiteSpace: 'pre-wrap' }} onClose={() => setError(null)}>
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
        <>
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
                  const newCatalog = e.target.value
                  setSelectedCatalog(newCatalog)
                  setSelectedSchema('')
                  setSchemas([])
                  if (newCatalog) {
                    fetchSchemas(newCatalog)
                  }
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

            {/* Permissions Status - only show when table exists */}
            {tableExists && selectedCatalog && selectedSchema && (
              <Box
                sx={{
                  p: 2,
                  bgcolor: permissions?.has_all_permissions ? 'success.50' : 'warning.50',
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: permissions?.has_all_permissions ? 'success.200' : 'warning.200',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <SecurityIcon
                    fontSize="small"
                    color={permissions?.has_all_permissions ? 'success' : 'warning'}
                  />
                  <Typography variant="subtitle2" fontWeight="600">
                    Service Principal Permissions
                  </Typography>
                  {checkingPermissions && <CircularProgress size={14} />}
                </Box>

                {permissions && (
                  <>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      Service Principal: <code>{permissions.service_principal}</code>
                    </Typography>

                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                      <Chip
                        icon={permissions.has_select ? <CheckIcon /> : undefined}
                        label="SELECT"
                        color={permissions.has_select ? 'success' : 'default'}
                        size="small"
                        variant={permissions.has_select ? 'filled' : 'outlined'}
                      />
                      <Chip
                        icon={permissions.has_insert ? <CheckIcon /> : undefined}
                        label="INSERT"
                        color={permissions.has_insert ? 'success' : 'default'}
                        size="small"
                        variant={permissions.has_insert ? 'filled' : 'outlined'}
                      />
                      <Chip
                        icon={permissions.has_delete ? <CheckIcon /> : undefined}
                        label="DELETE"
                        color={permissions.has_delete ? 'success' : 'default'}
                        size="small"
                        variant={permissions.has_delete ? 'filled' : 'outlined'}
                      />
                    </Box>

                    {permissions.has_all_permissions ? (
                      <Chip
                        icon={<CheckIcon />}
                        label="All required permissions granted"
                        color="success"
                        size="small"
                        variant="outlined"
                      />
                    ) : (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <Typography variant="caption" color="error">
                          Missing permissions detected. Grant them using one of the options below:
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                          <Button
                            variant="contained"
                            size="small"
                            color="primary"
                            startIcon={grantingPermissions ? <CircularProgress size={16} /> : <ApplyIcon />}
                            onClick={handleGrantPermissions}
                            disabled={grantingPermissions}
                          >
                            {grantingPermissions ? 'Granting...' : 'Auto Grant'}
                          </Button>
                          <Button
                            variant="outlined"
                            size="small"
                            startIcon={<CopyIcon />}
                            onClick={copyGrantSQL}
                          >
                            Copy SQL
                          </Button>
                        </Box>
                      </Box>
                    )}
                  </>
                )}

                {!permissions && !checkingPermissions && (
                  <Typography variant="body2" color="text.secondary">
                    Unable to check permissions
                  </Typography>
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

        {/* Important Note about Source Table Permissions */}
        <Paper
          elevation={1}
          sx={{
            p: 3,
            mt: 3,
            bgcolor: 'info.50',
            border: '1px solid',
            borderColor: 'info.200',
            maxWidth: 600,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <SecurityIcon color="info" />
            <Typography variant="h6" fontWeight="600" color="info.dark">
              Important: Source Table Permissions
            </Typography>
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            In addition to the saved requirements table, the Service Principal needs access to any
            tables you want to query. This includes permissions to:
          </Typography>

          <Box component="ul" sx={{ m: 0, pl: 3, color: 'text.secondary' }}>
            <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
              <strong>SELECT</strong> - Read data and fetch sample data previews
            </Typography>
            <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
              <strong>USE CATALOG</strong> - Access the catalog containing the tables
            </Typography>
            <Typography component="li" variant="body2">
              <strong>USE SCHEMA</strong> - Access the schema containing the tables
            </Typography>
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ mt: 2, mb: 1 }}>
            Grant commands for a catalog admin to run{selectedCatalog && selectedSchema ? ` (using your selected ${selectedCatalog}.${selectedSchema})` : ''}:
          </Typography>

          <Paper
            variant="outlined"
            sx={{
              p: 1.5,
              bgcolor: '#1e1e1e',
              fontFamily: 'monospace',
              fontSize: '0.75rem',
              color: '#d4d4d4',
              overflow: 'auto',
            }}
          >
            <pre style={{ margin: 0 }}>
{`-- Grant access to use a catalog
GRANT USE CATALOG ON CATALOG ${selectedCatalog || '<catalog_name>'} TO \`${permissions?.service_principal || '<service_principal>'}\`;

-- Grant access to use a schema
GRANT USE SCHEMA ON SCHEMA ${selectedCatalog || '<catalog>'}.${selectedSchema || '<schema>'} TO \`${permissions?.service_principal || '<service_principal>'}\`;

-- Grant SELECT on all tables in a schema
GRANT SELECT ON SCHEMA ${selectedCatalog || '<catalog>'}.${selectedSchema || '<schema>'} TO \`${permissions?.service_principal || '<service_principal>'}\`;

-- Or grant on specific tables
GRANT SELECT ON TABLE ${selectedCatalog || '<catalog>'}.${selectedSchema || '<schema>'}.<table_name> TO \`${permissions?.service_principal || '<service_principal>'}\`;`}
            </pre>
          </Paper>

          <Button
            variant="outlined"
            size="small"
            startIcon={<CopyIcon />}
            onClick={() => {
              const sql = `-- Grant access to use a catalog
GRANT USE CATALOG ON CATALOG ${selectedCatalog || '<catalog_name>'} TO \`${permissions?.service_principal || '<service_principal>'}\`;

-- Grant access to use a schema
GRANT USE SCHEMA ON SCHEMA ${selectedCatalog || '<catalog>'}.${selectedSchema || '<schema>'} TO \`${permissions?.service_principal || '<service_principal>'}\`;

-- Grant SELECT on all tables in a schema
GRANT SELECT ON SCHEMA ${selectedCatalog || '<catalog>'}.${selectedSchema || '<schema>'} TO \`${permissions?.service_principal || '<service_principal>'}\`;`
              navigator.clipboard.writeText(sql)
              setSuccess('Source table grant SQL copied to clipboard!')
            }}
            sx={{ mt: 2 }}
            disabled={!selectedCatalog || !selectedSchema}
          >
            Copy Grant SQL
          </Button>
        </Paper>
        </>
      )}
    </Box>
  )
}
