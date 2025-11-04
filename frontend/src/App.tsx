import { useState } from 'react'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import Box from '@mui/material/Box'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Button from '@mui/material/Button'
import MenuIcon from '@mui/icons-material/Menu'
import ApiIcon from '@mui/icons-material/Api'
import GitHubIcon from '@mui/icons-material/GitHub'
import Link from '@mui/material/Link'
import NavigationDrawer from './components/NavigationDrawer'
import MainContent from './components/MainContent'

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#FF6B35', // Vibrant orange
      light: '#FF8C61',
      dark: '#E55A2B',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#004E89', // Deep blue for contrast
      light: '#1A6BA8',
      dark: '#003C6C',
      contrastText: '#ffffff',
    },
    success: {
      main: '#2E7D32',
      light: '#4CAF50',
      dark: '#1B5E20',
    },
    warning: {
      main: '#F57C00',
      light: '#FF9800',
      dark: '#E65100',
    },
    error: {
      main: '#D32F2F',
      light: '#EF5350',
      dark: '#C62828',
    },
    background: {
      default: '#FAFAFA',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#212121',
      secondary: '#616161',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 700,
    },
    h5: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        },
      },
    },
  },
})

const DRAWER_WIDTH = 240
const DRAWER_WIDTH_COLLAPSED = 65

function App() {
  const [drawerOpen, setDrawerOpen] = useState(true)
  const [selectedPage, setSelectedPage] = useState('Dashboard')

  const handleDrawerToggle = () => {
    setDrawerOpen(!drawerOpen)
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex' }}>
        <AppBar
          position="fixed"
          sx={{
            zIndex: (theme) => theme.zIndex.drawer + 1,
            background: 'linear-gradient(135deg, #FF6B35 0%, #F57C00 50%, #FF8C61 100%)',
            boxShadow: '0 4px 12px rgba(255, 107, 53, 0.3)',
          }}
        >
          <Toolbar>
            <IconButton
              color="inherit"
              aria-label="toggle drawer"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
            <Typography
              variant="h6"
              noWrap
              component="div"
              sx={{
                flexGrow: 1,
                fontWeight: 700,
                letterSpacing: 0.5,
                cursor: 'pointer',
                '&:hover': {
                  opacity: 0.8
                }
              }}
              onClick={() => setSelectedPage('Dashboard')}
            >
              QueryForge AI
            </Typography>
            <Button
              color="inherit"
              startIcon={<ApiIcon />}
              href="/docs"
              target="_blank"
              rel="noopener noreferrer"
            >
              API Docs
            </Button>
          </Toolbar>
        </AppBar>

        <NavigationDrawer
          open={drawerOpen}
          width={DRAWER_WIDTH}
          collapsedWidth={DRAWER_WIDTH_COLLAPSED}
          selectedPage={selectedPage}
          onSelectPage={setSelectedPage}
        />

        <Box
          component="main"
          sx={{
            flexGrow: 1,
            display: 'flex',
            flexDirection: 'column',
            minHeight: '100vh',
            width: { sm: `calc(100% - ${drawerOpen ? DRAWER_WIDTH : DRAWER_WIDTH_COLLAPSED}px)` },
            ml: { sm: `${drawerOpen ? DRAWER_WIDTH : DRAWER_WIDTH_COLLAPSED}px` },
            transition: (theme) =>
              theme.transitions.create(['margin', 'width'], {
                easing: theme.transitions.easing.sharp,
                duration: theme.transitions.duration.leavingScreen,
              }),
          }}
        >
          <Toolbar />
          <Box sx={{ flexGrow: 1, p: 3 }}>
            <MainContent selectedPage={selectedPage} />
          </Box>

          {/* Footer */}
          <Box
            component="footer"
            sx={{
              py: 2,
              px: 3,
              mt: 'auto',
              backgroundColor: (theme) => theme.palette.grey[100],
              borderTop: '1px solid',
              borderColor: (theme) => theme.palette.grey[300],
            }}
          >
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 2,
                flexWrap: 'wrap',
              }}
            >
              <Typography variant="body2" color="text.secondary">
                Developed by Anand Rao
              </Typography>
              <Typography variant="body2" color="text.secondary">
                •
              </Typography>
              <Link
                href="https://github.com/honnuanand/queryforge-ai"
                target="_blank"
                rel="noopener noreferrer"
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  color: 'text.secondary',
                  textDecoration: 'none',
                  '&:hover': {
                    color: 'primary.main',
                    textDecoration: 'underline',
                  },
                }}
              >
                <GitHubIcon fontSize="small" />
                <Typography variant="body2">
                  View on GitHub
                </Typography>
              </Link>
              <Typography variant="body2" color="text.secondary">
                •
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Built with React, FastAPI & Databricks
              </Typography>
            </Box>
          </Box>
        </Box>
      </Box>
    </ThemeProvider>
  )
}

export default App
