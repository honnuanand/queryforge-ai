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
import CallMergeIcon from '@mui/icons-material/CallMerge'
import { SvgIconComponent } from '@mui/icons-material'

interface NavigationItem {
  text: string
  icon: SvgIconComponent
  children?: Array<{ text: string; icon: SvgIconComponent }>
}

const navigationItems: NavigationItem[] = [
  { text: 'Dashboard', icon: DashboardIcon },
  {
    text: 'Query Generator',
    icon: CodeIcon,
    children: [
      { text: 'Single Table', icon: CodeIcon },
      { text: 'Join Query', icon: CallMergeIcon },
    ]
  },
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
  const [expandedAccordion, setExpandedAccordion] = useState<string | null>('Query Generator')

  const fetchLLMCosts = async () => {
    try {
      // Add timeout to prevent hanging
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout

      const response = await fetch('/api/llm-costs-by-model', {
        signal: controller.signal
      })
      clearTimeout(timeoutId)

      if (response.ok) {
        const data = await response.json()
        setLlmCosts(data)
      }
    } catch (error) {
      // Silently fail - this is a non-critical feature
      // Only log in development
      if (import.meta.env.MODE === 'development') {
        console.warn('LLM costs unavailable:', error instanceof Error ? error.message : 'Unknown error')
      }
      setLlmCosts(null)
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

          // If item has children, render as accordion (only when drawer is open)
          if (item.children && open) {
            const isAnyChildSelected = item.children.some(child => selectedPage === child.text)
            const isExpanded = expandedAccordion === item.text

            return (
              <Accordion
                key={item.text}
                expanded={isExpanded}
                onChange={() => setExpandedAccordion(isExpanded ? null : item.text)}
                disableGutters
                elevation={0}
                sx={{
                  bgcolor: 'transparent',
                  '&:before': { display: 'none' },
                  '& .MuiAccordionSummary-root': {
                    minHeight: 48,
                    px: 2.5,
                    '&:hover': {
                      bgcolor: 'action.hover',
                    },
                  },
                  '& .MuiAccordionDetails-root': {
                    p: 0,
                  },
                }}
              >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Icon color={isAnyChildSelected ? 'primary' : 'inherit'} sx={{ mr: 3 }} />
                    <Typography>{item.text}</Typography>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <List disablePadding>
                    {item.children.map((child) => {
                      const ChildIcon = child.icon
                      const isSelected = selectedPage === child.text

                      return (
                        <ListItem key={child.text} disablePadding>
                          <ListItemButton
                            selected={isSelected}
                            onClick={() => onSelectPage(child.text)}
                            sx={{
                              minHeight: 42,
                              pl: 7,
                              pr: 2.5,
                            }}
                          >
                            <ListItemIcon
                              sx={{
                                minWidth: 0,
                                mr: 2,
                                justifyContent: 'center',
                              }}
                            >
                              <ChildIcon color={isSelected ? 'primary' : 'inherit'} fontSize="small" />
                            </ListItemIcon>
                            <ListItemText
                              primary={child.text}
                              primaryTypographyProps={{
                                variant: 'body2',
                              }}
                            />
                          </ListItemButton>
                        </ListItem>
                      )
                    })}
                  </List>
                </AccordionDetails>
              </Accordion>
            )
          }

          // If item has children but drawer is collapsed, show parent icon only (clicking shows first child)
          if (item.children && !open) {
            const isAnyChildSelected = item.children.some(child => selectedPage === child.text)
            return (
              <ListItem key={item.text} disablePadding>
                <ListItemButton
                  selected={isAnyChildSelected}
                  onClick={() => onSelectPage(item.children![0].text)}
                  sx={{
                    minHeight: 48,
                    justifyContent: 'center',
                    px: 2.5,
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: 0,
                      mr: 'auto',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon color={isAnyChildSelected ? 'primary' : 'inherit'} />
                  </ListItemIcon>
                </ListItemButton>
              </ListItem>
            )
          }

          // Regular item without children
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
