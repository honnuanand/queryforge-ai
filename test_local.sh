#!/bin/bash

echo "Testing Text-to-SQL Application Locally"
echo "========================================"
echo ""

# Test backend endpoints
echo "1. Testing /api/health endpoint..."
curl -s http://localhost:8680/api/health | python3 -m json.tool

echo ""
echo "2. Testing /api/debug/config endpoint..."
curl -s http://localhost:8680/api/debug/config | python3 -m json.tool

echo ""
echo "3. Testing /api/models endpoint..."
curl -s http://localhost:8680/api/models | python3 -m json.tool

echo ""
echo "4. Testing /api/catalogs endpoint..."
curl -s http://localhost:8680/api/catalogs | python3 -m json.tool

echo ""
echo "Tests complete!"
