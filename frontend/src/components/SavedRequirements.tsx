import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Paper,
  Typography,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  CircularProgress,
  Alert,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material'
import {
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Code as CodeIcon,
  ExpandMore as ExpandMoreIcon,
  Refresh as RefreshIcon,
  Storage as StorageIcon,
} from '@mui/icons-material'

interface SavedRequirement {
  requirement_id: string
  catalog: string
  schema_name: string
  table_name: string
  columns: string[]
  business_logic: string
  generated_sql: string | null
  model_id: string
  created_at: string
  created_by: string
}

export default function SavedRequirements() {
  const [requirements, setRequirements] = useState<SavedRequirement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedRequirement, setSelectedRequirement] = useState<SavedRequirement | null>(null)
  const [viewDialogOpen, setViewDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [requirementToDelete, setRequirementToDelete] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchRequirements = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/saved-requirements')
      const data = await response.json()
      if (response.ok) {
        setRequirements(data.requirements || [])
      } else {
        setError(data.detail || 'Failed to fetch requirements')
      }
    } catch (err) {
      setError('Failed to fetch requirements')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRequirements()
  }, [])

  const handleView = (requirement: SavedRequirement) => {
    setSelectedRequirement(requirement)
    setViewDialogOpen(true)
  }

  const handleDeleteClick = (requirementId: string) => {
    setRequirementToDelete(requirementId)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!requirementToDelete) return

    setDeleting(true)
    try {
      const response = await fetch(`/api/saved-requirements/${requirementToDelete}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        setRequirements(prev => prev.filter(r => r.requirement_id !== requirementToDelete))
        setDeleteDialogOpen(false)
        setRequirementToDelete(null)
      } else {
        const data = await response.json()
        setError(data.detail || 'Failed to delete requirement')
      }
    } catch (err) {
      setError('Failed to delete requirement')
    } finally {
      setDeleting(false)
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleString()
  }

  const getModelName = (modelId: string) => {
    const modelMap: { [key: string]: string } = {
      'databricks-llama-4-maverick': 'Llama 4 Maverick',
      'databricks-meta-llama-3-3-70b-instruct': 'Llama 3.3 70B',
      'databricks-claude-sonnet-4-5': 'Claude Sonnet 4.5',
      'databricks-gpt-5': 'GPT-5',
    }
    return modelMap[modelId] || modelId
  }

  // Helper function to safely convert columns to array
  // Databricks ARRAY<STRING> may be returned in various formats
  const getColumnsArray = (columns: unknown): string[] => {
    if (Array.isArray(columns)) {
      return columns
    }
    if (typeof columns === 'string') {
      // Try to parse as JSON array
      try {
        const parsed = JSON.parse(columns)
        if (Array.isArray(parsed)) {
          return parsed
        }
      } catch {
        // If it's a comma-separated string, split it
        if (columns.includes(',')) {
          return columns.split(',').map(s => s.trim())
        }
        // Single column
        return columns ? [columns] : []
      }
    }
    return []
  }

  return (
    <Box sx={{ mt: 1, mb: 4, overflow: 'hidden', width: '100%', maxWidth: '100%', minWidth: 0 }}>
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
            Saved Requirements
          </Typography>
          <Typography variant="body1" color="text.secondary">
            View and manage your saved SQL query requirements
          </Typography>
        </Box>
        <Button
          variant="outlined"
          color="primary"
          startIcon={<RefreshIcon />}
          onClick={fetchRequirements}
          disabled={loading}
          sx={{ mt: 1 }}
        >
          Refresh
        </Button>
      </Box>

      {error && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        </motion.div>
      )}

      <Paper elevation={2} sx={{ p: 2, bgcolor: 'white', border: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <StorageIcon color="primary" fontSize="small" />
          <Typography variant="subtitle1" fontWeight="600" color="text.primary">
            Requirements ({requirements.length})
          </Typography>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : requirements.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography color="text.secondary">
              No saved requirements yet. Use the "Save Requirement" button on the SQL Query Generator page to save your query requirements.
            </Typography>
          </Box>
        ) : (
          <TableContainer sx={{ maxHeight: 600 }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>Table</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>Business Logic</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>Model</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>Created</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100', width: 100 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {requirements.map((req) => (
                  <TableRow key={req.requirement_id} hover>
                    <TableCell>
                      <Box>
                        <Typography variant="body2" fontWeight="600">
                          {req.table_name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {req.catalog}.{req.schema_name}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{
                          maxWidth: 400,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {req.business_logic}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={getModelName(req.model_id)}
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">
                        {formatDate(req.created_at)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Tooltip title="View Details">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => handleView(req)}
                        >
                          <ViewIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteClick(req.requirement_id)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* View Details Dialog */}
      <Dialog
        open={viewDialogOpen}
        onClose={() => setViewDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <StorageIcon color="primary" />
            <Typography variant="h6">Requirement Details</Typography>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {selectedRequirement && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Catalog</Typography>
                  <Typography variant="body2" fontWeight="500">{selectedRequirement.catalog}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Schema</Typography>
                  <Typography variant="body2" fontWeight="500">{selectedRequirement.schema_name}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Table</Typography>
                  <Typography variant="body2" fontWeight="500">{selectedRequirement.table_name}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Model</Typography>
                  <Chip
                    label={getModelName(selectedRequirement.model_id)}
                    size="small"
                    color="primary"
                    variant="outlined"
                  />
                </Box>
              </Box>

              <Box>
                <Typography variant="caption" color="text.secondary">Columns</Typography>
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                  {getColumnsArray(selectedRequirement.columns).map((col) => (
                    <Chip key={col} label={col} size="small" variant="outlined" />
                  ))}
                </Box>
              </Box>

              <Box>
                <Typography variant="caption" color="text.secondary">Business Logic</Typography>
                <Paper variant="outlined" sx={{ p: 2, mt: 0.5, bgcolor: 'grey.50' }}>
                  <Typography variant="body2">{selectedRequirement.business_logic}</Typography>
                </Paper>
              </Box>

              {selectedRequirement.generated_sql && (
                <Accordion defaultExpanded>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CodeIcon color="primary" fontSize="small" />
                      <Typography variant="subtitle2" fontWeight="600">Generated SQL</Typography>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails sx={{ p: 0 }}>
                    <Paper
                      variant="outlined"
                      sx={{
                        p: 2,
                        bgcolor: '#1e1e1e',
                        color: '#d4d4d4',
                        fontFamily: 'monospace',
                        fontSize: '0.875rem',
                        whiteSpace: 'pre-wrap',
                        overflow: 'auto',
                        maxHeight: 300,
                      }}
                    >
                      {selectedRequirement.generated_sql}
                    </Paper>
                  </AccordionDetails>
                </Accordion>
              )}

              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Created: {formatDate(selectedRequirement.created_at)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  ID: {selectedRequirement.requirement_id}
                </Typography>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this saved requirement? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            color="error"
            variant="contained"
            disabled={deleting}
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
