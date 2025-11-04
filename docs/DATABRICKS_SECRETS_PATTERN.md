# Databricks Apps Secret Scope Pattern

## Problem

When deploying a Databricks App that needs to access secrets from Databricks Secret Scopes, the secret template syntax `value: "{{secrets/scope/key}}"` does NOT work. The template is passed as a literal string to the application instead of being resolved to the actual secret value.

### Symptoms
- Backend throws `RuntimeError: No valid authentication settings!`
- Environment variables contain literal strings like `"{{secrets/queryforge/databricks-token}}"` instead of actual token values
- App cannot connect to Databricks SQL warehouse or other services requiring authentication

## Solution

Use the `valueFrom:` syntax instead of `value:` with template strings.

### Incorrect Syntax (Does NOT Work)
```yaml
env:
  - name: DATABRICKS_TOKEN
    value: "{{secrets/queryforge/databricks-token}}"
```

### Correct Syntax (Works)
```yaml
env:
  - name: DATABRICKS_TOKEN
    valueFrom: queryforge/databricks-token
```

## Pattern Format

```yaml
env:
  - name: ENV_VAR_NAME
    valueFrom: scope-name/secret-key
```

Where:
- `scope-name` is the Databricks secret scope name
- `secret-key` is the key of the secret within that scope
- No quotes, no curly braces, just the path format: `scope-name/secret-key`

## Complete Example

### app.yaml (Correct)
```yaml
command: ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]

env:
  - name: ENV
    value: "production"
  - name: PORT
    value: "8000"
  - name: DATABRICKS_HOST
    value: "https://fe-vm-leaps-fe.cloud.databricks.com"
  - name: DATABRICKS_TOKEN
    valueFrom: queryforge/databricks-token  # ✅ Correct
  - name: DATABRICKS_CATALOG
    value: "arao"
  - name: DATABRICKS_SCHEMA
    value: "text_to_sql"
```

## Reference Implementation

This pattern is used successfully in:
- `metadata-manager` project (see `deploy_to_databricks.py` lines 433-436)
- `hackathon-hive` project

Example from metadata-manager:
```python
f.write('  - name: DATABRICKS_HOST\n')
f.write('    valueFrom: metadata-manager-secrets/databricks-host\n')
f.write('  - name: DATABRICKS_TOKEN\n')
f.write('    valueFrom: metadata-manager-secrets/databricks-token\n')
```

## Prerequisites

1. Create the secret scope:
```bash
databricks secrets create-scope <scope-name>
```

2. Add secrets to the scope:
```bash
databricks secrets put-secret <scope-name> <secret-key> --string-value "<secret-value>"
```

Example:
```bash
databricks secrets create-scope queryforge
databricks secrets put-secret queryforge databricks-token --string-value "dapi..."
```

3. Grant service principal permissions (if needed):
```bash
GRANT USAGE ON CATALOG <catalog> TO `<service-principal-uuid>`
GRANT USAGE ON SCHEMA <catalog>.<schema> TO `<service-principal-uuid>`
GRANT SELECT ON TABLE <catalog>.<schema>.<table> TO `<service-principal-uuid>`
```

Note: Use service principal UUID, not display name.

## Deployment

After updating `app.yaml`:

1. Copy app.yaml to backend:
```bash
cp app.yaml backend/
```

2. Import to workspace:
```bash
databricks workspace import-dir backend /Workspace/Users/<user-email>/<app-name> --overwrite
```

3. Deploy app:
```bash
databricks apps deploy <app-name> --source-code-path /Workspace/Users/<user-email>/<app-name>
```

## Verification

After deployment, check app logs to ensure:
- No "No valid authentication settings!" errors
- Backend successfully connects to Databricks services
- Environment variables contain actual secret values (not template strings)

Check deployment status:
```bash
databricks apps get <app-name>
```

## Summary

**Always use `valueFrom:` for secret references in Databricks Apps app.yaml.**
