const express = require("express");
const app = express();

const { google } = require("googleapis");

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT), // Added in Railway
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
});

const sheets = google.sheets({ version: "v4", auth });

app.use("*", (req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  next();
});

app.get("/", (req, res) => {
  // TODO: docs microsite
  res.send("todo");
});

app.get("/:id/:sheet", async (req, res) => {
  let { id, sheet } = req.params;
  // This is what Vercel does, and we want to keep this behavior
  // even after migrating off of Vercel so there's no breaking change.
  sheet = sheet.replace(/\+/g, " ");

  if (!isNaN(sheet)) {
    const { data } = await sheets.spreadsheets.get({
      spreadsheetId: id,
    });

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
    (error, result) => {
      if (error) {
        return res.json({ error: error.response.data.error.message });
      }

      const rows = [];

      const rawRows = result.data.values;
      const headers = rawRows.shift();

      rawRows.forEach((row) => {
        const rowData = {};
        row.forEach((item, index) => {
          rowData[headers[index]] = item;
        });
        rows.push(rowData);
      });

      return res.json(rows);
    }
  );
});

app.listen(3000, () => {
  console.log("http://localhost:3000");
});
