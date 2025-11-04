#!/usr/bin/env python3
"""
Databricks Deployment Script for QueryForge AI Application
Handles CLI setup, secrets management, scope selection, and app deployment
"""

import os
import sys
import json
import subprocess
import getpass
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass
import argparse
import fnmatch
import shutil
import time

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
    def __init__(self):
        self.workspace_url = None
        self.token = None
        self.user_email = None
        self.app_name = "queryforge"
        self.app_folder = None  # Will be auto-detected

        # Auto-detect workspace info
        self._auto_detect_workspace_info()

        # Required secrets for the application
        self.required_secrets = [
            SecretConfig("databricks-token", "", "Databricks personal access token"),
            SecretConfig("databricks-api-url", "", "Databricks workspace URL"),
            SecretConfig("openai-api-key", "", "OpenAI API key"),
            SecretConfig("anthropic-api-key", "", "Anthropic API key"),
            SecretConfig("session-secret", "", "Session secret for FastAPI"),
        ]

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

    def run_command(self, command: List[str], capture_output: bool = True) -> Tuple[int, str, str]:
        """Run a shell command and return exit code, stdout, stderr"""
        try:
            result = subprocess.run(
                command,
                capture_output=capture_output,
                text=True,
                check=False
            )
            return result.returncode, result.stdout, result.stderr
        except Exception as e:
            return 1, "", str(e)

    def check_databricks_cli(self) -> bool:
        """Check if Databricks CLI is installed and configured"""
        print("🔍 Checking Databricks CLI...")

        # Check if databricks command exists
        exit_code, stdout, stderr = self.run_command(["databricks", "--version"])
        if exit_code != 0:
            print("❌ Databricks CLI not found. Please install it first:")
            print("   pip install databricks-cli")
            return False

        # Check if configured
        exit_code, stdout, stderr = self.run_command(["databricks", "workspace", "list", "/"])
        if exit_code != 0:
            print("❌ Databricks CLI not configured. Please run:")
            print("   databricks configure --token")
            return False

        print("✅ Databricks CLI is ready")
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
                import secrets
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
                "databricks", "secrets", "put",
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

        exit_code, stdout, stderr = self.run_command([
            "sh", "-c", "cd frontend && npm run build"
        ], capture_output=False)

        if exit_code != 0:
            print(f"❌ Frontend build failed")
            return False

        print("✅ Frontend built successfully")
        return True

    def copy_static_files(self) -> bool:
        """Copy built frontend to backend static directory"""
        print("📁 Copying static files...")

        # Remove existing static directory
        if os.path.exists("backend/static"):
            shutil.rmtree("backend/static")

        # Copy dist to static
        try:
            shutil.copytree("frontend/dist", "backend/static")
            print("✅ Static files copied successfully")
            return True
        except Exception as e:
            print(f"❌ Failed to copy static files: {e}")
            return False

    def package_backend(self) -> bool:
        """Package the backend for deployment"""
        print("📦 Packaging backend...")

        # Create build directory
        build_dir = "backend/build"
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
        ]

        def should_exclude(item):
            """Check if item should be excluded based on patterns"""
            for pattern in exclude_patterns:
                if fnmatch.fnmatch(item, pattern):
                    return True
            return False

        for item in os.listdir("backend"):
            if not should_exclude(item) and not item.startswith('.'):
                src = os.path.join("backend", item)
                dst = os.path.join(build_dir, item)
                if os.path.isdir(src):
                    shutil.copytree(src, dst)
                else:
                    shutil.copy2(src, dst)

        # Copy app.yaml from project root (if exists) or create minimal one
        app_yaml_src = "app.yaml"
        app_yaml_dst = os.path.join(build_dir, "app.yaml")

        if os.path.exists(app_yaml_src):
            print(f"Using app.yaml from project root")
            shutil.copy2(app_yaml_src, app_yaml_dst)
        else:
            print(f"Creating minimal app.yaml")
            with open(app_yaml_dst, 'w') as f:
                f.write('command: ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]\n')
                f.write('\n')
                f.write('env:\n')
                f.write('  ENV: "production"\n')
                f.write('  PORT: "8000"\n')
                f.write('  DEBUG: "False"\n')

        print("✅ Backend packaged successfully")
        return True

    def import_to_workspace(self) -> bool:
        """Import backend to Databricks workspace"""
        print("📤 Importing to Databricks workspace...")

        exit_code, stdout, stderr = self.run_command([
            "databricks", "workspace", "import-dir",
            "backend/build", self.app_folder, "--overwrite"
        ])

        if exit_code != 0:
            print(f"❌ Failed to import to workspace: {stderr}")
            return False

        print("✅ Imported to workspace successfully")
        return True

    def deploy_app(self, scope_name: str = None) -> bool:
        """Deploy the app to Databricks"""
        print("🚀 Deploying app to Databricks...")

        # Create app if it doesn't exist
        exit_code, stdout, stderr = self.run_command([
            "databricks", "apps", "create", self.app_name
        ])

        # Allow deploy to proceed if error is 'already exists' or 'maximum number of apps'
        if exit_code != 0 and "already exists" not in stderr and "maximum number of apps" not in stderr:
            print(f"❌ Failed to create app: {stderr}")
            return False

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

    def hard_redeploy(self, scope_name: str = None) -> bool:
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
        if not self.deploy_app(scope_name or ""):
            return False

        # Step 5: Get app info
        self.get_app_info()

        print(f"\n🎉 HARD REDEPLOY completed successfully!")
        if scope_name:
            print(f"🔐 Secrets are stored in scope: {scope_name}")

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
                print(f"\n🌐 App URL: {self.app_name} (URL not available)")

            return True
        except json.JSONDecodeError:
            print(f"❌ Failed to parse app info: {stdout}")
            return False

    def cleanup(self):
        """Clean up temporary files"""
        print("🧹 Cleaning up...")

        # Remove build directory
        if os.path.exists("backend/build"):
            shutil.rmtree("backend/build")

        # Remove config file
        if os.path.exists("app_env.json"):
            os.remove("app_env.json")

        print("✅ Cleanup completed")

    def deploy(self, hard_redeploy: bool = False):
        """Main deployment workflow"""
        print(f"🚀 Starting Databricks deployment\n{'='*60}")

        if not self.check_databricks_cli():
            self.cleanup()
            return False

        # If hard redeploy is requested, skip scope configuration
        if hard_redeploy:
            print("🔥 HARD REDEPLOY mode: Skipping scope configuration")
            success = self.hard_redeploy()
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
        print("🎉 Deployment completed successfully!")
        self.cleanup()
        return True

def main():
    parser = argparse.ArgumentParser(description="Deploy QueryForge AI app to Databricks")
    parser.add_argument("--app-name", default="queryforge", help="App name")
    parser.add_argument("--app-folder", default=None, help="App folder in workspace (auto-detected if not provided)")
    parser.add_argument("--hard-redeploy", action="store_true", help="Hard redeploy: delete existing app, wait for deletion, then redeploy")

    args = parser.parse_args()

    deployer = DatabricksDeployer()
    deployer.app_name = args.app_name

    # Update app_folder if provided, otherwise use auto-detected path with new app_name
    if args.app_folder:
        deployer.app_folder = args.app_folder
    elif deployer.user_email:
        deployer.app_folder = f"/Workspace/Users/{deployer.user_email}/{args.app_name}"
    else:
        deployer.app_folder = f"/Workspace/Users/YOUR_USER@example.com/{args.app_name}"

    print(f"📍 App will be deployed to: {deployer.app_folder}")

    success = deployer.deploy(hard_redeploy=args.hard_redeploy)
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
