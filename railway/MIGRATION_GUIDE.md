# Safe Migration Guide: Worker → Railway with Gradual Traffic Shift

## Overview

This guide provides a **zero-downtime migration** with the ability to **instantly rollback** at any stage.

## Architecture

```
Before:  User → Cloudflare Worker (all traffic)
During:  User → Traffic Splitter Worker → 90% Worker / 10% Railway
After:   User → Cloudflare CDN → Railway (Worker deleted)
```

---

## Phase 1: Deploy to Railway (No Risk)

### 1.1 Deploy Bun App

```bash
cd railway

# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Set environment variable
railway variables set GOOGLE_API_KEY=your_actual_key_here

# Deploy
railway up
```

### 1.2 Get Your Railway URL

```bash
railway domain
# Example output: opensheet-production.up.railway.app
```

### 1.3 Test Railway Directly

```bash
# Health check
curl https://your-app.up.railway.app/health

# Test actual functionality
curl https://your-app.up.railway.app/1gSc_3EK1jpcoMyJ_acPpvvCMhTDRRpKVRJ13c6FY-t4/transactions

# Should return same JSON as current Worker
```

**✅ Checkpoint: Railway app works correctly**

---

## Phase 2: Gradual Traffic Migration (Easy Rollback)

### Option A: Simple DNS Switch (Recommended for simplicity)

**Pros**: Simple, clean
**Cons**: All-or-nothing (but fast rollback)

1. **Cloudflare Dashboard** → DNS → Edit `opensheet` record:
   - Change target from Worker route to Railway URL
   - Keep Proxied (orange cloud) enabled
   - Save

2. **Add Cache Rule** (Dashboard → Caching → Cache Rules):
   - **Rule name**: Cache OpenSheet API
   - **When incoming requests match**: Custom filter expression
   - **Field**: URI Path, **Operator**: matches regex, **Value**: `^/[^/]+/[^/]+$`
   - **Then**:
     - Eligibility: Eligible for cache
     - Cache TTL: 30 seconds
   - **Save**

3. **Test caching**:
   ```bash
   # First request
   curl -I https://opensheet.elk.sh/your_id/Sheet1
   # Check: CF-Cache-Status: MISS

   # Second request (within 30s)
   curl -I https://opensheet.elk.sh/your_id/Sheet1
   # Check: CF-Cache-Status: HIT
   ```

**Rollback**: Go to DNS, change CNAME back to Worker route. Takes ~5 minutes.

---

### Option B: Traffic Splitting with Router Worker (More Gradual)

**Pros**: Test with 10% traffic first, gradually increase
**Cons**: More complex, still incurs Worker costs during migration

Create `router-worker.js`:

```javascript
// Traffic splitting router for gradual migration
export default {
  async fetch(request, env) {
    const RAILWAY_URL = "https://your-app.up.railway.app"; // CHANGE THIS
    const TRAFFIC_TO_RAILWAY_PERCENT = 10; // Start at 10%

    const url = new URL(request.url);

    // Route based on percentage
    const shouldUseRailway = Math.random() * 100 < TRAFFIC_TO_RAILWAY_PERCENT;

    if (shouldUseRailway) {
      // Forward to Railway
      const railwayUrl = new URL(url.pathname + url.search, RAILWAY_URL);
      return fetch(railwayUrl, {
        method: request.method,
        headers: request.headers,
      });
    } else {
      // Use original Worker logic (copy from index.js)
      // ... [paste your current Worker code here]
    }
  }
}
```

**Deploy router**:
```bash
# Replace current Worker with router
wrangler deploy router-worker.js

# Gradually increase TRAFFIC_TO_RAILWAY_PERCENT:
# 10% → 25% → 50% → 75% → 100%
# Redeploy after each change
```

**Rollback**: Set `TRAFFIC_TO_RAILWAY_PERCENT = 0`, redeploy.

---

## Phase 3: Monitor & Optimize

### 3.1 Check Railway Metrics

Railway Dashboard → Metrics:
- **Request count**: Should see traffic increase
- **Response times**: Compare to Worker (should be similar or faster with caching)
- **Error rate**: Should be near zero

### 3.2 Verify Cloudflare Caching

```bash
# Make 5 requests to same endpoint within 30 seconds
for i in {1..5}; do
  curl -I https://opensheet.elk.sh/1gSc_3EK1jpcoMyJ_acPpvvCMhTDRRpKVRJ13c6FY-t4/transactions \
    | grep -i cf-cache-status
  sleep 5
done

# Expected output:
# CF-Cache-Status: MISS (first request)
# CF-Cache-Status: HIT (subsequent requests)
```

### 3.3 Calculate Cost Savings

**Before (Workers)**:
- 600M requests/month × $0.30/1M = **$180+/month**

**After (Railway + CDN)**:
- Railway: **$5-10/month** (fixed)
- Cloudflare CDN: **$0** (free tier)
- Origin requests (cache misses): ~30M/month → Railway handles easily

**Total savings: ~$170/month** 🎉

---

## Phase 4: Cleanup (After 48h Stable)

### 4.1 Remove Old Worker

```bash
# Delete Worker (or just remove the route)
wrangler delete opensheet

# Or remove route in wrangler.toml and deploy blank worker
```

### 4.2 Archive Analytics (Optional)

If you were using D1 analytics:

```bash
# Export analytics data
wrangler d1 execute analytics --command "SELECT * FROM analytics" > analytics-backup.json

# Can set up similar tracking in Railway if needed
```

---

## Rollback Procedures

### Instant Rollback (DNS Method)

1. Cloudflare Dashboard → DNS
2. Change CNAME back to Worker route
3. Wait ~5 minutes for DNS propagation
4. Verify Worker is handling traffic

### Instant Rollback (Router Worker Method)

1. Edit `router-worker.js`: Set `TRAFFIC_TO_RAILWAY_PERCENT = 0`
2. Deploy: `wrangler deploy`
3. All traffic back to original Worker

---

## Troubleshooting

### Issue: CF-Cache-Status shows DYNAMIC/BYPASS

**Fix**: Check Cache Rule or Page Rule configuration
- Ensure "Cache Everything" is enabled
- Verify URL pattern matches
- Check origin Cache-Control headers are being sent

### Issue: Railway shows high error rate

**Fix**:
- Check Railway logs: `railway logs`
- Verify GOOGLE_API_KEY is set correctly
- Test Railway URL directly

### Issue: Slow response times

**Fix**:
- Railway may need to scale up (check metrics)
- Verify Cloudflare CDN cache is working
- Consider keeping Railway instance always-on (may require paid plan)

---

## Cost Comparison

| Metric | Current (Workers) | New (Railway + CDN) | Savings |
|--------|------------------|---------------------|---------|
| Monthly requests | 600M | 600M | - |
| Requests to origin | 600M | ~30M (95% cache hit) | 570M |
| Compute cost | $180+ | $5-10 | **$170+** |
| Bandwidth | $0 (included) | $0 (CF free) | $0 |
| **Total** | **$180+** | **$5-10** | **~$170** |

---

## Next Steps

1. ✅ Deploy to Railway
2. ✅ Test Railway directly
3. ✅ Choose migration method (A or B)
4. ✅ Configure Cloudflare caching
5. ✅ Monitor for 48 hours
6. ✅ Delete Worker
7. 🎉 Enjoy $170/month savings!
