#!/usr/bin/env python3
"""
Build script for Text to SQL application.
This script builds the frontend and prepares the backend for deployment.
"""

import subprocess
import sys
import shutil
from pathlib import Path

def run_command(command, cwd=None, description=""):
    """Run a shell command and handle errors"""
    print(f"\n{'='*60}")
    print(f"{description or command}")
    print('='*60)

    try:
        result = subprocess.run(
            command,
            cwd=cwd,
            shell=True,
            check=True,
            text=True,
            capture_output=True
        )
        if result.stdout:
            print(result.stdout)
        return True
    except subprocess.CalledProcessError as e:
        print(f"Error: Command failed with exit code {e.returncode}")
        if e.stdout:
            print(f"STDOUT:\n{e.stdout}")
        if e.stderr:
            print(f"STDERR:\n{e.stderr}")
        return False

def main():
    """Main build process"""
    project_root = Path(__file__).parent
    frontend_dir = project_root / "frontend"
    backend_dir = project_root / "backend"
    backend_static_dir = backend_dir / "static"

    print("\n" + "="*60)
    print("Text to SQL - Build Script")
    print("="*60)

    if not frontend_dir.exists():
        print("Error: frontend directory not found")
        sys.exit(1)

    if not backend_dir.exists():
        print("Error: backend directory not found")
        sys.exit(1)

    print("\nStep 1: Installing frontend dependencies...")
    if not run_command("npm install", cwd=frontend_dir, description="Installing npm packages"):
        print("\nError: Failed to install frontend dependencies")
        sys.exit(1)

    print("\nStep 2: Building frontend...")
    if not run_command("npm run build", cwd=frontend_dir, description="Building React application"):
        print("\nError: Failed to build frontend")
        sys.exit(1)

    frontend_dist = frontend_dir / "dist"
    if not frontend_dist.exists():
        print(f"\nError: Frontend build output not found at {frontend_dist}")
        sys.exit(1)

    print("\nStep 3: Copying frontend build to backend static directory...")
    if backend_static_dir.exists():
        print(f"Removing existing static directory: {backend_static_dir}")
        shutil.rmtree(backend_static_dir)

    print(f"Copying {frontend_dist} to {backend_static_dir}")
    shutil.copytree(frontend_dist, backend_static_dir)

    print("\nStep 4: Checking backend dependencies...")
    requirements_file = backend_dir / "requirements.txt"
    if requirements_file.exists():
        print(f"Backend requirements found at {requirements_file}")
        print("To install backend dependencies, run:")
        print(f"  cd backend && pip install -r requirements.txt")
    else:
        print("Warning: No requirements.txt found in backend directory")

    print("\n" + "="*60)
    print("Build completed successfully!")
    print("="*60)
    print("\nNext steps:")
    print("  1. Install backend dependencies: cd backend && pip install -r requirements.txt")
    print("  2. Test locally: cd backend && python app.py")
    print("  3. Deploy to Databricks: python deploy_to_databricks.py")
    print()

if __name__ == "__main__":
    main()
