export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

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

    // 1% sampling to decrease load on D1
    if (env.DB && Math.random() < 0.01) {
      const now = new Date();
      const hour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours()).toISOString();

      env.DB.prepare(`
        INSERT INTO analytics (hour, sheet_id, count)
        VALUES (?, ?, 1)
        ON CONFLICT (hour, sheet_id)
        DO UPDATE SET count = count + 1
      `).bind(hour, id).run();
    }


    const useUnformattedValues = url.searchParams.get("raw") === "true";

    const cacheKey = `https://opensheet.elk.sh/${id}/${encodeURIComponent(sheet)}?raw=${useUnformattedValues}`;

    const cache = caches.default;
    const cachedResponse = await cache.match(cacheKey);
    if (cachedResponse) {
      return cachedResponse;
    }

    sheet = decodeURIComponent(sheet.replace(/\+/g, " "));

    if (!isNaN(sheet)) {
      if (parseInt(sheet) === 0) {
        return error("For this API, sheet numbers start at 1");
      }

      const sheetData = await (
        await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${id}?key=${env.GOOGLE_API_KEY}`
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

    const apiUrl = new URL(`https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent(sheet)}`);
    apiUrl.searchParams.set("key", env.GOOGLE_API_KEY);
    if (useUnformattedValues) apiUrl.searchParams.set("valueRenderOption", "UNFORMATTED_VALUE");

    const result = await (await fetch(apiUrl)).json();

    if (result.error) {
      return error(result.error.message);
    }

    const rows = [];

    const rawRows = result.values || [];
    const headers = rawRows.shift();

    rawRows.forEach((row) => {
      const rowData = {};
      row.forEach((item, index) => {
        rowData[headers[index]] = item;
      });
      rows.push(rowData);
    });

    const apiResponse = new Response(JSON.stringify(rows), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": `s-maxage=30`,
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers":
          "Origin, X-Requested-With, Content-Type, Accept",
      },
    });

    ctx.waitUntil(cache.put(cacheKey, apiResponse.clone()));

    return apiResponse;
  }
}

const error = (message, status = 400) => {
  return new Response(JSON.stringify({ error: message }), {
    status: status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers":
        "Origin, X-Requested-With, Content-Type, Accept",
    },
  });
};
