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

    // TODO: handle number sheets

    const result: {
      range: string;
      majorDimension: string;
      values: string[][];
    } = await (
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent(
          sheet
        )}?key=${process.env.GOOGLE_API_KEY}`
      )
    ).json();

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

    return new Response(JSON.stringify(rows), {
      headers: DEFAULT_HEADERS,
    });
  },
});
