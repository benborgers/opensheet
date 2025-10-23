// Bun server for Railway deployment
// Replicates Cloudflare Worker functionality

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const PORT = process.env.PORT || 3000;

const error = (message: string, status = 400) => {
  return new Response(JSON.stringify({ error: message }), {
    status: status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Origin, X-Requested-With, Content-Type, Accept",
    },
  });
};

const server = Bun.serve({
  port: PORT,
  async fetch(request) {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Origin, X-Requested-With, Content-Type, Accept",
        },
      });
    }

    // Redirect root to GitHub
    if (url.pathname === "/") {
      return new Response("", {
        status: 302,
        headers: {
          location: "https://github.com/benborgers/opensheet#readme",
        },
      });
    }

    // Health check endpoint for Railway
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ status: "ok" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    let [id, sheet, ...otherParams] = url.pathname
      .slice(1)
      .split("/")
      .filter((x) => x);

    if (!id || !sheet || otherParams.length > 0) {
      return error("URL format is /spreadsheet_id/sheet_name", 404);
    }

    const useUnformattedValues = url.searchParams.get("raw") === "true";

    // Decode sheet name
    sheet = decodeURIComponent(sheet.replace(/\+/g, " "));

    // Handle numeric sheet references
    if (!isNaN(sheet as any)) {
      if (parseInt(sheet) === 0) {
        return error("For this API, sheet numbers start at 1");
      }

      const sheetData = await (
        await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${id}?key=${GOOGLE_API_KEY}`
        )
      ).json();

      if (sheetData.error) {
        return error(sheetData.error.message);
      }

      const sheetIndex = parseInt(sheet) - 1;
      const sheetWithThisIndex = sheetData.sheets[sheetIndex];

      if (!sheetWithThisIndex) {
        return error(`There is no sheet number ${sheet}`);
      }

      sheet = sheetWithThisIndex.properties.title;
    }

    // Fetch sheet data
    const apiUrl = new URL(
      `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent(sheet)}`
    );
    apiUrl.searchParams.set("key", GOOGLE_API_KEY!);
    if (useUnformattedValues)
      apiUrl.searchParams.set("valueRenderOption", "UNFORMATTED_VALUE");

    const result = await (await fetch(apiUrl)).json();

    if (result.error) {
      return error(result.error.message);
    }

    // Transform data
    const rows: any[] = [];
    const rawRows = result.values || [];
    const headers = rawRows.shift();

    rawRows.forEach((row: any[]) => {
      const rowData: any = {};
      row.forEach((item, index) => {
        rowData[headers[index]] = item;
      });
      rows.push(rowData);
    });

    // Return response with cache headers for Cloudflare CDN
    return new Response(JSON.stringify(rows), {
      headers: {
        "Content-Type": "application/json",
        // CRITICAL: This tells Cloudflare CDN to cache for 30 seconds
        "Cache-Control": "public, max-age=30, s-maxage=30",
        // Alternative: Use CDN-Cache-Control for more explicit Cloudflare caching
        "CDN-Cache-Control": "max-age=30",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Origin, X-Requested-With, Content-Type, Accept",
      },
    });
  },
});

console.log(`🚀 Server running on port ${server.port}`);
console.log(`🔑 Google API Key: ${GOOGLE_API_KEY ? "✓ Set" : "✗ Missing"}`);
