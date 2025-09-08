addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event));
});

async function handleRequest(event) {
  const url = new URL(event.request.url);

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

  const useIsoDates = url.searchParams.get("isoDates") === "true";

  const cacheKey = `https://opensheet.elk.sh/${id}/${encodeURIComponent(sheet)}?isoDates=${useIsoDates}`;

  const cache = caches.default;
  const cachedResponse = await cache.match(cacheKey);
  if (cachedResponse) {
    console.log(`Serving from cache: ${cacheKey}`);
    return cachedResponse;
  } else {
    console.log(`Cache miss: ${cacheKey}`);
  }

  sheet = decodeURIComponent(sheet.replace(/\+/g, " "));

  if (!isNaN(sheet)) {
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

  const apiUrl = new URL(`https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent(sheet)}`);
  apiUrl.searchParams.set("key", GOOGLE_API_KEY);
  if (useIsoDates) apiUrl.searchParams.set("valueRenderOption", "UNFORMATTED_VALUE");

  const result = await (await fetch(apiUrl)).json();

  if (result.error) {
    return error(result.error.message);
  }

  const rows = [];

  // Convert serial dates to ISO timestamps
  const rawRows = (result.values || []).map((row) => {
    return row.map((cell) => {
      if (useIsoDates && typeof cell === "number") {
        const epoch = new Date(1899, 11, 30);
        const date = new Date(epoch.getTime() + (cell * 24 * 60 * 60 * 1000));
        return date.toISOString();
      }

      return cell;
    });
  });

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

  event.waitUntil(cache.put(cacheKey, apiResponse.clone()));

  return apiResponse;
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
