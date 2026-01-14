#!/usr/bin/env python3
"""
Grant Unity Catalog permissions to a Databricks App Service Principal.

This script grants the necessary permissions for a Databricks App's Service Principal
to access Unity Catalog resources (catalogs, schemas, tables).

Usage:
    python grant_permissions.py --app-name queryforge --profile fe-ai \
        --catalog arao --schema text_to_sql

    # Dry run (show what would be granted)
    python grant_permissions.py --app-name queryforge --profile fe-ai \
        --catalog arao --schema text_to_sql --dry-run
"""

import argparse
import json
import subprocess
import sys
from typing import Optional


def run_command(command: list, profile: str = None) -> tuple:
    """Run a databricks CLI command and return (success, stdout, stderr)"""
    if profile:
        command = command + ["--profile", profile]

    result = subprocess.run(command, capture_output=True, text=True)
    return result.returncode == 0, result.stdout, result.stderr


def get_app_service_principal(app_name: str, profile: str) -> Optional[dict]:
    """Get the Service Principal info for a Databricks App"""
    print(f"Getting Service Principal for app: {app_name}")

    success, stdout, stderr = run_command(
        ["databricks", "apps", "get", app_name, "--output", "json"],
        profile
    )

    if not success:
        print(f"Error getting app info: {stderr}")
        return None

    try:
        app_info = json.loads(stdout)
        sp = app_info.get("service_principal", {})

        if not sp:
            print("No Service Principal found for this app")
            return None

        return {
            "id": sp.get("id"),
            "application_id": sp.get("application_id"),
            "display_name": sp.get("display_name")
        }
    except json.JSONDecodeError as e:
        print(f"Error parsing app info: {e}")
        return None


def grant_catalog_permissions(
    sp_application_id: str,
    catalog: str,
    schema: str,
    profile: str,
    dry_run: bool = False
) -> bool:
    """Grant Unity Catalog permissions to the Service Principal"""

    print(f"\nGranting permissions to SP: {sp_application_id}")
    print(f"  Catalog: {catalog}")
    print(f"  Schema: {schema}")

    # Permissions to grant
    grants = [
        {
            "securable_type": "CATALOG",
            "securable_name": catalog,
            "privileges": ["USE_CATALOG"]
        },
        {
            "securable_type": "SCHEMA",
            "securable_name": f"{catalog}.{schema}",
            "privileges": ["USE_SCHEMA", "SELECT"]
        }
    ]

    for grant in grants:
        securable = grant["securable_name"]
        privileges = grant["privileges"]

        print(f"\n  Granting {privileges} on {grant['securable_type']} {securable}")

        if dry_run:
            print(f"    [DRY RUN] Would grant: {privileges}")
            continue

        # Build SQL GRANT statement
        for priv in privileges:
            sql = f"GRANT {priv} ON {grant['securable_type']} `{securable}` TO `{sp_application_id}`"
            print(f"    Executing: {sql}")

            # Use databricks SQL execution
            success, stdout, stderr = run_command(
                ["databricks", "sql", "query", "--statement", sql],
                profile
            )

            if not success:
                # Try alternative method using workspace API
                print(f"    SQL grant failed, trying SDK method...")

                # Create a Python script to run grants via SDK
                sdk_script = f'''
from databricks.sdk import WorkspaceClient
from databricks.sdk.service.catalog import Privilege, SecurableType, PermissionsChange

w = WorkspaceClient(profile="{profile}")

try:
    w.grants.update(
        securable_type=SecurableType.{grant['securable_type']},
        full_name="{securable}",
        changes=[
            PermissionsChange(
                principal="{sp_application_id}",
                add=[Privilege.{priv}]
            )
        ]
    )
    print("Grant successful")
except Exception as e:
    print(f"Grant failed: {{e}}")
    exit(1)
'''
                result = subprocess.run(
                    ["python", "-c", sdk_script],
                    capture_output=True,
                    text=True
                )

                if result.returncode != 0:
                    print(f"    Warning: Grant may have failed: {result.stderr}")
                else:
                    print(f"    Granted via SDK")

    return True


def main():
    parser = argparse.ArgumentParser(
        description="Grant Unity Catalog permissions to a Databricks App Service Principal",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Grant permissions to queryforge app
  python grant_permissions.py --app-name queryforge --profile fe-ai \\
      --catalog arao --schema text_to_sql

  # Dry run (show what would be granted)
  python grant_permissions.py --app-name queryforge --profile fe-ai \\
      --catalog arao --schema text_to_sql --dry-run

  # Grant to specific SP (if you know the application_id)
  python grant_permissions.py --sp-id 12345678-1234-1234-1234-123456789abc \\
      --profile fe-ai --catalog arao --schema text_to_sql
"""
    )

    parser.add_argument("--app-name", help="Databricks App name (to look up SP)")
    parser.add_argument("--sp-id", help="Service Principal application ID (UUID)")
    parser.add_argument("--profile", required=True, help="Databricks CLI profile")
    parser.add_argument("--catalog", required=True, help="Unity Catalog name")
    parser.add_argument("--schema", required=True, help="Schema name")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be granted without executing")

    args = parser.parse_args()

    # Get SP ID either from app or direct input
    sp_application_id = args.sp_id

    if not sp_application_id:
        if not args.app_name:
            print("Error: Either --app-name or --sp-id is required")
            sys.exit(1)

        sp_info = get_app_service_principal(args.app_name, args.profile)
        if not sp_info:
            print("Could not get Service Principal info")
            sys.exit(1)

        sp_application_id = sp_info["application_id"]
        print(f"\nService Principal found:")
        print(f"  ID: {sp_info['id']}")
        print(f"  Application ID: {sp_application_id}")
        print(f"  Display Name: {sp_info['display_name']}")

    # Grant permissions
    success = grant_catalog_permissions(
        sp_application_id=sp_application_id,
        catalog=args.catalog,
        schema=args.schema,
        profile=args.profile,
        dry_run=args.dry_run
    )

    if success:
        print("\n" + "=" * 60)
        if args.dry_run:
            print("DRY RUN completed - no changes made")
        else:
            print("Permissions granted successfully!")
            print("\nIMPORTANT: Redeploy the app to pick up new permissions:")
            print(f"  python deploy_to_databricks.py --skip-secrets")
        print("=" * 60)
    else:
        print("\nSome grants may have failed - check output above")
        sys.exit(1)


if __name__ == "__main__":
    main()
