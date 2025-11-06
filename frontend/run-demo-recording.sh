#!/bin/bash

# Demo Video Recording Script for QueryForge AI
# This script records a complete demo video of the single table query workflow

set -e

echo "🎬 QueryForge AI Demo Video Recording Script"
echo "============================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if frontend and backend are running
echo -e "${BLUE}📋 Pre-flight checks...${NC}"

# Check backend
if curl -s http://localhost:8680/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Backend is running on port 8680"
else
    echo -e "${YELLOW}⚠${NC}  Backend not detected. Please start backend:"
    echo "   cd backend && python3 app.py"
    exit 1
fi

# Check frontend
if curl -s http://localhost:5673 > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Frontend is running on port 5673"
else
    echo -e "${YELLOW}⚠${NC}  Frontend not detected. Please start frontend:"
    echo "   cd frontend && npm run dev"
    exit 1
fi

echo ""
echo -e "${BLUE}🎥 Starting demo recording...${NC}"
echo ""

# Run the Playwright test with video recording
npx playwright test demo-single-table-query.spec.ts \
  --config=playwright.demo.config.ts \
  --project=demo-chrome \
  --reporter=list

echo ""
echo -e "${GREEN}✓${NC} Demo recording completed!"
echo ""

# Find the generated video
VIDEO_DIR="test-results"
VIDEO_FILE=$(find "$VIDEO_DIR" -name "*.webm" -type f | head -n 1)

if [ -n "$VIDEO_FILE" ]; then
    echo -e "${BLUE}📹 Video file found: ${VIDEO_FILE}${NC}"

    # Create demos directory if it doesn't exist
    mkdir -p public/demos

    # Copy video to public/demos with a descriptive name
    DEMO_VIDEO="public/demos/single-table-query-demo-$(date +%Y%m%d-%H%M%S).webm"
    cp "$VIDEO_FILE" "$DEMO_VIDEO"

    echo -e "${GREEN}✓${NC} Video copied to: ${DEMO_VIDEO}"
    echo ""
    echo -e "${GREEN}🎉 Success!${NC} Demo video is ready at:"
    echo -e "   ${DEMO_VIDEO}"
    echo ""
    echo "You can now:"
    echo "  1. View the video locally"
    echo "  2. Commit and push to GitHub:"
    echo "     git add public/demos/"
    echo "     git commit -m 'docs: Add single table query demo video'"
    echo "     git push origin main"
    echo ""

    # Get file size
    FILE_SIZE=$(du -h "$DEMO_VIDEO" | cut -f1)
    echo "Video size: ${FILE_SIZE}"
else
    echo -e "${YELLOW}⚠${NC}  No video file found. Check test-results directory."
    echo "Test results location: $VIDEO_DIR"
fi

echo ""
echo -e "${BLUE}📊 Opening test report...${NC}"
npx playwright show-report

echo ""
echo "✅ Demo recording process complete!"
