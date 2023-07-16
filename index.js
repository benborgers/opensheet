import fs from "fs";
import http from "http";
import url from "url";

// .env
fs.readFileSync(".env", "utf-8")
  .split("\n")
  .filter(Boolean)
  .forEach((line) => {
    const [key, value] = line.split("=");
    process.env[key] = value;
  });

const CACHE = new Map();

// Every 10 seconds, evict expired items from the cache.
setTimeout(() => {
  for (const key in CACHE) {
    if (CACHE.get(key).expiry < new Date()) {
      CACHE.delete(key);
    }
  }
}, 10_000);

const DEFAULT_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "Origin, X-Requested-With, Content-Type, Accept",
};

const error = (res, message, cacheKey) => {
  const value = JSON.stringify({ error: message });

  res.writeHead(400, DEFAULT_HEADERS);
  res.end(value);
};

const listener = async (req, res) => {
  const _url = url.parse(req.url);
  const pathname = _url.pathname;

  const requestId = new URLSearchParams(_url.search).get("request_id");

  fs.appendFileSync("logs.txt", `${requestId} [request] ${pathname}\n`);

  if (pathname === "/") {
    res.writeHead(302, {
      Location: "https://github.com/benborgers/opensheet#readme",
    });
    return res.end();
  }

  let [id, sheet, ...otherParams] = pathname
    .slice(1)
    .split("/")
    .filter((x) => x);

  if (!id || !sheet || otherParams.length > 0) {
    return error(res, "URL format is /spreadsheet_id/sheet_name", undefined);
  }

  sheet = decodeURIComponent(sheet.replace(/\+/g, " "));

  const cacheKey = `${id}/${sheet}`;

  const cacheRecord = CACHE.get(cacheKey);
  if (cacheRecord?.expiry >= new Date()) {
    res.writeHead(200, DEFAULT_HEADERS);
    res.end(cacheRecord.value);
  }

  // If the sheet is a number, assume it's a sheet index.
  if (!isNaN(sheet)) {
    if (parseInt(sheet) === 0) {
      return error(res, "For this API, sheet numbers start at 1", cacheKey);
    }

    fs.appendFileSync(
      "logs.txt",
      `${requestId} https://sheets.googleapis.com/v4/spreadsheets/${id}\n`
    );
    const sheetData = await (
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${id}?key=${process.env.GOOGLE_API_KEY}`
      )
    ).json();

    if ("error" in sheetData) {
      return error(res, sheetData.error.message, cacheKey);
    }

    const sheetIndex = parseInt(sheet) - 1;
    const sheetWithThisIndex = sheetData.sheets[sheetIndex];

    if (!sheetWithThisIndex) {
      return error(`There is no sheet number ${sheet}`, cacheKey);
    }

    sheet = sheetWithThisIndex.properties.title;
  }

  fs.appendFileSync(
    "logs.txt",
    `${requestId} https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent(
      sheet
    )}\n`
  );
  const result = await (
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent(
        sheet
      )}?key=${process.env.GOOGLE_API_KEY}`
    )
  ).json();

  if ("error" in result) {
    return error(res, result.error.message, cacheKey);
  }

  const rows = [];

  const rawRows = result.values || [];
  const headers = rawRows.shift();

  if (!headers) {
    return error(res, "Sheet is empty", cacheKey);
  }

  rawRows.forEach((row) => {
    const rowData = {};
    row.forEach((item, index) => {
      rowData[headers[index]] = item;
    });
    rows.push(rowData);
  });

  const value = JSON.stringify(rows);

  CACHE.set(cacheKey, {
    expiry: new Date(new Date().getTime() + 1_000 * 30), // Cache for 30 seconds
    value,
  });

  res.writeHead(200, DEFAULT_HEADERS);
  return res.end(value);
};

http.createServer(listener).listen(3000);
