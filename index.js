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

app.get("/:id/:sheet", (req, res) => {
  res.send("hi");
});

app.listen(3000, () => {
  console.log("http://localhost:3000");
});
