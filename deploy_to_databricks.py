#!/usr/bin/env python3
"""
Databricks Deployment Script for QueryForge AI Application
Handles CLI setup, secrets management, scope selection, and app deployment

Usage:
    # Deploy using config from app.yaml
    python deploy_to_databricks.py --skip-secrets

    # Deploy to specific environment
    python deploy_to_databricks.py --config app.yaml.prod --skip-secrets

    # Override app name and profile
    python deploy_to_databricks.py --app-name my-app --profile my-profile --skip-secrets

    # Hard redeploy (delete and recreate)
    python deploy_to_databricks.py --hard-redeploy --skip-secrets
"""

import os
import sys
import json
import subprocess
import getpass
import secrets
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass
import argparse
import fnmatch
import shutil
import time
import yaml

@dataclass
class SecretConfig:
    """Configuration for a secret"""
    key: str
    value: str
    description: str

@dataclass
class ScopeInfo:
    """Information about a Databricks scope"""
    name: str
    owner: str
    created_at: str
    secret_count: int

class DatabricksDeployer:
    def __init__(self, profile: str = None, app_name: str = None, config_file: str = None):
        self.workspace_url = None
        self.token = None
        self.user_email = None
        self.app_name = app_name
        self.app_folder = None
        self.profile = profile
        self.config_file = config_file or "app.yaml"

        # Detect project structure
        self.script_dir = os.path.dirname(os.path.abspath(__file__))
        self.project_root = self._find_project_root()
        self.backend_dir = os.path.join(self.project_root, "backend")
        self.frontend_dir = os.path.join(self.project_root, "frontend")

        # Load configuration from app.yaml if not overridden
        self._load_config_from_yaml()

        # Auto-detect workspace info
        self._auto_detect_workspace_info()

        # Required secrets for the application
        self.required_secrets = [
            SecretConfig("databricks-token", "", "Databricks personal access token"),
        ]

        # Selected scope for environment references
        self.selected_scope = None

    def _find_project_root(self) -> str:
        """Find project root by looking for app.yaml or frontend directory"""
        # Check if script is in root or backend
        if os.path.exists(os.path.join(self.script_dir, "frontend")):
            return self.script_dir
        elif os.path.exists(os.path.join(os.path.dirname(self.script_dir), "frontend")):
            return os.path.dirname(self.script_dir)
        else:
            return self.script_dir

    def _load_config_from_yaml(self):
        """Load app_name and profile from app.yaml deployment section"""
        config_path = os.path.join(self.project_root, self.config_file)

        if not os.path.exists(config_path):
            # Try backend directory
            config_path = os.path.join(self.backend_dir, self.config_file)

        if os.path.exists(config_path):
            try:
                with open(config_path, 'r') as f:
                    config = yaml.safe_load(f)

                deployment = config.get('deployment', {})

                # Only use config values if not overridden by CLI
                if not self.app_name and deployment.get('app_name'):
                    self.app_name = deployment['app_name']
                    print(f"📋 Using app_name from {self.config_file}: {self.app_name}")

                if not self.profile and deployment.get('profile'):
                    self.profile = deployment['profile']
                    print(f"📋 Using profile from {self.config_file}: {self.profile}")

            except Exception as e:
                print(f"⚠️  Warning: Could not parse {self.config_file}: {e}")

        # Check environment variable as fallback
        if not self.app_name:
            self.app_name = os.environ.get('DATABRICKS_APP_NAME')
            if self.app_name:
                print(f"📋 Using app_name from DATABRICKS_APP_NAME env var: {self.app_name}")

        # Final validation
        if not self.app_name:
            print("❌ ERROR: app_name is required!")
            print("   Provide via:")
            print("     1. --app-name CLI argument")
            print("     2. deployment.app_name in app.yaml")
            print("     3. DATABRICKS_APP_NAME environment variable")
            sys.exit(1)

        # Default profile if not set
        if not self.profile:
            self.profile = "default"

    def _auto_detect_workspace_info(self):
        """Auto-detect workspace URL and user email from Databricks CLI"""
        try:
            # Get workspace URL from CLI config
            exit_code, stdout, stderr = self.run_command(["databricks", "config", "get", "host"])
            if exit_code == 0 and stdout.strip():
                self.workspace_url = stdout.strip()

            # Get current user email
            exit_code, stdout, stderr = self.run_command(["databricks", "current-user", "me", "--output", "json"])
            if exit_code == 0 and stdout.strip():
                try:
                    user_info = json.loads(stdout)
                    self.user_email = user_info.get("userName") or user_info.get("user_name")

                    # Set app_folder using detected user email
                    if self.user_email and not self.app_folder:
                        self.app_folder = f"/Workspace/Users/{self.user_email}/{self.app_name}"
                except json.JSONDecodeError:
                    pass

            # Fallback if app_folder not set
            if not self.app_folder:
                self.app_folder = f"/Workspace/Users/YOUR_USER@example.com/{self.app_name}"

        except Exception:
            # Silently fail and use defaults
            if not self.app_folder:
                self.app_folder = f"/Workspace/Users/YOUR_USER@example.com/{self.app_name}"

    def run_command(self, command: List[str], capture_output: bool = True, cwd: str = None, use_profile: bool = True) -> Tuple[int, str, str]:
        """Run a shell command and return exit code, stdout, stderr"""
        try:
            # Add profile flag for databricks commands
            if use_profile and command and command[0] == "databricks" and self.profile:
                command = command + ["--profile", self.profile]

            result = subprocess.run(
                command,
                capture_output=capture_output,
                text=True,
                check=False,
                cwd=cwd
            )
            return result.returncode, result.stdout, result.stderr
        except Exception as e:
            return 1, "", str(e)

    def run_shell_command(self, command: str, cwd: str = None) -> bool:
        """Run a shell command and return success status"""
        print(f"Running: {command}")
        result = subprocess.run(command, shell=True, cwd=cwd)
        return result.returncode == 0

    def check_databricks_cli(self) -> bool:
        """Check if Databricks CLI is installed and configured"""
        print("🔍 Checking Databricks CLI...")

        # Check if databricks command exists (don't add profile for version check)
        exit_code, stdout, stderr = self.run_command(["databricks", "--version"], use_profile=False)
        if exit_code != 0:
            print("❌ Databricks CLI not found. Please install it first:")
            print("   pip install databricks-cli")
            return False

        # Check if configured (use profile here)
        exit_code, stdout, stderr = self.run_command(["databricks", "workspace", "list", "/"])
        if exit_code != 0:
            print(f"❌ Databricks CLI not configured for profile '{self.profile}'. Please run:")
            print(f"   databricks auth login --profile {self.profile}")
            return False

        print(f"✅ Databricks CLI is ready (profile: {self.profile})")
        if self.workspace_url:
            print(f"   Workspace: {self.workspace_url}")
        if self.user_email:
            print(f"   User: {self.user_email}")
        return True

    def get_workspace_info(self) -> bool:
        """Get workspace URL and token from CLI config"""
        try:
            # Get workspace URL
            exit_code, stdout, stderr = self.run_command(["databricks", "workspace", "list", "/"])
            if exit_code != 0:
                return False

            # Try to get workspace URL from config
            exit_code, stdout, stderr = self.run_command(["databricks", "config", "get", "host"])
            if exit_code == 0:
                self.workspace_url = stdout.strip()

            return True
        except Exception as e:
            print(f"❌ Error getting workspace info: {e}")
            return False

    def list_scopes(self) -> List[ScopeInfo]:
        """List all available scopes"""
        print("📋 Fetching available scopes...")

        exit_code, stdout, stderr = self.run_command(["databricks", "secrets", "list-scopes"])
        if exit_code != 0:
            print(f"❌ Error listing scopes: {stderr}")
            return []

        scopes = []
        lines = stdout.strip().split('\n')

        # Skip header line
        for line in lines[1:]:
            if line.strip():
                parts = line.split()
                if len(parts) >= 3:
                    scope_name = parts[0]
                    owner = parts[1]
                    created_at = parts[2]

                    # Get secret count for this scope
                    exit_code, secret_stdout, _ = self.run_command([
                        "databricks", "secrets", "list", "--scope", scope_name
                    ])

                    secret_count = 0
                    if exit_code == 0:
                        secret_lines = secret_stdout.strip().split('\n')
                        secret_count = len(secret_lines) - 1  # Subtract header

                    scopes.append(ScopeInfo(scope_name, owner, created_at, secret_count))

        return scopes

    def select_scope(self, scopes: List[ScopeInfo]) -> Optional[str]:
        """Let user select a scope to use"""
        if not scopes:
            print("❌ No scopes found")
            return None

        print(f"\n📊 Found {len(scopes)} scopes:")
        print("-" * 80)
        print(f"{'#':<3} {'Scope Name':<30} {'Owner':<20} {'Secrets':<8} {'Created':<15}")
        print("-" * 80)

        # Show first 20 scopes
        display_scopes = scopes[:20]
        for i, scope in enumerate(display_scopes, 1):
            print(f"{i:<3} {scope.name:<30} {scope.owner:<20} {scope.secret_count:<8} {scope.created_at:<15}")

        if len(scopes) > 20:
            print(f"... and {len(scopes) - 20} more scopes")

        while True:
            try:
                choice = input(f"\n🎯 Select a scope (1-{len(display_scopes)}) or enter scope name: ").strip()

                # Check if it's a number
                if choice.isdigit():
                    idx = int(choice) - 1
                    if 0 <= idx < len(display_scopes):
                        return display_scopes[idx].name
                    else:
                        print(f"❌ Invalid number. Please enter 1-{len(display_scopes)}")
                        continue

                # Check if it's a scope name
                for scope in scopes:
                    if scope.name == choice:
                        return choice

                print("❌ Invalid scope name. Please try again.")

            except KeyboardInterrupt:
                print("\n❌ Operation cancelled")
                return None

    def create_scope(self) -> Optional[str]:
        """Create a new scope"""
        print("\n🆕 Creating new scope...")

        scope_name = input("Enter scope name: ").strip()
        if not scope_name:
            print("❌ Scope name cannot be empty")
            return None

        exit_code, stdout, stderr = self.run_command([
            "databricks", "secrets", "create-scope", "--scope", scope_name
        ])

        if exit_code == 0:
            print(f"✅ Created scope: {scope_name}")
            return scope_name
        else:
            print(f"❌ Failed to create scope: {stderr}")
            return None

    def get_secret_values(self) -> bool:
        """Get secret values from user input"""
        print("\n🔐 Setting up secrets...")

        for secret in self.required_secrets:
            if secret.key == "databricks-api-url":
                secret.value = self.workspace_url or input(f"Enter {secret.description}: ").strip()
            elif secret.key == "session-secret":
                # Generate a random session secret
                secret.value = secrets.token_urlsafe(32)
                print(f"✅ Generated session secret: {secret.value[:16]}...")
            else:
                secret.value = getpass.getpass(f"Enter {secret.description}: ").strip()

            if not secret.value:
                print(f"❌ {secret.description} cannot be empty")
                return False

        return True

    def add_secrets_to_scope(self, scope_name: str) -> bool:
        """Add secrets to the selected scope"""
        print(f"\n🔐 Adding secrets to scope: {scope_name}")

        for secret in self.required_secrets:
            print(f"Adding {secret.key}...")

            exit_code, stdout, stderr = self.run_command([
                "databricks", "secrets", "put-secret",
                "--scope", scope_name,
                "--key", secret.key,
                "--string-value", secret.value
            ])

            if exit_code != 0:
                print(f"❌ Failed to add secret {secret.key}: {stderr}")
                return False

        print("✅ All secrets added successfully")
        return True

    def build_frontend(self) -> bool:
        """Build the React frontend"""
        print("🔨 Building React frontend...")

        # Check if frontend directory exists
        if not os.path.exists(self.frontend_dir):
            print(f"❌ Frontend directory not found: {self.frontend_dir}")
            return False

        # Run npm build
        if not self.run_shell_command("npm run build", cwd=self.frontend_dir):
            print("❌ Frontend build failed")
            return False

        print("✅ Frontend built successfully")
        return True

    def copy_static_files(self) -> bool:
        """Copy built frontend to backend static directory"""
        print("📁 Copying static files...")

        frontend_dist = os.path.join(self.frontend_dir, "dist")
        backend_static = os.path.join(self.backend_dir, "static")

        # Remove existing static directory
        if os.path.exists(backend_static):
            shutil.rmtree(backend_static)

        # Copy dist to static
        try:
            shutil.copytree(frontend_dist, backend_static)
            print("✅ Static files copied successfully")
            return True
        except Exception as e:
            print(f"❌ Failed to copy static files: {e}")
            return False

    def package_backend(self) -> bool:
        """Package the backend for deployment"""
        print("📦 Packaging backend...")

        # Create build directory
        build_dir = os.path.join(self.backend_dir, "build")
        if os.path.exists(build_dir):
            shutil.rmtree(build_dir)

        os.makedirs(build_dir)

        # Copy backend files (excluding unnecessary files)
        exclude_patterns = [
            "venv", "venv.*", ".venv", "env", ".env",  # Virtual environments
            "__pycache__", "*.pyc", "*.pyo", "*.pyd",  # Python cache
            ".pytest_cache", "test_*.py", "tests",     # Tests
            "test_*.log", "test_*.txt", "*.log",       # Logs
            "data.json", "cookies.txt",                # Data files
            ".env_template", "Makefile",               # Build files
            "build", "dist", "*.egg-info",             # Build artifacts
            "mlruns", "databricks_backup",             # ML/Backup files
            "*.backup", "*.dbd_secrets",               # Backup/secret files
            "node_modules", ".git", ".gitignore",      # Dev files
            ".DS_Store", "Thumbs.db",                  # OS files
            "app_temp.py",                             # Temp files
        ]

        def should_exclude(item):
            """Check if item should be excluded based on patterns"""
            for pattern in exclude_patterns:
                if fnmatch.fnmatch(item, pattern):
                    return True
            return False

        for item in os.listdir(self.backend_dir):
            if not should_exclude(item) and not item.startswith('.'):
                src = os.path.join(self.backend_dir, item)
                dst = os.path.join(build_dir, item)
                if os.path.isdir(src):
                    shutil.copytree(src, dst)
                else:
                    shutil.copy2(src, dst)

        # Copy app.yaml from config file location
        app_yaml_src = os.path.join(self.project_root, self.config_file)
        if not os.path.exists(app_yaml_src):
            app_yaml_src = os.path.join(self.backend_dir, self.config_file)

        app_yaml_dst = os.path.join(build_dir, "app.yaml")

        if os.path.exists(app_yaml_src):
            print(f"📋 Using config: {app_yaml_src}")
            # Copy but remove deployment section (not needed at runtime)
            with open(app_yaml_src, 'r') as f:
                config = yaml.safe_load(f)

            # Remove deployment metadata (only used by this script)
            if 'deployment' in config:
                del config['deployment']

            with open(app_yaml_dst, 'w') as f:
                yaml.dump(config, f, default_flow_style=False)
        else:
            print(f"⚠️  Config file not found: {app_yaml_src}")
            print(f"   Creating minimal app.yaml")
            with open(app_yaml_dst, 'w') as f:
                f.write('command: ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]\n')
                f.write('\n')
                f.write('env:\n')
                f.write('  - name: ENV\n')
                f.write('    value: "production"\n')
                f.write('  - name: PORT\n')
                f.write('    value: "8000"\n')

        print("✅ Backend packaged successfully")
        return True

    def import_to_workspace(self) -> bool:
        """Import backend to Databricks workspace"""
        print(f"📤 Importing to Databricks workspace: {self.app_folder}")

        build_dir = os.path.join(self.backend_dir, "build")

        exit_code, stdout, stderr = self.run_command([
            "databricks", "workspace", "import-dir",
            build_dir, self.app_folder, "--overwrite"
        ])

        if exit_code != 0:
            print(f"❌ Failed to import to workspace: {stderr}")
            return False

        print("✅ Imported to workspace successfully")
        return True

    def deploy_app(self, scope_name: str = None) -> bool:
        """Deploy the app to Databricks"""
        print(f"🚀 Deploying app: {self.app_name}")

        # Create app if it doesn't exist
        exit_code, stdout, stderr = self.run_command([
            "databricks", "apps", "create", self.app_name
        ])

        # Allow deploy to proceed if error is 'already exists' or 'maximum number of apps'
        if exit_code != 0 and "already exists" not in stderr.lower() and "maximum number of apps" not in stderr.lower():
            print(f"⚠️  App creation returned: {stderr}")
            # Continue anyway, app might already exist

        # Deploy the app
        exit_code, stdout, stderr = self.run_command([
            "databricks", "apps", "deploy", self.app_name,
            "--source-code-path", self.app_folder
        ])

        if exit_code != 0:
            print(f"❌ Failed to deploy app: {stderr}")
            return False

        print("✅ App deployed successfully!")
        return True

    def wait_for_app_deletion(self, app_name: str, timeout_seconds: int = 300) -> bool:
        """Wait for app deletion to complete"""
        print(f"⏳ Waiting for app deletion to complete...")

        start_time = time.time()

        while time.time() - start_time < timeout_seconds:
            # Check if app still exists
            exit_code, stdout, stderr = self.run_command([
                "databricks", "apps", "list"
            ])

            if exit_code != 0:
                print(f"❌ Error checking app list: {stderr}")
                return False

            # Check if our app is still in the list
            if app_name not in stdout:
                print(f"✅ App '{app_name}' has been successfully deleted")
                return True

            print(f"⏳ App '{app_name}' still being deleted... (elapsed: {int(time.time() - start_time)}s)")
            time.sleep(5)  # Wait 5 seconds before checking again

        print(f"❌ Timeout waiting for app deletion after {timeout_seconds} seconds")
        return False

    def delete_app(self, app_name: str) -> bool:
        """Delete an existing app"""
        print(f"🗑️  Deleting app: {app_name}")

        exit_code, stdout, stderr = self.run_command([
            "databricks", "apps", "delete", app_name
        ])

        if exit_code == 0:
            print(f"✅ Deleted app: {app_name}")
            return True
        else:
            print(f"❌ Failed to delete app: {stderr}")
            return False

    def hard_redeploy(self, skip_secrets: bool = True) -> bool:
        """Hard redeploy: delete existing app, wait for deletion, then redeploy"""
        print(f"🔥 Starting HARD REDEPLOY for app: {self.app_name}")
        print("=" * 60)

        # Step 1: Check if app exists and delete it
        print("🔍 Checking if app exists...")
        exit_code, stdout, stderr = self.run_command([
            "databricks", "apps", "list"
        ])

        if exit_code != 0:
            print(f"❌ Error checking app list: {stderr}")
            return False

        app_exists = self.app_name in stdout

        if app_exists:
            print(f"🗑️  App '{self.app_name}' exists. Deleting...")
            if not self.delete_app(self.app_name):
                print("❌ Failed to delete app. Aborting hard redeploy.")
                return False

            # Step 2: Wait for deletion to complete
            if not self.wait_for_app_deletion(self.app_name):
                print("❌ App deletion did not complete in time. Aborting hard redeploy.")
                return False
        else:
            print(f"ℹ️  App '{self.app_name}' does not exist. Proceeding with fresh deployment.")

        # Step 3: Build and package
        print("\n🔨 Building and packaging application...")
        if not self.build_frontend():
            return False
        if not self.copy_static_files():
            return False
        if not self.package_backend():
            return False
        if not self.import_to_workspace():
            return False

        # Step 4: Deploy the app
        print("\n🚀 Deploying fresh app...")
        if not self.deploy_app():
            return False

        # Step 5: Get app info
        self.get_app_info()

        print(f"\n🎉 HARD REDEPLOY completed successfully!")

        return True

    def get_app_info(self) -> bool:
        """Get app information and URL"""
        print("🔍 Getting app information...")

        exit_code, stdout, stderr = self.run_command([
            "databricks", "apps", "get", self.app_name
        ])

        if exit_code != 0:
            print(f"❌ Failed to get app info: {stderr}")
            return False

        try:
            app_info = json.loads(stdout)

            print(f"\n📱 App Information:")
            print(f"   Name: {app_info.get('name', 'N/A')}")
            print(f"   Status: {app_info.get('app_status', {}).get('state', 'N/A')}")
            print(f"   Created: {app_info.get('create_time', 'N/A')}")
            print(f"   Updated: {app_info.get('update_time', 'N/A')}")

            # Get the app URL from the response
            app_url = app_info.get('url', 'N/A')
            if app_url and app_url != 'N/A':
                print(f"\n🌐 App URL: {app_url}")
            else:
                print(f"\n🌐 App URL: (URL not available yet)")

            # Show service principal info if available
            sp = app_info.get('service_principal', {})
            if sp:
                print(f"\n🔐 Service Principal:")
                print(f"   ID: {sp.get('id', 'N/A')}")
                print(f"   Application ID: {sp.get('application_id', 'N/A')}")
                print(f"   Display Name: {sp.get('display_name', 'N/A')}")

            return True
        except json.JSONDecodeError:
            print(f"❌ Failed to parse app info: {stdout}")
            return False

    def cleanup(self):
        """Clean up temporary files"""
        print("🧹 Cleaning up...")

        # Remove build directory
        build_dir = os.path.join(self.backend_dir, "build")
        if os.path.exists(build_dir):
            shutil.rmtree(build_dir)

        print("✅ Cleanup completed")

    def deploy(self, hard_redeploy: bool = False, skip_secrets: bool = False):
        """Main deployment workflow"""
        print(f"\n{'='*60}")
        print(f"🚀 Databricks App Deployment")
        print(f"{'='*60}")
        print(f"   App Name: {self.app_name}")
        print(f"   Profile:  {self.profile}")
        print(f"   Config:   {self.config_file}")
        print(f"   Target:   {self.app_folder}")
        print(f"{'='*60}\n")

        if not self.check_databricks_cli():
            self.cleanup()
            return False

        # If hard redeploy is requested
        if hard_redeploy:
            print("🔥 HARD REDEPLOY mode: Will delete and recreate app")
            success = self.hard_redeploy(skip_secrets)
            self.cleanup()
            return success

        # Normal deployment
        if not self.build_frontend():
            self.cleanup()
            return False
        if not self.copy_static_files():
            self.cleanup()
            return False
        if not self.package_backend():
            self.cleanup()
            return False
        if not self.import_to_workspace():
            self.cleanup()
            return False
        if not self.deploy_app():
            self.cleanup()
            return False

        self.get_app_info()

        print(f"\n{'='*60}")
        print("🎉 Deployment completed successfully!")
        print(f"{'='*60}")

        self.cleanup()
        return True

def main():
    parser = argparse.ArgumentParser(
        description="Deploy QueryForge AI app to Databricks",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Deploy using app.yaml config
  python deploy_to_databricks.py --skip-secrets

  # Deploy to production
  python deploy_to_databricks.py --config app.yaml.prod --skip-secrets

  # Deploy with custom app name
  python deploy_to_databricks.py --app-name my-app --profile my-profile --skip-secrets

  # Hard redeploy (delete and recreate)
  python deploy_to_databricks.py --hard-redeploy --skip-secrets

Priority for app_name (highest to lowest):
  1. --app-name CLI argument
  2. DATABRICKS_APP_NAME environment variable
  3. deployment.app_name in app.yaml
        """
    )
    parser.add_argument("--app-name", help="App name (overrides app.yaml)")
    parser.add_argument("--profile", help="Databricks CLI profile (overrides app.yaml)")
    parser.add_argument("--config", default="app.yaml", help="Config file to use (default: app.yaml)")
    parser.add_argument("--hard-redeploy", action="store_true", help="Delete existing app and redeploy")
    parser.add_argument("--skip-secrets", action="store_true", help="Skip secrets setup (use for redeployments)")

    args = parser.parse_args()

    deployer = DatabricksDeployer(
        profile=args.profile,
        app_name=args.app_name,
        config_file=args.config
    )

    success = deployer.deploy(
        hard_redeploy=args.hard_redeploy,
        skip_secrets=args.skip_secrets
    )
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
