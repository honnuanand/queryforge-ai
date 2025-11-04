import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'
import Drawer from '@mui/material/Drawer'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Toolbar from '@mui/material/Toolbar'
import Accordion from '@mui/material/Accordion'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import DashboardIcon from '@mui/icons-material/Dashboard'
import CodeIcon from '@mui/icons-material/Code'
import AnalyticsIcon from '@mui/icons-material/Analytics'
import HistoryIcon from '@mui/icons-material/History'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import AttachMoneyIcon from '@mui/icons-material/AttachMoney'
import { SvgIconComponent } from '@mui/icons-material'

interface NavigationItem {
  text: string
  icon: SvgIconComponent
}

const navigationItems: NavigationItem[] = [
  { text: 'Dashboard', icon: DashboardIcon },
  { text: 'SQL Generator', icon: CodeIcon },
  { text: 'Query History', icon: HistoryIcon },
  { text: 'Analytics', icon: AnalyticsIcon },
  // { text: 'Reports', icon: AssessmentIcon },
  // { text: 'Settings', icon: SettingsIcon },
]

interface NavigationDrawerProps {
  open: boolean
  width: number
  collapsedWidth: number
  selectedPage: string
  onSelectPage: (page: string) => void
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

export default function NavigationDrawer({
  open,
  width,
  collapsedWidth,
  selectedPage,
  onSelectPage,
}: NavigationDrawerProps) {
  const [llmCosts, setLlmCosts] = useState<LLMCostData | null>(null)

  const fetchLLMCosts = async () => {
    try {
      const response = await fetch('/api/llm-costs-by-model')
      if (response.ok) {
        const data = await response.json()
        setLlmCosts(data)
      }
    } catch (error) {
      console.error('Failed to fetch LLM costs:', error)
    }
  }

  useEffect(() => {
    fetchLLMCosts()
    // Refresh every 30 seconds
    const interval = setInterval(fetchLLMCosts, 30000)
    return () => clearInterval(interval)
  }, [])

  const formatCost = (cost: number) => {
    return `$${cost.toFixed(6)}`
  }

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: open ? width : collapsedWidth,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: open ? width : collapsedWidth,
          boxSizing: 'border-box',
          transition: (theme) =>
            theme.transitions.create('width', {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.enteringScreen,
            }),
          overflowX: 'hidden',
        },
      }}
    >
      <Toolbar />
      <List>
        {navigationItems.map((item) => {
          const Icon = item.icon
          const isSelected = selectedPage === item.text

          return (
            <ListItem key={item.text} disablePadding>
              <ListItemButton
                selected={isSelected}
                onClick={() => onSelectPage(item.text)}
                sx={{
                  minHeight: 48,
                  justifyContent: open ? 'initial' : 'center',
                  px: 2.5,
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 0,
                    mr: open ? 3 : 'auto',
                    justifyContent: 'center',
                  }}
                >
                  <Icon color={isSelected ? 'primary' : 'inherit'} />
                </ListItemIcon>
                <motion.div
                  initial={false}
                  animate={{
                    opacity: open ? 1 : 0,
                    width: open ? 'auto' : 0,
                  }}
                  transition={{
                    duration: 0.2,
                    ease: 'easeInOut',
                  }}
                  style={{ overflow: 'hidden' }}
                >
                  <ListItemText
                    primary={item.text}
                    sx={{
                      opacity: open ? 1 : 0,
                      whiteSpace: 'nowrap',
                    }}
                  />
                </motion.div>
              </ListItemButton>
            </ListItem>
          )
        })}
      </List>

      {/* LLM Cost Meter */}
      <Box sx={{ mt: 'auto', p: 2 }}>
        {llmCosts && (
          <Accordion
            sx={{
              boxShadow: 2,
              '&:before': { display: 'none' },
            }}
          >
            <AccordionSummary
              expandIcon={open ? <ExpandMoreIcon /> : null}
              sx={{ minHeight: 48 }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                <AttachMoneyIcon color="success" fontSize="small" />
                {open && (
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="caption" color="text.secondary" display="block">
                      LLM Costs
                    </Typography>
                    <Typography variant="h6" fontWeight="700" color="success.main">
                      {formatCost(llmCosts.total_cost)}
                    </Typography>
                  </Box>
                )}
              </Box>
            </AccordionSummary>
            {open && (
              <AccordionDetails sx={{ pt: 0 }}>
                <Divider sx={{ mb: 2 }} />
                {llmCosts.models.map((model) => (
                  <Box key={model.model_id} sx={{ mb: 2 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', wordBreak: 'break-all' }}>
                      {model.model_id}
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                      <Typography variant="body2" fontWeight="600">
                        {formatCost(model.total_cost)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {model.call_count} calls
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">
                        Prompt: {model.total_prompt_tokens?.toLocaleString() || 0}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Completion: {model.total_completion_tokens?.toLocaleString() || 0}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </AccordionDetails>
            )}
          </Accordion>
        )}
      </Box>
    </Drawer>
  )
}
