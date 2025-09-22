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
