# opensheet

A free, super simple, hosted API for getting Google Sheets as JSON.

**Tutorial blog post:** [benborgers.com/posts/google-sheets-json](https://benborgers.com/posts/google-sheets-json)

**If you have questions:** [benborgers.com/contact](https://benborgers.com/contact)

## Documentation

This API returns a given Google Sheet’s rows as JSON data.

In order to use it:

1. The first column of your Google Sheet should be column headers ([here’s an example](https://docs.google.com/spreadsheets/d/1o5t26He2DzTweYeleXOGiDjlU4Jkx896f95VUHVgS8U/edit)).
1. Link sharing must be turned on so anyone with the link can _view_ the Google Sheet.

The format for this API is:

```
https://opensheet.elk.sh/spreadsheet_id/sheet_name
```

For example:

```
https://opensheet.elk.sh/1o5t26He2DzTweYeleXOGiDjlU4Jkx896f95VUHVgS8U/Test+Sheet
```

You can also replace `sheet_name` with the sheet number (in the order that the tabs are arranged), if you don’t know the name. For example, to get the first sheet:

```
https://opensheet.elk.sh/1o5t26He2DzTweYeleXOGiDjlU4Jkx896f95VUHVgS8U/1
```

_Take note that the first sheet in order is numbered `1`, not `0`._

## Caching

Responses are cached for 30 seconds in order to improve performance and to avoid hitting Google Sheets’ rate limits, so it might take up to 30 seconds for fresh edits to show up in the API response.

## Recent hosting changes

I’ve moved the hosted instance of opensheet through a couple providers:

- First Vercel, which ended up being too expensive.
- Then Railway, which ended up being a bit unreliable.
- Most recently, Cloudflare Workers!

Note that the base URL is now `opensheet.elk.sh`, not `opensheet.vercel.app`. `opensheet.vercel.app` will continue to redirect to the correct URL, but you should update your code to use `opensheet.elk.sh` to avoid the slight performance degradation that comes from needing to redirect.

## Self-hosting

_This section is only necessary if you want to fork opensheet and host your own instance of it. If you don’t want to deal with that, you’re welcome to use my hosted instance at `opensheet.elk.sh`._

opensheet is written as a [Cloudflare Worker](https://workers.cloudflare.com). It uses Cloudflare’s [Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache) for caching, however note that the Cache API only works on custom domains (not `*.workers.dev` domains).

If you host opensheet in your own Cloudflare account or make a fork, you’ll need to get your own Google Sheets API key:

1. Go to the [Google Cloud Console](https://console.cloud.google.com) and create a new project from the top navigation bar.
2. Search for “Google Sheets API” and enable it.
3. Search for “Credentials” and create an API key. If you want, you can restrict it to only be able to access the Google Sheets API.
4. Run `npm run add-env-variables` and paste in the API key.

## Local development

```sh
npm run dev
```

## Deployment

```sh
npm run deploy
```

## Troubleshooting

For some reason, I was getting the error `Error: expected value at line 1 column 1` when running `npm run dev`. I fixed this by uncommenting the `workers_dev` line and commenting the `route` line in `wrangler.toml`.
