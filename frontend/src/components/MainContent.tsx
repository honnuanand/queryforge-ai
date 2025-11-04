import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import LinearProgress from '@mui/material/LinearProgress'
import Switch from '@mui/material/Switch'
import FormControlLabel from '@mui/material/FormControlLabel'
import Accordion from '@mui/material/Accordion'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import RefreshIcon from '@mui/icons-material/Refresh'
import AttachMoneyIcon from '@mui/icons-material/AttachMoney'
import DataUsageIcon from '@mui/icons-material/DataUsage'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import SpeedIcon from '@mui/icons-material/Speed'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import InfoIcon from '@mui/icons-material/Info'
import SQLGenerator from './SQLGenerator'
import QueryHistory from './QueryHistory'
import Analytics from './Analytics'

interface MainContentProps {
  selectedPage: string
}

interface HealthData {
  status: string
  timestamp: string
}

interface DashboardStatistics {
  total_executions: number
  total_llm_calls: number
  avg_execution_time_ms: number
  success_rate: number
  total_rows_returned: number
  unique_tables_analyzed: number
}

interface LLMCostData {
  models: Array<{
    model_id: string
    total_prompt_tokens: number
    total_completion_tokens: number
    total_tokens: number
    total_cost: number
    call_count: number
  }>
  total_cost: number
  total_prompt_tokens: number
  total_completion_tokens: number
}

export default function MainContent({ selectedPage }: MainContentProps) {
  const [healthData, setHealthData] = useState<HealthData | null>(null)
  const [statistics, setStatistics] = useState<DashboardStatistics | null>(null)
  const [llmCosts, setLlmCosts] = useState<LLMCostData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(false)

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)

      const [healthRes, statsRes, costsRes] = await Promise.all([
        fetch('/api/health'),
        fetch('/api/dashboard-statistics'),
        fetch('/api/llm-costs-by-model'),
      ])

      if (!healthRes.ok || !statsRes.ok || !costsRes.ok) {
        throw new Error('Failed to fetch data')
      }

      const health = await healthRes.json()
      const stats = await statsRes.json()
      const costs = await costsRes.json()

      // Debug logging for dashboard statistics
      console.log('=== Dashboard API Response ===')
      console.log('Stats API Response:', stats)
      console.log('total_executions:', stats?.total_executions)
      console.log('total_llm_calls:', stats?.total_llm_calls)
      console.log('success_rate:', stats?.success_rate)
      console.log('avg_execution_time_ms:', stats?.avg_execution_time_ms)
      console.log('Costs API Response:', costs)
      console.log('total_cost:', costs?.total_cost)
      console.log('==============================')

      setHealthData(health)
      setStatistics(stats)
      setLlmCosts(costs)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = () => {
    fetchData()
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Auto-refresh effect
  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(() => {
      fetchData()
    }, 30000) // Refresh every 30 seconds

    return () => clearInterval(interval)
  }, [autoRefresh])

  const pageVariants = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
  }

  // Show SQL Generator for SQL Generator page
  if (selectedPage === 'SQL Generator') {
    return <SQLGenerator />
  }

  // Show Query History for Query History page
  if (selectedPage === 'Query History') {
    return <QueryHistory />
  }

  // Show Analytics for Analytics page
  if (selectedPage === 'Analytics') {
    return <Analytics />
  }

  return (
    <Container maxWidth="lg">
      <motion.div
        key={selectedPage}
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{ duration: 0.3 }}
      >
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h4">
            {selectedPage}
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <FormControlLabel
              control={
                <Switch
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  color="primary"
                />
              }
              label="Auto-refresh"
            />
            <Button
              variant="outlined"
              color="primary"
              startIcon={<RefreshIcon />}
              onClick={handleRefresh}
              disabled={loading}
            >
              Refresh
            </Button>
          </Box>
        </Box>

        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        ) : (
          <>
            {/* App Information */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <Accordion
                sx={{
                  mb: 3,
                  borderRadius: 2,
                  '&:before': { display: 'none' },
                  boxShadow: 2,
                  overflow: 'hidden',
                  '&.Mui-expanded': {
                    mb: 4  // Extra margin when expanded
                  }
                }}
              >
                <AccordionSummary
                  expandIcon={<ExpandMoreIcon />}
                  sx={{
                    background: 'linear-gradient(135deg, #FF6B35 0%, #FF8C61 100%)',
                    color: 'white',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #E55A2B 0%, #FF6B35 100%)',
                    }
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <InfoIcon />
                    <Typography variant="h6" fontWeight="600">About QueryForge AI</Typography>
                  </Box>
                </AccordionSummary>
                <AccordionDetails sx={{ p: 3, pb: 4, backgroundColor: 'white' }}>
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={4}>
                      <Typography variant="h6" fontWeight="600" sx={{ mb: 1, color: 'primary.main' }}>
                        Why QueryForge AI?
                      </Typography>
                      <Typography variant="body2" color="text.secondary" paragraph>
                        QueryForge AI transforms natural language into SQL queries using advanced LLM technology.
                        It eliminates the need for SQL expertise, making data analysis accessible to everyone.
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Save time, reduce errors, and democratize data access across your organization.
                      </Typography>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Typography variant="h6" fontWeight="600" sx={{ mb: 1, color: 'secondary.main' }}>
                        How It Works
                      </Typography>
                      <Typography variant="body2" color="text.secondary" paragraph>
                        1. <strong>Describe your question</strong> in plain English
                      </Typography>
                      <Typography variant="body2" color="text.secondary" paragraph>
                        2. <strong>AI analyzes your database</strong> schema and relationships
                      </Typography>
                      <Typography variant="body2" color="text.secondary" paragraph>
                        3. <strong>Generates optimized SQL</strong> with explanations
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        4. <strong>Execute and export</strong> results instantly
                      </Typography>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Typography variant="h6" fontWeight="600" sx={{ mb: 1, color: 'success.main' }}>
                        What You Get
                      </Typography>
                      <Typography variant="body2" color="text.secondary" paragraph>
                        • <strong>Natural language queries:</strong> Ask questions in plain English
                      </Typography>
                      <Typography variant="body2" color="text.secondary" paragraph>
                        • <strong>Cost tracking:</strong> Monitor LLM usage and expenses
                      </Typography>
                      <Typography variant="body2" color="text.secondary" paragraph>
                        • <strong>Query history:</strong> Access and reuse previous queries
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        • <strong>Deep analytics:</strong> Insights into performance and patterns
                      </Typography>
                    </Grid>
                  </Grid>
                </AccordionDetails>
              </Accordion>
            </motion.div>

            {/* Key Metrics Overview */}
            <Grid container spacing={3} sx={{ mb: 3, mt: 2 }}>
              <Grid item xs={12} md={3}>
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: 0.1 }}
                >
                  <Card sx={{ background: 'linear-gradient(135deg, #FF6B35 0%, #FF8C61 100%)', color: 'white' }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Box>
                          <Typography variant="body2" sx={{ opacity: 0.9, mb: 1 }}>
                            Total Cost
                          </Typography>
                          <Typography variant="h4" fontWeight="700">
                            ${llmCosts?.total_cost?.toFixed(4) ?? '0.0000'}
                          </Typography>
                        </Box>
                        <AttachMoneyIcon sx={{ fontSize: 40, opacity: 0.3 }} />
                      </Box>
                    </CardContent>
                  </Card>
                </motion.div>
              </Grid>

              <Grid item xs={12} md={3}>
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: 0.2 }}
                >
                  <Card sx={{ background: 'linear-gradient(135deg, #004E89 0%, #1A6BA8 100%)', color: 'white' }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Box>
                          <Typography variant="body2" sx={{ opacity: 0.9, mb: 1 }}>
                            Query Executions
                          </Typography>
                          <Typography variant="h4" fontWeight="700">
                            {statistics?.total_executions ?? 0}
                          </Typography>
                        </Box>
                        <TrendingUpIcon sx={{ fontSize: 40, opacity: 0.3 }} />
                      </Box>
                    </CardContent>
                  </Card>
                </motion.div>
              </Grid>

              <Grid item xs={12} md={3}>
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: 0.3 }}
                >
                  <Card sx={{ background: 'linear-gradient(135deg, #2E7D32 0%, #4CAF50 100%)', color: 'white' }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Box>
                          <Typography variant="body2" sx={{ opacity: 0.9, mb: 1 }}>
                            Success Rate
                          </Typography>
                          <Typography variant="h4" fontWeight="700">
                            {statistics?.success_rate?.toFixed(1) ?? 0}%
                          </Typography>
                          <LinearProgress
                            variant="determinate"
                            value={statistics?.success_rate ?? 0}
                            sx={{
                              mt: 1,
                              height: 6,
                              borderRadius: 3,
                              backgroundColor: 'rgba(255,255,255,0.3)',
                              '& .MuiLinearProgress-bar': {
                                backgroundColor: 'white'
                              }
                            }}
                          />
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </motion.div>
              </Grid>

              <Grid item xs={12} md={3}>
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: 0.4 }}
                >
                  <Card sx={{ background: 'linear-gradient(135deg, #F57C00 0%, #FF9800 100%)', color: 'white' }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Box>
                          <Typography variant="body2" sx={{ opacity: 0.9, mb: 1 }}>
                            Avg Time
                          </Typography>
                          <Typography variant="h4" fontWeight="700">
                            {statistics?.avg_execution_time_ms ?? 0}ms
                          </Typography>
                        </Box>
                        <SpeedIcon sx={{ fontSize: 40, opacity: 0.3 }} />
                      </Box>
                    </CardContent>
                  </Card>
                </motion.div>
              </Grid>
            </Grid>

            {/* LLM Cost Analytics */}
            {llmCosts && llmCosts.models.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.5 }}
              >
                <Paper sx={{ p: 3, mb: 3, borderRadius: 2 }}>
                  <Typography variant="h6" gutterBottom fontWeight="600" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AttachMoneyIcon color="primary" />
                    LLM Cost Analytics
                  </Typography>
                  <Divider sx={{ mb: 3 }} />
                  <Grid container spacing={3}>
                    {llmCosts.models.map((model, index) => (
                      <Grid item xs={12} md={6} key={model.model_id}>
                        <motion.div
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.3, delay: 0.6 + index * 0.1 }}
                        >
                          <Card variant="outlined" sx={{ height: '100%', borderRadius: 2 }}>
                            <CardContent>
                              <Typography variant="subtitle2" color="text.secondary" sx={{ fontSize: '0.7rem', mb: 1, wordBreak: 'break-all' }}>
                                {model.model_id}
                              </Typography>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                <Typography variant="h5" fontWeight="700" color="primary.main">
                                  ${model.total_cost.toFixed(6)}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {model.call_count} calls
                                </Typography>
                              </Box>
                              <Grid container spacing={2}>
                                <Grid item xs={6}>
                                  <Typography variant="caption" color="text.secondary">Prompt Tokens</Typography>
                                  <Typography variant="body1" fontWeight="600">
                                    {model.total_prompt_tokens.toLocaleString()}
                                  </Typography>
                                </Grid>
                                <Grid item xs={6}>
                                  <Typography variant="caption" color="text.secondary">Completion Tokens</Typography>
                                  <Typography variant="body1" fontWeight="600">
                                    {model.total_completion_tokens.toLocaleString()}
                                  </Typography>
                                </Grid>
                                <Grid item xs={12}>
                                  <Typography variant="caption" color="text.secondary">Cost per Call</Typography>
                                  <Typography variant="body2" fontWeight="600" color="secondary.main">
                                    ${(model.total_cost / model.call_count).toFixed(6)}
                                  </Typography>
                                </Grid>
                              </Grid>
                            </CardContent>
                          </Card>
                        </motion.div>
                      </Grid>
                    ))}
                  </Grid>
                </Paper>
              </motion.div>
            )}

            {/* Activity Statistics */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.7 }}
            >
              <Paper sx={{ p: 3, mb: 3, borderRadius: 2 }}>
                <Typography variant="h6" gutterBottom fontWeight="600" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <DataUsageIcon color="secondary" />
                  Activity Statistics
                </Typography>
                <Divider sx={{ mb: 3 }} />
                <Grid container spacing={3}>
                  <Grid item xs={12} sm={6} md={4}>
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3, delay: 0.8 }}
                    >
                      <Card variant="outlined" sx={{ textAlign: 'center', py: 2, borderRadius: 2 }}>
                        <CardContent>
                          <Typography variant="subtitle2" color="text.secondary" gutterBottom>LLM Calls</Typography>
                          <Typography variant="h4" fontWeight="700" color="primary.main">
                            {statistics?.total_llm_calls ?? 0}
                          </Typography>
                        </CardContent>
                      </Card>
                    </motion.div>
                  </Grid>
                  <Grid item xs={12} sm={6} md={4}>
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3, delay: 0.9 }}
                    >
                      <Card variant="outlined" sx={{ textAlign: 'center', py: 2, borderRadius: 2 }}>
                        <CardContent>
                          <Typography variant="subtitle2" color="text.secondary" gutterBottom>Tables Analyzed</Typography>
                          <Typography variant="h4" fontWeight="700" color="secondary.main">
                            {statistics?.unique_tables_analyzed ?? 0}
                          </Typography>
                        </CardContent>
                      </Card>
                    </motion.div>
                  </Grid>
                  <Grid item xs={12} sm={6} md={4}>
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3, delay: 1.0 }}
                    >
                      <Card variant="outlined" sx={{ textAlign: 'center', py: 2, borderRadius: 2 }}>
                        <CardContent>
                          <Typography variant="subtitle2" color="text.secondary" gutterBottom>Total Rows</Typography>
                          <Typography variant="h4" fontWeight="700" color="success.main">
                            {statistics?.total_rows_returned?.toLocaleString() ?? 0}
                          </Typography>
                        </CardContent>
                      </Card>
                    </motion.div>
                  </Grid>
                </Grid>
              </Paper>
            </motion.div>

            {/* System Health */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 1.1 }}
            >
              <Paper sx={{ p: 3, borderRadius: 2 }}>
                <Typography variant="h6" gutterBottom fontWeight="600">
                  System Health
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography color="text.secondary">API Status</Typography>
                      <Typography fontWeight="600" color="success.main">{healthData?.status}</Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography color="text.secondary">Last Checked</Typography>
                      <Typography fontWeight="600">{healthData?.timestamp ? new Date(healthData.timestamp).toLocaleString() : 'N/A'}</Typography>
                    </Box>
                  </Grid>
                </Grid>
              </Paper>
            </motion.div>
          </>
        )}
      </motion.div>
    </Container>
  )
}
