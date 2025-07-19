#!/bin/bash

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}=== Fixing Vercel Deployment Issue ===${NC}"
echo ""

# 1. Check current structure
echo -e "${BLUE}Current structure:${NC}"
echo "📁 api/"
ls -la api/ 2>/dev/null || echo -e "${RED}  api/ directory not found${NC}"
echo ""
echo "📁 api/cache/"
ls -la api/cache/ 2>/dev/null || echo -e "${RED}  api/cache/ directory not found${NC}"

# 2. Create missing directories
echo ""
echo -e "${BLUE}Creating missing directories...${NC}"
mkdir -p api/cache
mkdir -p public

# 3. Check if api/cache/stats.js exists
if [ ! -f "api/cache/stats.js" ]; then
    echo -e "${YELLOW}Creating api/cache/stats.js...${NC}"
    cat > api/cache/stats.js << 'EOF'
// api/cache/stats.js
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  try {
    res.json({
      message: "Cache stats endpoint",
      status: "ok",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to get cache stats',
      message: error.message 
    });
  }
};
EOF
    echo -e "${GREEN}✓ Created api/cache/stats.js${NC}"
fi

# 4. Fix vercel.json - use the simplest version that works
echo ""
echo -e "${BLUE}Updating vercel.json...${NC}"
cat > vercel.json << 'EOF'
{
  "version": 2
}
EOF
echo -e "${GREEN}✓ Updated vercel.json to simplest working version${NC}"

# 5. List all API files
echo ""
echo -e "${BLUE}API Files:${NC}"
find api -name "*.js" -type f 2>/dev/null | while read file; do
    echo -e "${GREEN}✓${NC} $file"
done

# 6. Check for common issues
echo ""
echo -e "${BLUE}Checking for issues...${NC}"

# Check if there are any .ts files (TypeScript)
if find api -name "*.ts" -type f 2>/dev/null | grep -q .; then
    echo -e "${YELLOW}⚠️  Found TypeScript files in api/ - Vercel expects .js files${NC}"
fi

# Check if files are executable (they shouldn't be)
if find api -name "*.js" -type f -executable 2>/dev/null | grep -q .; then
    echo -e "${YELLOW}⚠️  Found executable JS files - removing execute permission${NC}"
    find api -name "*.js" -type f -exec chmod -x {} \;
fi

# 7. Final structure
echo ""
echo -e "${GREEN}Final structure:${NC}"
tree api 2>/dev/null || find api -type f | sort

echo ""
echo -e "${GREEN}=== Fix Complete! ===${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. Commit these changes:"
echo "   ${YELLOW}git add -A${NC}"
echo "   ${YELLOW}git commit -m 'Fix Vercel deployment - simplified config'${NC}"
echo "   ${YELLOW}git push${NC}"
echo ""
echo "2. Check Vercel dashboard for deployment"
echo ""
echo -e "${GREEN}The simplified vercel.json will let Vercel auto-detect your API files.${NC}"
