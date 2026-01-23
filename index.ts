import Bun, { redis, sql } from "bun";

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

const ALLOWED_QUERY_PARAMETERS = {
  raw: ["true", "false"],
};

// In-memory cache for pending requests to prevent thundering herd
const pendingRequests = new Map<string, Promise<string>>();

const BASE_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "Origin, X-Requested-With, Content-Type, Accept",
};

const server = Bun.serve({
  port: process.env.PORT || 3000,
  routes: {
    "/": Response.redirect("https://github.com/benborgers/opensheet#readme"),

    "/up": () => new Response("OK", { status: 200 }),

    "/:id/:sheet": async (request) => {
      const { id, sheet: sheetParam } = request.params;
      const url = new URL(request.url);

      // Random cache duration between 30-60 seconds to prevent cache stampedes
      const cacheDuration = Math.floor(Math.random() * 31) + 30; // 30 to 60 seconds
      const HEADERS = {
        ...BASE_HEADERS,
        "Cache-Control": `public, max-age=${cacheDuration}, s-maxage=${cacheDuration}`,
      };

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
            .join(", ")}. Your request was: ${request.url}`,
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

      const cacheKey = request.url;

      const cachedResponse = await redis.get(cacheKey);
      if (cachedResponse) {
        return new Response(cachedResponse, {
          headers: HEADERS,
        });
      }

      // Check if there's already a pending request for this cache key
      // This prevents multiple simultaneous requests from all hitting the Google API
      if (pendingRequests.has(cacheKey)) {
        try {
          const responseData = await pendingRequests.get(cacheKey)!;
          return new Response(responseData, {
            headers: HEADERS,
          });
        } catch (e) {
          return error(e instanceof Error ? e.message : String(e));
        }
      }

      // Create a promise for fetching this data and store it
      const fetchPromise = (async () => {
        try {
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
              throw new Error("For this API, sheet numbers start at 1");
            }

            const metadataCacheKey = `metadata:${id}`;
            const cachedMetadata = await redis.get(metadataCacheKey);

            let sheetData;
            if (cachedMetadata) {
              sheetData = JSON.parse(cachedMetadata);
            } else {
              sheetData = await (
                await fetch(
                  `https://sheets.googleapis.com/v4/spreadsheets/${id}?key=${GOOGLE_API_KEY}`
                )
              ).json();

              if (sheetData.error) {
                throw new Error(sheetData.error.message);
              }

              await redis.set(metadataCacheKey, JSON.stringify(sheetData));
              await redis.expire(metadataCacheKey, 300);
            }

            const sheetIndex = parseInt(sheet) - 1;
            const sheetWithThisIndex = sheetData.sheets[sheetIndex];

            if (!sheetWithThisIndex) {
              throw new Error(`There is no sheet number ${sheet}`);
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
            throw new Error(result.error.message);
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

          await redis.set(cacheKey, responseData);
          await redis.expire(cacheKey, cacheDuration);

          return responseData;
        } finally {
          // Always remove from pending requests when done
          pendingRequests.delete(cacheKey);
        }
      })();

      pendingRequests.set(cacheKey, fetchPromise);

      try {
        const responseData = await fetchPromise;
        return new Response(responseData, {
          headers: HEADERS,
        });
      } catch (e) {
        return error(e instanceof Error ? e.message : String(e));
      }
    },
  },
  fetch() {
    return error("URL format is /spreadsheet_id/sheet_name", 404);
  },
});

console.log(`Server running on http://localhost:${server.port}`);

const error = (message: string, status = 400) => {
  console.log(status, message);
  return new Response(
    JSON.stringify({
      error: message,
      documentation: "https://github.com/benborgers/opensheet#readme",
    }),
    {
      status: status,
      headers: {
        ...BASE_HEADERS,
        "Cache-Control": "public, max-age=30, s-maxage=30",
      },
    }
  );
};
