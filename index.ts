const CACHE = new Map();

// Every 10 seconds, evict expired items from the cache.
setTimeout(() => {
  for (const key in CACHE) {
    if (CACHE.get(key).expiry <= new Date()) {
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

const error = (message: string, status: number = 400) => {
  return new Response(JSON.stringify({ error: message }), {
    status: status,
    headers: DEFAULT_HEADERS,
  });
};

type ApiErrorResponse = {
  error: {
    code: number;
    message: string;
    status: string;
  };
};

Bun.serve({
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/") {
      return new Response("", {
        status: 302,
        headers: {
          location: "https://github.com/benborgers/opensheet#readme",
        },
      });
    }

    let [id, sheet, ...otherParams] = url.pathname
      .slice(1)
      .split("/")
      .filter((x) => x);

    if (!id || !sheet || otherParams.length > 0) {
      return error("URL format is /spreadsheet_id/sheet_name", 404);
    }

    sheet = decodeURIComponent(sheet.replace(/\+/g, " "));

    const cacheKey = `${id}/${sheet}`;

    if (CACHE.get(cacheKey)?.expiry > new Date()) {
      return new Response(JSON.stringify(CACHE.get(cacheKey).value), {
        headers: DEFAULT_HEADERS,
      });
    }

    // If the sheet is a number, assume it's a sheet index.
    if (!isNaN(parseInt(sheet))) {
      if (parseInt(sheet) === 0) {
        return error("For this API, sheet numbers start at 1");
      }

      const sheetData:
        | {
            sheets: {
              properties: { title: string };
            }[];
          }
        | ApiErrorResponse = await (
        await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${id}?key=${process.env.GOOGLE_API_KEY}`
        )
      ).json();

      if ("error" in sheetData) {
        return error(sheetData.error.message);
      }

      const sheetIndex = parseInt(sheet) - 1;
      const sheetWithThisIndex = sheetData.sheets[sheetIndex];

      if (!sheetWithThisIndex) {
        return error(`There is no sheet number ${sheet}`);
      }

      sheet = sheetWithThisIndex.properties.title;
    }

    const result:
      | {
          range: string;
          majorDimension: string;
          values: string[][];
        }
      | ApiErrorResponse = await (
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent(
          sheet
        )}?key=${process.env.GOOGLE_API_KEY}`
      )
    ).json();

    if ("error" in result) {
      return error(result.error.message);
    }

    const rows: Record<string, string>[] = [];

    const rawRows = result.values || [];
    const headers = rawRows.shift();

    if (!headers) {
      return error("Sheet is empty");
    }

    rawRows.forEach((row) => {
      const rowData: Record<string, string> = {};
      row.forEach((item, index) => {
        rowData[headers[index]] = item;
      });
      rows.push(rowData);
    });

    CACHE.set(cacheKey, {
      expiry: new Date(new Date().getTime() + 1_000 * 60), // Cache for 60 seconds
      value: rows,
    });

    return new Response(JSON.stringify(rows), {
      headers: DEFAULT_HEADERS,
    });
  },
});
