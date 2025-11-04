import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Container,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Button,
  Divider,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tab,
  ToggleButtonGroup,
  ToggleButton,
  Tooltip,
  Switch,
  FormControlLabel,
} from '@mui/material'
import {
  Refresh as RefreshIcon,
  TrendingUp as TrendingUpIcon,
  Speed as SpeedIcon,
  AttachMoney as AttachMoneyIcon,
  QueryStats as QueryStatsIcon,
  Psychology as PsychologyIcon,
  DataUsage as DataUsageIcon,
  BarChart as BarChartIcon,
  ViewList as ViewListIcon,
  TableChart as TableChartIcon,
} from '@mui/icons-material'

interface LLMStat {
  model_id: string
  usage_count?: number
  total_cost?: number
  avg_execution_time?: number
  total_prompt_tokens?: number
  total_completion_tokens?: number
}

interface QueryStat {
  session_id: string
  timestamp: string
  catalog: string
  schema_name: string
  table_name: string
  generated_sql: string
  business_logic: string
  total_cost_usd: number
  total_time_ms: number
  total_tokens: number
  row_count?: number
  sql_execution_time_ms?: number
}

interface LLMUsageData {
  most_used: LLMStat[]
  most_costly: LLMStat[]
  slowest: LLMStat[]
  fastest: LLMStat[]
  all_models: LLMStat[]
}

interface TopQueriesData {
  most_costly: QueryStat[]
  slowest_total_time: QueryStat[]
  slowest_execution: QueryStat[]
  most_rows_returned: QueryStat[]
  recent_queries: QueryStat[]
}

interface AnalyticsSummary {
  total_queries: number
  unique_models_used: number
  avg_cost_per_query: number
  max_cost_query: number
  min_cost_query: number
  avg_time_per_event: number
  max_time_event: number
  total_prompt_tokens: number
  total_completion_tokens: number
  avg_rows_returned: number
  tokens_per_dollar: number
}

type ChartView = 'bar' | 'horizontal' | 'table'

// Animated Bar Chart Component
interface AnimatedBarChartProps {
  data: Array<{ label: string; value: number; color?: string }>
  maxValue?: number
  formatValue?: (value: number) => string
  showValue?: boolean
}

const AnimatedBarChart = ({ data, maxValue, formatValue = (v) => v.toString(), showValue = true }: AnimatedBarChartProps) => {
  const max = maxValue || Math.max(...data.map(d => d.value))

  return (
    <Box sx={{ width: '100%' }}>
      {data.map((item, index) => (
        <Box key={index} sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="body2" sx={{ fontSize: '0.75rem', fontWeight: 500 }}>
              {item.label}
            </Typography>
            {showValue && (
              <Typography variant="body2" sx={{ fontSize: '0.75rem', fontWeight: 700, color: item.color || 'primary.main' }}>
                {formatValue(item.value)}
              </Typography>
            )}
          </Box>
          <Box sx={{ position: 'relative', height: 32, backgroundColor: 'grey.100', borderRadius: 1, overflow: 'hidden' }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(item.value / max) * 100}%` }}
              transition={{ duration: 1, delay: index * 0.1, ease: 'easeOut' }}
              style={{
                height: '100%',
                background: item.color || 'linear-gradient(90deg, #FF6B35 0%, #FF8C61 100%)',
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
                paddingLeft: 12,
              }}
            >
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: index * 0.1 + 0.5 }}
                style={{ color: 'white', fontSize: '0.75rem', fontWeight: 600 }}
              >
                {item.value > max * 0.15 && formatValue(item.value)}
              </motion.span>
            </motion.div>
          </Box>
        </Box>
      ))}
    </Box>
  )
}

// Animated Horizontal Bar Chart Component
const AnimatedHorizontalBarChart = ({ data, maxValue, formatValue = (v) => v.toString(), showValue = true }: AnimatedBarChartProps) => {
  const max = maxValue || Math.max(...data.map(d => d.value))

  return (
    <Box sx={{ width: '100%', display: 'flex', gap: 2, alignItems: 'flex-end', height: 300 }}>
      {data.map((item, index) => {
        const heightPercent = (item.value / max) * 100
        return (
          <Box key={index} sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%' }}>
              {showValue && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 + 1 }}
                >
                  <Typography variant="caption" fontWeight="700" color={item.color || 'primary.main'} sx={{ mb: 0.5, textAlign: 'center', display: 'block' }}>
                    {formatValue(item.value)}
                  </Typography>
                </motion.div>
              )}
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${heightPercent}%` }}
                transition={{ duration: 1, delay: index * 0.1, ease: 'easeOut' }}
                style={{
                  width: '100%',
                  background: item.color || 'linear-gradient(180deg, #FF8C61 0%, #FF6B35 100%)',
                  borderRadius: '8px 8px 0 0',
                  minHeight: heightPercent > 0 ? 20 : 0,
                }}
              />
            </Box>
            <Typography variant="caption" sx={{ mt: 1, fontSize: '0.65rem', textAlign: 'center', wordBreak: 'break-word' }}>
              {item.label}
            </Typography>
          </Box>
        )
      })}
    </Box>
  )
}

export default function Analytics() {
  const [llmUsage, setLlmUsage] = useState<LLMUsageData | null>(null)
  const [topQueries, setTopQueries] = useState<TopQueriesData | null>(null)
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState(0)
  const [chartView, setChartView] = useState<ChartView>('bar')
  const [autoRefresh, setAutoRefresh] = useState(false)

  const fetchAnalytics = async () => {
    try {
      setLoading(true)
      setError(null)

      const [llmRes, queriesRes, summaryRes] = await Promise.all([
        fetch('/api/analytics/llm-usage'),
        fetch('/api/analytics/top-queries'),
        fetch('/api/analytics/summary'),
      ])

      if (!llmRes.ok || !queriesRes.ok || !summaryRes.ok) {
        throw new Error('Failed to fetch analytics data')
      }

      const llm = await llmRes.json()
      const queries = await queriesRes.json()
      const summaryData = await summaryRes.json()

      setLlmUsage(llm)
      setTopQueries(queries)
      setSummary(summaryData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAnalytics()
  }, [])

  // Auto-refresh effect
  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(() => {
      fetchAnalytics()
    }, 30000) // Refresh every 30 seconds

    return () => clearInterval(interval)
  }, [autoRefresh])

  const formatCost = (cost: number) => {
    return `$${cost?.toFixed(6) ?? '0.000000'}`
  }

  const formatTime = (ms: number) => {
    return `${ms?.toFixed(0) ?? 0}ms`
  }

  const formatModelName = (modelId: string) => {
    return modelId?.split('-').slice(-3).join(' ').toUpperCase() ?? modelId
  }

  const truncateSQL = (sql: string, maxLength: number = 80) => {
    if (!sql) return 'N/A'
    return sql.length > maxLength ? sql.substring(0, maxLength) + '...' : sql
  }

  if (loading) {
    return (
      <Container maxWidth="xl">
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      </Container>
    )
  }

  if (error) {
    return (
      <Container maxWidth="xl">
        <Alert severity="error" sx={{ mt: 3 }}>
          {error}
        </Alert>
      </Container>
    )
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
              Analytics
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Deep insights into LLM usage, costs, and query performance
            </Typography>
          </Box>
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
              onClick={fetchAnalytics}
            >
              Refresh
            </Button>
          </Box>
        </Box>

        {/* Summary Cards */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
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
                        Avg Cost/Query
                      </Typography>
                      <Typography variant="h4" fontWeight="700">
                        {formatCost(summary?.avg_cost_per_query ?? 0)}
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
                        Unique Models
                      </Typography>
                      <Typography variant="h4" fontWeight="700">
                        {summary?.unique_models_used ?? 0}
                      </Typography>
                    </Box>
                    <PsychologyIcon sx={{ fontSize: 40, opacity: 0.3 }} />
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
                        Tokens/Dollar
                      </Typography>
                      <Typography variant="h4" fontWeight="700">
                        {summary?.tokens_per_dollar?.toFixed(0) ?? 0}
                      </Typography>
                    </Box>
                    <DataUsageIcon sx={{ fontSize: 40, opacity: 0.3 }} />
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
                        Avg Rows
                      </Typography>
                      <Typography variant="h4" fontWeight="700">
                        {summary?.avg_rows_returned?.toFixed(0) ?? 0}
                      </Typography>
                    </Box>
                    <QueryStatsIcon sx={{ fontSize: 40, opacity: 0.3 }} />
                  </Box>
                </CardContent>
              </Card>
            </motion.div>
          </Grid>
        </Grid>

        {/* Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
            <Tab label="LLM Analytics" icon={<PsychologyIcon />} iconPosition="start" />
            <Tab label="Query Analytics" icon={<QueryStatsIcon />} iconPosition="start" />
          </Tabs>

          {/* Chart View Toggle */}
          <ToggleButtonGroup
            value={chartView}
            exclusive
            onChange={(_, newView) => newView && setChartView(newView)}
            size="small"
            sx={{ mb: 1 }}
          >
            <ToggleButton value="bar">
              <Tooltip title="Horizontal Bars">
                <BarChartIcon fontSize="small" />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="horizontal">
              <Tooltip title="Vertical Bars">
                <TableChartIcon fontSize="small" sx={{ transform: 'rotate(90deg)' }} />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="table">
              <Tooltip title="Table View">
                <ViewListIcon fontSize="small" />
              </Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {/* LLM Analytics Tab */}
        {activeTab === 0 && llmUsage && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Grid container spacing={3}>
              {/* Most Used LLMs */}
              <Grid item xs={12} lg={6}>
                <Card sx={{ borderRadius: 2, minHeight: chartView === 'horizontal' ? 450 : 'auto' }}>
                  <CardContent sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom fontWeight="600" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <TrendingUpIcon color="primary" />
                      Most Used LLMs
                    </Typography>
                    <Divider sx={{ mb: 3 }} />

                    <AnimatePresence mode="wait">
                      {chartView === 'bar' && (
                        <motion.div
                          key="bar"
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          transition={{ duration: 0.3 }}
                        >
                          <AnimatedBarChart
                            data={llmUsage.most_used.map(m => ({
                              label: formatModelName(m.model_id),
                              value: m.usage_count || 0,
                              color: 'linear-gradient(90deg, #FF6B35 0%, #FF8C61 100%)'
                            }))}
                            showValue={true}
                          />
                        </motion.div>
                      )}

                      {chartView === 'horizontal' && (
                        <motion.div
                          key="horizontal"
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          transition={{ duration: 0.3 }}
                        >
                          <AnimatedHorizontalBarChart
                            data={llmUsage.most_used.map(m => ({
                              label: formatModelName(m.model_id),
                              value: m.usage_count || 0,
                              color: 'linear-gradient(180deg, #FF8C61 0%, #FF6B35 100%)'
                            }))}
                            showValue={true}
                          />
                        </motion.div>
                      )}

                      {chartView === 'table' && (
                        <motion.div
                          key="table"
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -20 }}
                          transition={{ duration: 0.3 }}
                        >
                          <TableContainer>
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell><strong>Model</strong></TableCell>
                                  <TableCell align="right"><strong>Usage</strong></TableCell>
                                  <TableCell align="right"><strong>Cost</strong></TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {llmUsage.most_used.map((model, index) => (
                                  <TableRow key={index} hover>
                                    <TableCell>
                                      <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                                        {formatModelName(model.model_id)}
                                      </Typography>
                                    </TableCell>
                                    <TableCell align="right">
                                      <Chip label={model.usage_count} size="small" color="primary" />
                                    </TableCell>
                                    <TableCell align="right">{formatCost(model.total_cost ?? 0)}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </CardContent>
                </Card>
              </Grid>

              {/* Most Costly LLMs */}
              <Grid item xs={12} lg={6}>
                <Card sx={{ borderRadius: 2, minHeight: chartView === 'horizontal' ? 450 : 'auto' }}>
                  <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h6" fontWeight="600" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <AttachMoneyIcon color="error" />
                        Most Costly LLMs
                      </Typography>
                      <Chip
                        label="Total Cost"
                        size="small"
                        color="error"
                        variant="outlined"
                        sx={{ fontWeight: 600 }}
                      />
                    </Box>
                    <Divider sx={{ mb: 3 }} />

                    <AnimatePresence mode="wait">
                      {chartView === 'bar' && (
                        <motion.div
                          key="bar"
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          transition={{ duration: 0.3 }}
                        >
                          <Box>
                            {llmUsage.most_costly.map((model, index) => {
                              const avgCost = (model.total_cost ?? 0) / (model.usage_count ?? 1)
                              return (
                                <Box key={index} sx={{ mb: 3 }}>
                                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                    <Box>
                                      <Typography variant="body2" sx={{ fontSize: '0.75rem', fontWeight: 500 }}>
                                        {formatModelName(model.model_id)}
                                      </Typography>
                                      <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'warning.main' }}>
                                        Avg: {formatCost(avgCost)}/call
                                      </Typography>
                                    </Box>
                                    <Typography variant="body2" sx={{ fontSize: '0.75rem', fontWeight: 700, color: 'error.main' }}>
                                      {formatCost(model.total_cost || 0)}
                                    </Typography>
                                  </Box>
                                  <Box sx={{ position: 'relative', height: 32, backgroundColor: 'grey.100', borderRadius: 1, overflow: 'hidden' }}>
                                    <motion.div
                                      initial={{ width: 0 }}
                                      animate={{ width: `${((model.total_cost || 0) / Math.max(...llmUsage.most_costly.map(m => m.total_cost || 0))) * 100}%` }}
                                      transition={{ duration: 1, delay: index * 0.1, ease: 'easeOut' }}
                                      style={{
                                        height: '100%',
                                        background: 'linear-gradient(90deg, #D32F2F 0%, #EF5350 100%)',
                                        borderRadius: 4,
                                        display: 'flex',
                                        alignItems: 'center',
                                        paddingLeft: 12,
                                      }}
                                    >
                                      <motion.span
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ duration: 0.5, delay: index * 0.1 + 0.5 }}
                                        style={{ color: 'white', fontSize: '0.7rem', fontWeight: 600 }}
                                      >
                                        {model.usage_count} calls
                                      </motion.span>
                                    </motion.div>
                                  </Box>
                                </Box>
                              )
                            })}
                          </Box>
                        </motion.div>
                      )}

                      {chartView === 'horizontal' && (
                        <motion.div
                          key="horizontal"
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          transition={{ duration: 0.3 }}
                        >
                          <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 300 }}>
                            {llmUsage.most_costly.map((model, index) => {
                              const avgCost = (model.total_cost ?? 0) / (model.usage_count ?? 1)
                              const maxCost = Math.max(...llmUsage.most_costly.map(m => m.total_cost || 0))
                              const heightPercent = ((model.total_cost || 0) / maxCost) * 100

                              return (
                                <Box key={index} sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                  <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%' }}>
                                    <motion.div
                                      initial={{ opacity: 0, y: 10 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      transition={{ duration: 0.5, delay: index * 0.1 + 1 }}
                                    >
                                      <Typography variant="caption" fontWeight="700" color="error.main" sx={{ mb: 0.5, textAlign: 'center', display: 'block', fontSize: '0.7rem' }}>
                                        {formatCost(model.total_cost || 0)}
                                      </Typography>
                                      <Typography variant="caption" color="warning.main" sx={{ mb: 0.5, textAlign: 'center', display: 'block', fontSize: '0.6rem' }}>
                                        Avg: {formatCost(avgCost)}
                                      </Typography>
                                    </motion.div>
                                    <motion.div
                                      initial={{ height: 0 }}
                                      animate={{ height: `${heightPercent}%` }}
                                      transition={{ duration: 1, delay: index * 0.1, ease: 'easeOut' }}
                                      style={{
                                        width: '100%',
                                        background: 'linear-gradient(180deg, #EF5350 0%, #D32F2F 100%)',
                                        borderRadius: '8px 8px 0 0',
                                        minHeight: heightPercent > 0 ? 20 : 0,
                                      }}
                                    />
                                  </Box>
                                  <Typography variant="caption" sx={{ mt: 1, fontSize: '0.65rem', textAlign: 'center', wordBreak: 'break-word' }}>
                                    {formatModelName(model.model_id)}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem', textAlign: 'center' }}>
                                    {model.usage_count} calls
                                  </Typography>
                                </Box>
                              )
                            })}
                          </Box>
                        </motion.div>
                      )}

                      {chartView === 'table' && (
                        <motion.div
                          key="table"
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -20 }}
                          transition={{ duration: 0.3 }}
                        >
                          <TableContainer>
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell><strong>Model</strong></TableCell>
                                  <TableCell align="right"><strong>Total Cost</strong></TableCell>
                                  <TableCell align="right"><strong>Avg Cost/Call</strong></TableCell>
                                  <TableCell align="right"><strong>Calls</strong></TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {llmUsage.most_costly.map((model, index) => {
                                  const avgCost = (model.total_cost ?? 0) / (model.usage_count ?? 1)
                                  return (
                                    <TableRow key={index} hover>
                                      <TableCell>
                                        <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                                          {formatModelName(model.model_id)}
                                        </Typography>
                                      </TableCell>
                                      <TableCell align="right">
                                        <Typography variant="body2" fontWeight="600" color="error.main">
                                          {formatCost(model.total_cost ?? 0)}
                                        </Typography>
                                      </TableCell>
                                      <TableCell align="right">
                                        <Typography variant="body2" fontWeight="500" color="warning.main">
                                          {formatCost(avgCost)}
                                        </Typography>
                                      </TableCell>
                                      <TableCell align="right">{model.usage_count}</TableCell>
                                    </TableRow>
                                  )
                                })}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </CardContent>
                </Card>
              </Grid>

              {/* Slowest LLMs */}
              <Grid item xs={12} lg={6}>
                <Card sx={{ borderRadius: 2, minHeight: chartView === 'horizontal' ? 450 : 'auto' }}>
                  <CardContent sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom fontWeight="600" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <SpeedIcon color="warning" />
                      Slowest LLMs
                    </Typography>
                    <Divider sx={{ mb: 3 }} />

                    <AnimatePresence mode="wait">
                      {chartView === 'bar' && (
                        <motion.div
                          key="bar"
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          transition={{ duration: 0.3 }}
                        >
                          <AnimatedBarChart
                            data={llmUsage.slowest.map(m => ({
                              label: formatModelName(m.model_id),
                              value: m.avg_execution_time || 0,
                              color: 'linear-gradient(90deg, #F57C00 0%, #FF9800 100%)'
                            }))}
                            formatValue={formatTime}
                            showValue={true}
                          />
                        </motion.div>
                      )}

                      {chartView === 'horizontal' && (
                        <motion.div
                          key="horizontal"
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          transition={{ duration: 0.3 }}
                        >
                          <AnimatedHorizontalBarChart
                            data={llmUsage.slowest.map(m => ({
                              label: formatModelName(m.model_id),
                              value: m.avg_execution_time || 0,
                              color: 'linear-gradient(180deg, #FF9800 0%, #F57C00 100%)'
                            }))}
                            formatValue={formatTime}
                            showValue={true}
                          />
                        </motion.div>
                      )}

                      {chartView === 'table' && (
                        <motion.div
                          key="table"
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -20 }}
                          transition={{ duration: 0.3 }}
                        >
                          <TableContainer>
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell><strong>Model</strong></TableCell>
                                  <TableCell align="right"><strong>Avg Time</strong></TableCell>
                                  <TableCell align="right"><strong>Calls</strong></TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {llmUsage.slowest.map((model, index) => (
                                  <TableRow key={index} hover>
                                    <TableCell>
                                      <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                                        {formatModelName(model.model_id)}
                                      </Typography>
                                    </TableCell>
                                    <TableCell align="right">
                                      <Typography variant="body2" fontWeight="600" color="warning.main">
                                        {formatTime(model.avg_execution_time ?? 0)}
                                      </Typography>
                                    </TableCell>
                                    <TableCell align="right">{model.usage_count}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </CardContent>
                </Card>
              </Grid>

              {/* Fastest LLMs */}
              <Grid item xs={12} lg={6}>
                <Card sx={{ borderRadius: 2, minHeight: chartView === 'horizontal' ? 450 : 'auto' }}>
                  <CardContent sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom fontWeight="600" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <SpeedIcon color="success" />
                      Fastest LLMs
                    </Typography>
                    <Divider sx={{ mb: 3 }} />

                    <AnimatePresence mode="wait">
                      {chartView === 'bar' && (
                        <motion.div
                          key="bar"
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          transition={{ duration: 0.3 }}
                        >
                          <AnimatedBarChart
                            data={llmUsage.fastest.map(m => ({
                              label: formatModelName(m.model_id),
                              value: m.avg_execution_time || 0,
                              color: 'linear-gradient(90deg, #2E7D32 0%, #4CAF50 100%)'
                            }))}
                            formatValue={formatTime}
                            showValue={true}
                          />
                        </motion.div>
                      )}

                      {chartView === 'horizontal' && (
                        <motion.div
                          key="horizontal"
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          transition={{ duration: 0.3 }}
                        >
                          <AnimatedHorizontalBarChart
                            data={llmUsage.fastest.map(m => ({
                              label: formatModelName(m.model_id),
                              value: m.avg_execution_time || 0,
                              color: 'linear-gradient(180deg, #4CAF50 0%, #2E7D32 100%)'
                            }))}
                            formatValue={formatTime}
                            showValue={true}
                          />
                        </motion.div>
                      )}

                      {chartView === 'table' && (
                        <motion.div
                          key="table"
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -20 }}
                          transition={{ duration: 0.3 }}
                        >
                          <TableContainer>
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell><strong>Model</strong></TableCell>
                                  <TableCell align="right"><strong>Avg Time</strong></TableCell>
                                  <TableCell align="right"><strong>Calls</strong></TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {llmUsage.fastest.map((model, index) => (
                                  <TableRow key={index} hover>
                                    <TableCell>
                                      <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                                        {formatModelName(model.model_id)}
                                      </Typography>
                                    </TableCell>
                                    <TableCell align="right">
                                      <Typography variant="body2" fontWeight="600" color="success.main">
                                        {formatTime(model.avg_execution_time ?? 0)}
                                      </Typography>
                                    </TableCell>
                                    <TableCell align="right">{model.usage_count}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </motion.div>
        )}

        {/* Query Analytics Tab */}
        {activeTab === 1 && topQueries && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Grid container spacing={3}>
              {/* Most Costly Queries */}
              <Grid item xs={12}>
                <Card sx={{ borderRadius: 2 }}>
                  <CardContent sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom fontWeight="600" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <AttachMoneyIcon color="error" />
                      Most Costly Queries
                    </Typography>
                    <Divider sx={{ mb: 2 }} />
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell><strong>Table</strong></TableCell>
                            <TableCell><strong>SQL</strong></TableCell>
                            <TableCell align="right"><strong>Cost</strong></TableCell>
                            <TableCell align="right"><strong>Time</strong></TableCell>
                            <TableCell align="right"><strong>Tokens</strong></TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {topQueries.most_costly.map((query, index) => (
                            <TableRow key={index} hover>
                              <TableCell>
                                <Typography variant="body2" sx={{ fontSize: '0.7rem' }}>
                                  {query.catalog}.{query.schema_name}.{query.table_name}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" sx={{ fontSize: '0.7rem', fontFamily: 'monospace' }}>
                                  {truncateSQL(query.generated_sql)}
                                </Typography>
                              </TableCell>
                              <TableCell align="right">
                                <Typography variant="body2" fontWeight="600" color="error.main">
                                  {formatCost(query.total_cost_usd)}
                                </Typography>
                              </TableCell>
                              <TableCell align="right">{formatTime(query.total_time_ms)}</TableCell>
                              <TableCell align="right">{query.total_tokens.toLocaleString()}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              </Grid>

              {/* Slowest Queries (Total Time) */}
              <Grid item xs={12}>
                <Card sx={{ borderRadius: 2 }}>
                  <CardContent sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom fontWeight="600" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <SpeedIcon color="warning" />
                      Slowest Queries (Total Time)
                    </Typography>
                    <Divider sx={{ mb: 2 }} />
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell><strong>Table</strong></TableCell>
                            <TableCell><strong>SQL</strong></TableCell>
                            <TableCell align="right"><strong>Total Time</strong></TableCell>
                            <TableCell align="right"><strong>Cost</strong></TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {topQueries.slowest_total_time.map((query, index) => (
                            <TableRow key={index} hover>
                              <TableCell>
                                <Typography variant="body2" sx={{ fontSize: '0.7rem' }}>
                                  {query.catalog}.{query.schema_name}.{query.table_name}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" sx={{ fontSize: '0.7rem', fontFamily: 'monospace' }}>
                                  {truncateSQL(query.generated_sql)}
                                </Typography>
                              </TableCell>
                              <TableCell align="right">
                                <Typography variant="body2" fontWeight="600" color="warning.main">
                                  {formatTime(query.total_time_ms)}
                                </Typography>
                              </TableCell>
                              <TableCell align="right">{formatCost(query.total_cost_usd)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              </Grid>

              {/* Most Rows Returned */}
              <Grid item xs={12}>
                <Card sx={{ borderRadius: 2 }}>
                  <CardContent sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom fontWeight="600" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <QueryStatsIcon color="success" />
                      Queries with Most Rows Returned
                    </Typography>
                    <Divider sx={{ mb: 2 }} />
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell><strong>Table</strong></TableCell>
                            <TableCell><strong>SQL</strong></TableCell>
                            <TableCell align="right"><strong>Rows</strong></TableCell>
                            <TableCell align="right"><strong>Exec Time</strong></TableCell>
                            <TableCell align="right"><strong>Cost</strong></TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {topQueries.most_rows_returned.map((query, index) => (
                            <TableRow key={index} hover>
                              <TableCell>
                                <Typography variant="body2" sx={{ fontSize: '0.7rem' }}>
                                  {query.catalog}.{query.schema_name}.{query.table_name}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" sx={{ fontSize: '0.7rem', fontFamily: 'monospace' }}>
                                  {truncateSQL(query.generated_sql)}
                                </Typography>
                              </TableCell>
                              <TableCell align="right">
                                <Chip label={query.row_count?.toLocaleString()} size="small" color="success" />
                              </TableCell>
                              <TableCell align="right">{formatTime(query.sql_execution_time_ms ?? 0)}</TableCell>
                              <TableCell align="right">{formatCost(query.total_cost_usd)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </motion.div>
        )}
      </motion.div>
    </Container>
  )
}
