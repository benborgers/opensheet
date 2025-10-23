# Quick Start: Deploy to Railway in 10 Minutes

This is the fastest path to deployment. For detailed explanation, see MIGRATION_GUIDE.md.

## Prerequisites

```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash

# Install Railway CLI
npm i -g @railway/cli
```

## Step 1: Test Locally (2 min)

```bash
cd railway

# Create .env file
cp .env.example .env
# Edit .env and add your GOOGLE_API_KEY

# Start server
bun run dev

# In another terminal, test it
./test.sh http://localhost:3000
```

**Expected output**: All tests should pass ✓

## Step 2: Deploy to Railway (3 min)

```bash
# Login to Railway
railway login

# Create new project
railway init

# Set environment variable
railway variables set GOOGLE_API_KEY=your_actual_key_here

# Deploy!
railway up

# Get your URL
railway domain
# Save this URL! Example: opensheet-production.up.railway.app
```

## Step 3: Test Railway Deployment (2 min)

```bash
# Test Railway URL
./test.sh https://your-app.up.railway.app

# Or manually test
curl https://your-app.up.railway.app/health
curl https://your-app.up.railway.app/1gSc_3EK1jpcoMyJ_acPpvvCMhTDRRpKVRJ13c6FY-t4/transactions
```

**Expected**: Both should return valid responses.

## Step 4: Configure Cloudflare (3 min)

### Option 1: Simple DNS Switch (Recommended)

1. **Go to Cloudflare Dashboard** → Your domain → DNS

2. **Find your record** for `opensheet.elk.sh` or create new CNAME:
   - Type: CNAME
   - Name: `opensheet` (or `@` for root domain)
   - Target: `your-app.up.railway.app` (from Step 2)
   - Proxy status: **Proxied** (orange cloud) ← IMPORTANT!

3. **Create Cache Rule** (Caching → Cache Rules → Create Rule):
   - Rule name: `Cache OpenSheet API`
   - When incoming requests match:
     - Field: Hostname
     - Operator: equals
     - Value: `opensheet.elk.sh`
   - AND:
     - Field: URI Path
     - Operator: does not equal
     - Value: `/health`
   - Then:
     - Eligibility: Eligible for cache
     - Edge TTL: Custom → 30 seconds
   - Click **Deploy**

4. **Remove Worker Route** (Workers & Pages → opensheet):
   - Remove route `opensheet.elk.sh/*`
   - OR: Delete the Worker entirely

### Option 2: Page Rule (If Cache Rules not available)

1. **Go to Rules** → **Page Rules** → **Create Page Rule**:
   - URL: `opensheet.elk.sh/*`
   - Setting 1: Cache Level = Cache Everything
   - Setting 2: Edge Cache TTL = 30 seconds
   - Save and Deploy

## Step 5: Verify Caching (2 min)

```bash
# First request (should be MISS)
curl -I https://opensheet.elk.sh/1gSc_3EK1jpcoMyJ_acPpvvCMhTDRRpKVRJ13c6FY-t4/transactions \
  | grep -i cf-cache-status

# Wait 2 seconds, then second request (should be HIT)
sleep 2
curl -I https://opensheet.elk.sh/1gSc_3EK1jpcoMyJ_acPpvvCMhTDRRpKVRJ13c6FY-t4/transactions \
  | grep -i cf-cache-status
```

**Expected output:**
```
CF-Cache-Status: MISS    (first request)
CF-Cache-Status: HIT     (second request)
```

**If you see `DYNAMIC` or `BYPASS`:**
- Check Cache Rule is enabled
- Verify orange cloud (Proxied) is ON in DNS
- Check origin is sending `Cache-Control: public, max-age=30`

## Done! 🎉

Your site is now live on Railway with Cloudflare CDN caching.

### Monitor for 24-48 hours:

**Railway Dashboard:**
- Requests should be ~5-15% of total traffic (rest cached by CDN)
- Error rate should be <0.1%

**Cloudflare Analytics:**
- Cache hit ratio should be >85%

### Rollback if needed:

```bash
# Quick rollback: Point DNS back to Worker
# Cloudflare Dashboard → DNS → Edit opensheet record
# Change target back to Worker route
# Takes ~5 minutes
```

### Delete Worker (after 48h stable):

```bash
# Remove Worker entirely
wrangler delete opensheet

# Or keep it archived in GitHub just in case
```

---

## Costs Comparison

**Before:** $180+/month (600M Worker requests)
**After:** $5-10/month (Railway + free CDN caching)
**Savings:** ~$170/month = **$2,040/year**

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `CF-Cache-Status: BYPASS` | Check Cache Rule, ensure Proxy (orange cloud) enabled |
| Railway logs show errors | Check `railway logs`, verify GOOGLE_API_KEY set |
| High Railway request count | Check cache hit ratio in Cloudflare Analytics |
| Slow responses | Verify caching working, check Railway metrics |

---

## Support

- **Railway Docs**: https://docs.railway.app
- **Cloudflare Cache Docs**: https://developers.cloudflare.com/cache/
- **Bun Docs**: https://bun.sh/docs

For detailed migration strategies and rollback procedures, see MIGRATION_GUIDE.md.
