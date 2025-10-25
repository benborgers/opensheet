import Bun, { sql } from "bun";

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

const ALLOWED_QUERY_PARAMETERS = {
  raw: ["true", "false"],
};

const HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "public, max-age=30, s-maxage=30",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "Origin, X-Requested-With, Content-Type, Accept",
};

const server = Bun.serve({
  port: process.env.PORT || 3000,
  routes: {
    "/": Response.redirect("https://github.com/benborgers/opensheet#readme"),

    "/:id/:sheet": async (request) => {
      const { id, sheet: sheetParam } = request.params;
      const url = new URL(request.url);

      const queryParams = Object.fromEntries(url.searchParams.entries());

      // This prevents use of extra query parameters like ?v= to bust the cache early.
      if (
        Object.keys(queryParams).some(
          (key) => !(key in ALLOWED_QUERY_PARAMETERS)
        )
      ) {
        return error(
          `Invalid query parameters. Allowed parameters: ${Object.keys(
            ALLOWED_QUERY_PARAMETERS
          )
            .map((key) => `\`${key}\``)
            .join(", ")}`,
          400
        );
      }

      // This prevents the use of the `raw` parameter to bust the cache.
      for (const [key, value] of Object.entries(queryParams)) {
        if (key in ALLOWED_QUERY_PARAMETERS) {
          const allowedValues = ALLOWED_QUERY_PARAMETERS[key];
          if (!allowedValues.includes(value)) {
            return error(`Invalid value for query parameter \`${key}\``, 400);
          }
        }
      }

      const useUnformattedValues = queryParams.raw === "true";

      // 1% sampling to decrease load on database
      if (Math.random() < 0.01) {
        const now = new Date();
        const hour = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          now.getHours()
        ).toISOString();

        await sql`
          INSERT INTO analytics (hour, sheet_id, count)
          VALUES (${hour}, ${id}, 1)
          ON CONFLICT (hour, sheet_id)
          DO UPDATE SET count = analytics.count + 1
        `;
      }

      let sheet = decodeURIComponent(sheetParam.replace(/\+/g, " "));

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

      const apiUrl = new URL(
        `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent(
          sheet
        )}`
      );
      apiUrl.searchParams.set("key", GOOGLE_API_KEY!);
      if (useUnformattedValues)
        apiUrl.searchParams.set("valueRenderOption", "UNFORMATTED_VALUE");

      const result = await (await fetch(apiUrl)).json();

      if (result.error) {
        return error(result.error.message);
      }

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

      const responseData = JSON.stringify(rows);

      return new Response(responseData, {
        headers: HEADERS,
      });
    },
  },
  fetch() {
    return error("URL format is /spreadsheet_id/sheet_name", 404);
  },
});

console.log(`Server running on http://localhost:${server.port}`);

const error = (message: string, status = 400) => {
  return new Response(
    JSON.stringify({
      error: message,
      documentation: "https://github.com/benborgers/opensheet#readme",
    }),
    {
      status: status,
      headers: HEADERS,
    }
  );
};
