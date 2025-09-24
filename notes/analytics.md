Analytics D1 database created with:

```bash
wrangler d1 execute DB --command="
CREATE TABLE analytics (
  hour TEXT NOT NULL,
  sheet_id TEXT NOT NULL,
  count INTEGER DEFAULT 0,
  PRIMARY KEY (hour, sheet_id)
);
CREATE INDEX idx_analytics_sheet_id_hour ON analytics(sheet_id, hour DESC);" --remote
```

Analyze data from past 24 hours with:

```bash
SELECT
    sheet_id,
    SUM(count) as total_count
FROM analytics
WHERE hour >= datetime('now', '-24 hours')
GROUP BY sheet_id
ORDER BY total_count DESC
LIMIT 15;
```
