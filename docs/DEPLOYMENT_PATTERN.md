# Databricks Apps Portable Deployment Pattern

## Overview

This document describes a portable deployment pattern for Databricks Apps that supports multiple environments, profiles, and easy configuration management. The pattern was adopted from the [lemma project](https://github.com/databricks-field-eng/lemma) `feature/portable-deployment-system` branch.

## Source Pattern

**Original Repository:** `databricks-field-eng/lemma`
**Branch:** `feature/portable-deployment-system`
**Local Reference:** `/Users/anand.rao/repos/fe-ai/lemma-dev/lemma-console`

### Key Concepts from Lemma

1. **Deployment metadata in app.yaml** - Store deployment-specific configuration (app name, profile) in the same file as runtime config
2. **Profile-based authentication** - Use Databricks CLI profiles for multi-workspace support
3. **Config file selection** - Support multiple config files for different environments
4. **Metadata stripping** - Remove deployment metadata before uploading to Databricks

## Pattern Implementation

### 1. app.yaml Structure

```yaml
# Deployment metadata (used by deploy script, removed before deployment)
deployment:
  app_name: "your-app-name"           # Databricks App name
  profile: "your-databricks-profile"  # ~/.databrickscfg profile

command: ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]

env:
  - name: ENV
    value: "production"
  # ... other environment variables
```

### 2. Deploy Script Features

The `deploy_to_databricks.py` script provides:

| Feature | Flag | Description |
|---------|------|-------------|
| Profile support | `--profile` | Use specific Databricks CLI profile |
| Config selection | `--config` | Use specific config file (e.g., `app.yaml.prod`) |
| Skip secrets | `--skip-secrets` | Skip secrets setup for redeployments |
| Hard redeploy | `--hard-redeploy` | Delete and recreate the app |
| App name override | `--app-name` | Override app name from config |

### 3. Priority Resolution

App name is resolved in this order (highest to lowest):
1. `--app-name` CLI argument
2. `DATABRICKS_APP_NAME` environment variable
3. `deployment.app_name` in app.yaml

### 4. Multi-Environment Support

Create environment-specific configs:
```
app.yaml           # Default/dev config
app.yaml.dev       # Development
app.yaml.stage     # Staging
app.yaml.prod      # Production
```

Deploy to specific environment:
```bash
python deploy_to_databricks.py --config app.yaml.prod --skip-secrets
```

## File Structure

```
project/
├── app.yaml                    # Main config with deployment metadata
├── app.yaml.template           # Template for new environments
├── deploy_to_databricks.py     # Deployment script
├── DEPLOY.md                   # Quick start guide
├── docs/
│   └── DEPLOYMENT_PATTERN.md   # This document
├── scripts/
│   └── grant_permissions.py    # Unity Catalog grants script
├── backend/
│   ├── app.py
│   ├── requirements.txt
│   └── static/                 # Built frontend (generated)
└── frontend/
    ├── src/
    └── dist/                   # Build output
```

## Deployment Workflow

### First-Time Deployment

```bash
# 1. Copy and configure app.yaml
cp app.yaml.template app.yaml
# Edit app.yaml with your values

# 2. Deploy (will prompt for secrets)
python deploy_to_databricks.py

# 3. Grant SP permissions
python scripts/grant_permissions.py \
    --app-name your-app \
    --profile your-profile \
    --catalog your_catalog \
    --schema your_schema
```

### Subsequent Deployments

```bash
# Standard redeploy (secrets already configured)
python deploy_to_databricks.py --skip-secrets

# Hard redeploy (if app is stuck)
python deploy_to_databricks.py --hard-redeploy --skip-secrets
```

## Key Code Patterns

### Reading Deployment Metadata from YAML

```python
import yaml

def _load_config_from_yaml(self):
    """Load app_name and profile from app.yaml deployment section"""
    config_path = os.path.join(self.project_root, self.config_file)

    if os.path.exists(config_path):
        with open(config_path, 'r') as f:
            config = yaml.safe_load(f)

        deployment = config.get('deployment', {})

        # Only use config values if not overridden by CLI
        if not self.app_name and deployment.get('app_name'):
            self.app_name = deployment['app_name']

        if not self.profile and deployment.get('profile'):
            self.profile = deployment['profile']
```

### Adding Profile to Databricks Commands

```python
def run_command(self, command: list, use_profile: bool = True):
    """Run command with optional profile flag"""
    if use_profile and command[0] == "databricks" and self.profile:
        command = command + ["--profile", self.profile]

    result = subprocess.run(command, capture_output=True, text=True)
    return result.returncode, result.stdout, result.stderr
```

### Stripping Deployment Metadata Before Upload

```python
def package_backend(self):
    """Package backend, removing deployment metadata"""
    with open(app_yaml_src, 'r') as f:
        config = yaml.safe_load(f)

    # Remove deployment metadata (only used by this script)
    if 'deployment' in config:
        del config['deployment']

    with open(app_yaml_dst, 'w') as f:
        yaml.dump(config, f, default_flow_style=False)
```

## Service Principal Permissions

Databricks Apps use Service Principals. Grant access via:

```bash
python scripts/grant_permissions.py \
    --app-name your-app \
    --profile your-profile \
    --catalog your_catalog \
    --schema your_schema \
    --dry-run  # Preview changes first
```

Or manually via SQL:
```sql
GRANT USE_CATALOG ON CATALOG `your_catalog` TO `SP_APPLICATION_ID`;
GRANT USE_SCHEMA ON SCHEMA `your_catalog.your_schema` TO `SP_APPLICATION_ID`;
GRANT SELECT ON SCHEMA `your_catalog.your_schema` TO `SP_APPLICATION_ID`;
```

## Adapting This Pattern

To use this pattern in another project:

1. **Copy these files:**
   - `deploy_to_databricks.py`
   - `app.yaml.template`
   - `scripts/grant_permissions.py`
   - `DEPLOY.md`

2. **Update app.yaml.template** with your app's environment variables

3. **Modify deploy script** if needed:
   - Update `exclude_patterns` for your file structure
   - Adjust `required_secrets` list
   - Change frontend/backend paths if different

4. **Install dependencies:**
   ```bash
   pip install pyyaml
   ```

## References

- **Lemma Repository:** https://github.com/databricks-field-eng/lemma
- **Branch:** `feature/portable-deployment-system`
- **Databricks Apps Docs:** https://docs.databricks.com/dev-tools/databricks-apps/index.html
- **Databricks CLI:** https://docs.databricks.com/dev-tools/cli/index.html
