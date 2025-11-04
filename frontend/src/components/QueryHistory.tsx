import { useState, useEffect } from 'react'
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Grid,
  Chip,
  Divider,
  CircularProgress,
  Alert,
  Button,
} from '@mui/material'
import {
  ExpandMore as ExpandMoreIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  AccessTime as AccessTimeIcon,
  AttachMoney as AttachMoneyIcon,
  DataUsage as DataUsageIcon,
  Code as CodeIcon,
  Storage as StorageIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material'
import { motion } from 'framer-motion'

interface QuerySession {
  session_id: string
  timestamp: string
  table_name: string
  catalog: string
  schema_name: string
  columns: string[]
  business_logic: string
  generated_sql: string
  business_logic_suggestion: any
  sql_generation: any
  sql_execution: any
  total_cost_usd: number
  total_tokens: number
  total_time_ms: number
  row_count: number
  status: string
}

export default function QueryHistory() {
  const [sessions, setSessions] = useState<QuerySession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchQueryHistory = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/query-history')
      if (!response.ok) throw new Error('Failed to fetch query history')
      const data = await response.json()
      setSessions(data.query_sessions || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchQueryHistory()
  }, [])

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString()
  }

  const formatCost = (cost: number) => {
    return `$${cost.toFixed(6)}`
  }

  const parseBusinessLogic = (businessLogic: string) => {
    if (!businessLogic) return []

    try {
      // First, try to parse as JSON array directly
      const parsed = JSON.parse(businessLogic)
      if (Array.isArray(parsed)) {
        return parsed
      }
      return [businessLogic]
    } catch {
      // If parsing fails, check if it looks like a Python list string
      const trimmed = businessLogic.trim()
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
          // Replace single quotes with double quotes for JSON compatibility
          const jsonStr = trimmed.replace(/'/g, '"')
          const parsed = JSON.parse(jsonStr)
          if (Array.isArray(parsed)) {
            return parsed
          }
        } catch {
          // If that fails too, return as single item
        }
      }
      // If not a list format, return as single item
      return [businessLogic]
    }
  }

  return (
    <Container maxWidth="xl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
              Query History
            </Typography>
            <Typography variant="body1" color="text.secondary">
              View detailed metrics and costs for each query execution
            </Typography>
          </Box>
          <Button
            variant="outlined"
            color="primary"
            startIcon={<RefreshIcon />}
            onClick={fetchQueryHistory}
            disabled={loading}
          >
            Refresh
          </Button>
        </Box>

        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" minHeight="300px">
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : sessions.length === 0 ? (
          <Card>
            <CardContent>
              <Typography color="text.secondary" align="center">
                No query history yet. Run some queries in the SQL Generator to see them here.
              </Typography>
            </CardContent>
          </Card>
        ) : (
          <Box sx={{ width: '100%' }}>
            {sessions.map((session, index) => (
              <motion.div
                key={session.session_id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
              >
                <Accordion
                  sx={{
                    mb: 3,
                    boxShadow: 2,
                    borderRadius: 2,
                    '&:before': { display: 'none' },
                    overflow: 'hidden',
                  }}
                >
                  <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                    sx={{
                      px: 3,
                      py: 2,
                      '&:hover': {
                        backgroundColor: 'action.hover',
                      },
                    }}
                  >
                    <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%', gap: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minWidth: 0, gap: 2 }}>
                        <Typography
                          variant="subtitle1"
                          fontWeight="600"
                          sx={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            flex: 1,
                          }}
                        >
                          {session.catalog}.{session.schema_name}.{session.table_name}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
                          {session.status === 'success' ? (
                            <Chip
                              icon={<CheckCircleIcon />}
                              label="Success"
                              size="small"
                              color="success"
                            />
                          ) : session.status === 'error' ? (
                            <Chip
                              icon={<ErrorIcon />}
                              label="Error"
                              size="small"
                              color="error"
                            />
                          ) : (
                            <Chip label="Incomplete" size="small" color="warning" />
                          )}
                          <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                            {formatTimestamp(session.timestamp)}
                          </Typography>
                        </Box>
                      </Box>

                      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
                        <Chip
                          icon={<AttachMoneyIcon />}
                          label={formatCost(session.total_cost_usd)}
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                        <Chip
                          icon={<DataUsageIcon />}
                          label={`${session.total_tokens.toLocaleString()} tokens`}
                          size="small"
                          variant="outlined"
                        />
                        <Chip
                          icon={<AccessTimeIcon />}
                          label={`${session.total_time_ms}ms`}
                          size="small"
                          variant="outlined"
                        />
                        {session.row_count !== null && session.row_count !== undefined && (
                          <Chip
                            icon={<StorageIcon />}
                            label={`${session.row_count.toLocaleString()} rows`}
                            size="small"
                            variant="outlined"
                          />
                        )}
                      </Box>

                      {session.generated_sql && (
                        <Box
                          sx={{
                            p: 2,
                            backgroundColor: 'grey.100',
                            borderRadius: 1,
                            fontFamily: 'monospace',
                            fontSize: '0.75rem',
                            maxHeight: '60px',
                            overflow: 'hidden',
                            color: 'text.secondary',
                            borderLeft: '3px solid',
                            borderColor: 'primary.main',
                            display: '-webkit-box',
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: 'vertical',
                            lineHeight: '1.4',
                          }}
                        >
                          <CodeIcon sx={{ fontSize: '0.875rem', mr: 0.5, verticalAlign: 'middle', float: 'left' }} />
                          {session.generated_sql}
                        </Box>
                      )}
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails sx={{ px: 3, py: 3, backgroundColor: 'grey.50' }}>
                    <Grid container spacing={3}>
                    {/* Business Logic Section */}
                    {session.business_logic_suggestion && (
                      <Grid item xs={12}>
                        <motion.div
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.4, delay: 0.1 }}
                        >
                          <Card variant="outlined" sx={{ borderRadius: 2, boxShadow: 1 }}>
                            <CardContent sx={{ p: 3 }}>
                            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <CodeIcon color="primary" />
                              Business Logic Generation
                            </Typography>
                            <Divider sx={{ my: 1 }} />
                            <Grid container spacing={2}>
                              <Grid item xs={12} md={6}>
                                <Typography variant="caption" color="text.secondary">Business Logic Options</Typography>
                                <Box component="ul" sx={{ mt: 0.5, pl: 2, mb: 0 }}>
                                  {parseBusinessLogic(session.business_logic).map((option: string, index: number) => (
                                    <Box
                                      component="li"
                                      key={index}
                                      sx={{
                                        mb: 0.5,
                                        fontSize: '0.875rem',
                                        color: 'text.primary',
                                      }}
                                    >
                                      {option}
                                    </Box>
                                  ))}
                                </Box>
                              </Grid>
                              <Grid item xs={12} md={6}>
                                <Grid container spacing={1}>
                                  <Grid item xs={6}>
                                    <Typography variant="caption" color="text.secondary">Prompt Tokens</Typography>
                                    <Typography variant="body2" fontWeight="500">
                                      {session.business_logic_suggestion.prompt_tokens || 0}
                                    </Typography>
                                  </Grid>
                                  <Grid item xs={6}>
                                    <Typography variant="caption" color="text.secondary">Completion Tokens</Typography>
                                    <Typography variant="body2" fontWeight="500">
                                      {session.business_logic_suggestion.completion_tokens || 0}
                                    </Typography>
                                  </Grid>
                                  <Grid item xs={6}>
                                    <Typography variant="caption" color="text.secondary">Cost</Typography>
                                    <Typography variant="body2" fontWeight="500" color="primary.main">
                                      {formatCost(session.business_logic_suggestion.estimated_cost_usd || 0)}
                                    </Typography>
                                  </Grid>
                                  <Grid item xs={6}>
                                    <Typography variant="caption" color="text.secondary">Execution Time</Typography>
                                    <Typography variant="body2" fontWeight="500">
                                      {session.business_logic_suggestion.execution_time_ms}ms
                                    </Typography>
                                  </Grid>
                                  <Grid item xs={12}>
                                    <Typography variant="caption" color="text.secondary">Model</Typography>
                                    <Typography variant="body2" fontWeight="500" sx={{ fontSize: '0.75rem', wordBreak: 'break-all' }}>
                                      {session.business_logic_suggestion.model_id || 'N/A'}
                                    </Typography>
                                  </Grid>
                                </Grid>
                              </Grid>
                            </Grid>
                          </CardContent>
                        </Card>
                        </motion.div>
                      </Grid>
                    )}

                    {/* SQL Generation Section */}
                    {session.sql_generation && (
                      <Grid item xs={12}>
                        <motion.div
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.4, delay: 0.2 }}
                        >
                          <Card variant="outlined" sx={{ borderRadius: 2, boxShadow: 1 }}>
                            <CardContent sx={{ p: 3 }}>
                            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <CodeIcon color="secondary" />
                              SQL Generation
                            </Typography>
                            <Divider sx={{ my: 1 }} />
                            <Grid container spacing={2}>
                              {session.sql_generation.business_logic && (
                                <Grid item xs={12}>
                                  <Typography variant="caption" color="text.secondary">Selected Business Logic</Typography>
                                  <Box
                                    sx={{
                                      mt: 0.5,
                                      p: 1.5,
                                      backgroundColor: 'secondary.50',
                                      borderLeft: '3px solid',
                                      borderColor: 'secondary.main',
                                      borderRadius: 1,
                                    }}
                                  >
                                    <Typography variant="body2" fontWeight="500" color="secondary.dark">
                                      {session.sql_generation.business_logic}
                                    </Typography>
                                  </Box>
                                </Grid>
                              )}
                              <Grid item xs={12} md={6}>
                                <Typography variant="caption" color="text.secondary">Generated SQL</Typography>
                                <Box
                                  component="pre"
                                  sx={{
                                    fontFamily: 'monospace',
                                    fontSize: '0.875rem',
                                    backgroundColor: 'grey.100',
                                    p: 1.5,
                                    borderRadius: 1,
                                    mt: 0.5,
                                    maxHeight: '200px',
                                    overflow: 'auto',
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-word',
                                    margin: 0,
                                  }}
                                >
                                  {session.generated_sql}
                                </Box>
                              </Grid>
                              <Grid item xs={12} md={6}>
                                <Grid container spacing={1}>
                                  <Grid item xs={6}>
                                    <Typography variant="caption" color="text.secondary">Prompt Tokens</Typography>
                                    <Typography variant="body2" fontWeight="500">
                                      {session.sql_generation.prompt_tokens || 0}
                                    </Typography>
                                  </Grid>
                                  <Grid item xs={6}>
                                    <Typography variant="caption" color="text.secondary">Completion Tokens</Typography>
                                    <Typography variant="body2" fontWeight="500">
                                      {session.sql_generation.completion_tokens || 0}
                                    </Typography>
                                  </Grid>
                                  <Grid item xs={6}>
                                    <Typography variant="caption" color="text.secondary">Cost</Typography>
                                    <Typography variant="body2" fontWeight="500" color="secondary.main">
                                      {formatCost(session.sql_generation.estimated_cost_usd || 0)}
                                    </Typography>
                                  </Grid>
                                  <Grid item xs={6}>
                                    <Typography variant="caption" color="text.secondary">Execution Time</Typography>
                                    <Typography variant="body2" fontWeight="500">
                                      {session.sql_generation.execution_time_ms}ms
                                    </Typography>
                                  </Grid>
                                  <Grid item xs={6}>
                                    <Typography variant="caption" color="text.secondary">SQL Length</Typography>
                                    <Typography variant="body2" fontWeight="500">
                                      {session.sql_generation.generated_sql_length || 0} chars
                                    </Typography>
                                  </Grid>
                                  <Grid item xs={6}>
                                    <Typography variant="caption" color="text.secondary">Model</Typography>
                                    <Typography variant="body2" fontWeight="500" sx={{ fontSize: '0.7rem' }}>
                                      {session.sql_generation.model_id}
                                    </Typography>
                                  </Grid>
                                </Grid>
                              </Grid>
                            </Grid>
                          </CardContent>
                        </Card>
                        </motion.div>
                      </Grid>
                    )}

                    {/* SQL Execution Section */}
                    {session.sql_execution && (
                      <Grid item xs={12}>
                        <motion.div
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.4, delay: 0.3 }}
                        >
                          <Card variant="outlined" sx={{ borderRadius: 2, boxShadow: 1 }}>
                            <CardContent sx={{ p: 3 }}>
                            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <StorageIcon color="success" />
                              SQL Execution
                            </Typography>
                            <Divider sx={{ my: 1 }} />
                            <Grid container spacing={2}>
                              <Grid item xs={4}>
                                <Typography variant="caption" color="text.secondary">Rows Returned</Typography>
                                <Typography variant="h5" fontWeight="600" color="success.main">
                                  {session.row_count || 0}
                                </Typography>
                              </Grid>
                              <Grid item xs={4}>
                                <Typography variant="caption" color="text.secondary">Execution Time</Typography>
                                <Typography variant="h5" fontWeight="600">
                                  {session.sql_execution.execution_time_ms}ms
                                </Typography>
                              </Grid>
                              <Grid item xs={4}>
                                <Typography variant="caption" color="text.secondary">Status</Typography>
                                <Chip
                                  label={session.status}
                                  color={session.status === 'success' ? 'success' : 'error'}
                                  sx={{ mt: 0.5 }}
                                />
                              </Grid>
                            </Grid>
                          </CardContent>
                        </Card>
                        </motion.div>
                      </Grid>
                    )}

                    {/* Summary Section */}
                    <Grid item xs={12}>
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.4, delay: 0.4 }}
                      >
                        <Card variant="outlined" sx={{ backgroundColor: 'primary.50', borderRadius: 2, boxShadow: 2 }}>
                          <CardContent sx={{ p: 3 }}>
                          <Typography variant="h6" gutterBottom fontWeight="600">
                            Total Query Cost Summary
                          </Typography>
                          <Divider sx={{ my: 1 }} />
                          <Grid container spacing={2}>
                            <Grid item xs={3}>
                              <Typography variant="caption" color="text.secondary">Total Cost</Typography>
                              <Typography variant="h5" fontWeight="700" color="primary.main">
                                {formatCost(session.total_cost_usd)}
                              </Typography>
                            </Grid>
                            <Grid item xs={3}>
                              <Typography variant="caption" color="text.secondary">Total Tokens</Typography>
                              <Typography variant="h5" fontWeight="700">
                                {session.total_tokens}
                              </Typography>
                            </Grid>
                            <Grid item xs={3}>
                              <Typography variant="caption" color="text.secondary">Total Time</Typography>
                              <Typography variant="h5" fontWeight="700">
                                {session.total_time_ms}ms
                              </Typography>
                            </Grid>
                            <Grid item xs={3}>
                              <Typography variant="caption" color="text.secondary">Avg Cost/Token</Typography>
                              <Typography variant="h5" fontWeight="700">
                                {session.total_tokens > 0
                                  ? `$${(session.total_cost_usd / session.total_tokens).toFixed(8)}`
                                  : 'N/A'}
                              </Typography>
                            </Grid>
                          </Grid>
                        </CardContent>
                      </Card>
                      </motion.div>
                    </Grid>
                  </Grid>
                </AccordionDetails>
              </Accordion>
              </motion.div>
            ))}
          </Box>
        )}
      </motion.div>
    </Container>
  )
}
