const express = require("express");
const app = express();

const { google } = require("googleapis");
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT), // Added in Railway
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
});
const sheets = google.sheets({ version: "v4", auth });

const { createClient } = require("redis");
let redis = {
  exists: () => false,
  set: () => null,
};
(async () => {
  if (process.env.REDIS_URL) {
    redis = createClient({ url: process.env.REDIS_URL });
    await redis.connect();
    console.log("Connected to Redis");
  } else {
    console.log(
      "No Redis URL found (no process.env.REDIS_URL), so no caching will be done"
    );
  }
})();

app.use(
  require("morgan")(":method :url :status - :response-time ms (via :referrer)")
);
app.use(require("cors")());

app.get("/", async (req, res) => {
  res.redirect("https://github.com/benborgers/opensheet#readme");
});

app.get("/:id/:sheet", async (req, res) => {
  let { id, sheet } = req.params;
  // This is what Vercel does, and we want to keep this behavior
  // even after migrating off of Vercel so there's no breaking change.
  sheet = sheet.replace(/\+/g, " ");

  const cacheKey = `${id}--${sheet}`;
  if (await redis.exists(cacheKey)) {
    return res.json(JSON.parse(await redis.get(cacheKey)));
  }

  if (!isNaN(sheet)) {
    let data;
    try {
      const response = await sheets.spreadsheets.get({
        spreadsheetId: id,
      });
      data = response.data;
    } catch (error) {
      return res.json({ error: error.response.data.error.message });
    }

    if (parseInt(sheet) === 0) {
      return res.json({ error: "For this API, sheet numbers start at 1" });
    }

    const sheetIndex = parseInt(sheet) - 1;

    if (!data.sheets[sheetIndex]) {
      return res.json({ error: `There is no sheet number ${sheet}` });
    }

    sheet = data.sheets[sheetIndex].properties.title;
  }

  sheets.spreadsheets.values.get(
    {
      spreadsheetId: id,
      range: sheet,
    },
    async (error, result) => {
      if (error) {
        return res.json({ error: error.response.data.error.message });
      }

      const rows = [];

      const rawRows = result.data.values || [];
      const headers = rawRows.shift();

      rawRows.forEach((row) => {
        const rowData = {};
        row.forEach((item, index) => {
          rowData[headers[index]] = item;
        });
        rows.push(rowData);
      });

      await redis.set(cacheKey, JSON.stringify(rows), {
        EX: 30, // Cache for 30 seconds
      });

      return res.json(rows);
    }
  );
});

app.listen(3000, () => console.log("http://localhost:3000"));

// Avoid a single error from crashing the server in production.
process.on("uncaughtException", (...args) => console.error(args));
process.on("unhandledRejection", (...args) => console.error(args));
