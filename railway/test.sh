#!/bin/bash

# Test script for OpenSheet Railway deployment

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get base URL from argument or use default
BASE_URL=${1:-"http://localhost:3000"}

echo -e "${YELLOW}Testing OpenSheet at: $BASE_URL${NC}\n"

# Test 1: Health check
echo -e "${YELLOW}Test 1: Health Check${NC}"
HEALTH=$(curl -s "$BASE_URL/health")
if echo "$HEALTH" | grep -q "ok"; then
  echo -e "${GREEN}✓ Health check passed${NC}"
else
  echo -e "${RED}✗ Health check failed${NC}"
  exit 1
fi

# Test 2: Root redirect
echo -e "\n${YELLOW}Test 2: Root Redirect${NC}"
REDIRECT=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/")
if [ "$REDIRECT" = "302" ]; then
  echo -e "${GREEN}✓ Root redirect works${NC}"
else
  echo -e "${RED}✗ Root redirect failed (got $REDIRECT)${NC}"
fi

# Test 3: Sample spreadsheet
echo -e "\n${YELLOW}Test 3: Sample Spreadsheet (Ben's transactions)${NC}"
RESULT=$(curl -s "$BASE_URL/1gSc_3EK1jpcoMyJ_acPpvvCMhTDRRpKVRJ13c6FY-t4/transactions")
if echo "$RESULT" | grep -q "Date"; then
  echo -e "${GREEN}✓ Spreadsheet fetch works${NC}"
  echo -e "Sample data:"
  echo "$RESULT" | head -c 200
  echo "..."
else
  echo -e "${RED}✗ Spreadsheet fetch failed${NC}"
  echo "Response: $RESULT"
fi

# Test 4: Invalid request
echo -e "\n${YELLOW}Test 4: Error Handling${NC}"
ERROR=$(curl -s "$BASE_URL/invalid")
if echo "$ERROR" | grep -q "error"; then
  echo -e "${GREEN}✓ Error handling works${NC}"
else
  echo -e "${RED}✗ Error handling failed${NC}"
fi

# Test 5: CORS headers
echo -e "\n${YELLOW}Test 5: CORS Headers${NC}"
CORS=$(curl -s -I "$BASE_URL/health" | grep -i "access-control-allow-origin")
if echo "$CORS" | grep -q "*"; then
  echo -e "${GREEN}✓ CORS headers present${NC}"
else
  echo -e "${RED}✗ CORS headers missing${NC}"
fi

# Test 6: Cache headers
echo -e "\n${YELLOW}Test 6: Cache Headers${NC}"
CACHE=$(curl -s -I "$BASE_URL/1gSc_3EK1jpcoMyJ_acPpvvCMhTDRRpKVRJ13c6FY-t4/transactions" | grep -i "cache-control")
if echo "$CACHE" | grep -q "max-age=30"; then
  echo -e "${GREEN}✓ Cache headers correct${NC}"
else
  echo -e "${RED}✗ Cache headers missing or incorrect${NC}"
  echo "Got: $CACHE"
fi

echo -e "\n${GREEN}All tests completed!${NC}"
