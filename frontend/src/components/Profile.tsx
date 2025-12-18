import { useState, useEffect } from 'react'
import {
  Box,
  Paper,
  Typography,
  CircularProgress,
  Alert,
  Chip,
  Divider,
} from '@mui/material'
import {
  Person as PersonIcon,
  Security as SecurityIcon,
  Cloud as CloudIcon,
  Storage as StorageIcon,
} from '@mui/icons-material'

interface ProfileData {
  auth_method: string
  current_user: string | null
  forwarded_email: string | null
  forwarded_user: string | null
  has_obo_token: boolean
  databricks_host: string
  databricks_catalog: string
  databricks_schema: string
}

export default function Profile() {
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await fetch('/api/profile')
        if (!response.ok) {
          throw new Error('Failed to fetch profile')
        }
        const data = await response.json()
        setProfile(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load profile')
      } finally {
        setLoading(false)
      }
    }

    fetchProfile()
  }, [])

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    )
  }

  if (!profile) {
    return null
  }

  return (
    <Box sx={{ p: 3, maxWidth: 800 }}>
      <Typography variant="h4" sx={{ mb: 3, fontWeight: 700 }}>
        User Profile
      </Typography>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <SecurityIcon color="primary" />
          <Typography variant="h6">Authentication</Typography>
          <Chip
            label={profile.auth_method === 'obo' ? 'On-Behalf-Of (OBO)' : 'Service Principal'}
            color={profile.auth_method === 'obo' ? 'success' : 'warning'}
            size="small"
          />
        </Box>
        <Divider sx={{ mb: 2 }} />

        <Box sx={{ display: 'grid', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <PersonIcon color="action" />
            <Box>
              <Typography variant="body2" color="text.secondary">
                Current User (Databricks Identity)
              </Typography>
              <Typography variant="body1" fontWeight={600}>
                {profile.current_user || 'Unknown'}
              </Typography>
            </Box>
          </Box>

          {profile.forwarded_email && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <PersonIcon color="action" />
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Forwarded Email
                </Typography>
                <Typography variant="body1" fontWeight={600}>
                  {profile.forwarded_email}
                </Typography>
              </Box>
            </Box>
          )}

          {profile.forwarded_user && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <PersonIcon color="action" />
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Forwarded User
                </Typography>
                <Typography variant="body1" fontWeight={600}>
                  {profile.forwarded_user}
                </Typography>
              </Box>
            </Box>
          )}

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <SecurityIcon color="action" />
            <Box>
              <Typography variant="body2" color="text.secondary">
                OBO Token Present
              </Typography>
              <Chip
                label={profile.has_obo_token ? 'Yes' : 'No'}
                color={profile.has_obo_token ? 'success' : 'default'}
                size="small"
              />
            </Box>
          </Box>
        </Box>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <CloudIcon color="primary" />
          <Typography variant="h6">Databricks Connection</Typography>
        </Box>
        <Divider sx={{ mb: 2 }} />

        <Box sx={{ display: 'grid', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <CloudIcon color="action" />
            <Box>
              <Typography variant="body2" color="text.secondary">
                Workspace Host
              </Typography>
              <Typography variant="body1" fontWeight={600} sx={{ wordBreak: 'break-all' }}>
                {profile.databricks_host}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <StorageIcon color="action" />
            <Box>
              <Typography variant="body2" color="text.secondary">
                Default Catalog
              </Typography>
              <Typography variant="body1" fontWeight={600}>
                {profile.databricks_catalog}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <StorageIcon color="action" />
            <Box>
              <Typography variant="body2" color="text.secondary">
                Default Schema
              </Typography>
              <Typography variant="body1" fontWeight={600}>
                {profile.databricks_schema}
              </Typography>
            </Box>
          </Box>
        </Box>
      </Paper>

      {profile.auth_method !== 'obo' && (
        <Alert severity="info" sx={{ mt: 3 }}>
          <strong>Note:</strong> You are currently authenticated using a service principal token.
          When deployed to Databricks Apps with OBO enabled, queries will run with your personal identity
          and permissions.
        </Alert>
      )}
    </Box>
  )
}
