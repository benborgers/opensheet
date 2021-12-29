# opensheet

A free API for getting Google Sheets as JSON.

**Tutorial blog post:** [benborgers.com/posts/google-sheets-json](https://benborgers.com/posts/google-sheets-json)

**If you have questions:** [benborgers.com/contact](https://benborgers.com/contact)

## Documentation

This API returns a given Google Sheet’s rows as JSON data. In order to use it, the first column of your Google Sheet should be column headers. [Here’s an example](https://docs.google.com/spreadsheets/d/1o5t26He2DzTweYeleXOGiDjlU4Jkx896f95VUHVgS8U/edit).

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

## Recent hosting changes

I’ve moved the hosted instance from [Vercel](https://vercel.com) to [Railway](https://railway.app), and therefore the base URL has changed from `opensheet.vercel.app` to `opensheet.elk.sh`. `opensheet.vercel.app` will continue to redirect to the correct URL, but you should update your code to use `opensheet.elk.sh` to avoid the slight performance hit that comes from needing to redirect.

## Self-hosting

_This section is only necessary if you want to fork opensheet and host your own instance of it. If you don’t want to deal with that, you’re welcome to use my hosted instance at `opensheet.elk.sh`._

opensheet is written as a Node.js [Express](https://expressjs.com) server, which can be hosted on any platform that enables deploying a Node.js server. It also uses a Redis server for caching, but will run fine without caching if Redis isn’t present.

If you host opensheet in your own Railway account or make a fork, you’ll need to get your own Google Sheets API credentials:

1. Go to the [Google Cloud Console](https://console.cloud.google.com) and create a new project from the top navigation bar.
2. Search for “Google Sheets API” and enable it.
3. On the left bar, go to Credentials and click “Create Credentials” → “Service account”. _Service accounts_ are Google’s concept for a Google account that you can control programmatically.
4. Fill in any reasonable name, and skip the next two optional steps. Click “Done” to create the set of credentials, which will allow you to access Google Sheets using the API.
5. Click on this newly created service account, and then go to the “Keys” tab. Create a key of type JSON.
6. A JSON file containing the service account’s credentials will be downloaded. Open up that file, and copy its entire contents. **You should paste this whole thing into the `GOOGLE_SERVICE_ACCOUNT` environment variable.** Procedures for doing this vary based on deployment provider (Railway, Heroku, etc).

## Local development

```sh
npm run dev
```

This uses `railway run`, and therefore assumes that you have the [Railway CLI](https://docs.railway.app/develop/cli) installed and have [linked it to your project](https://docs.railway.app/develop/cli#link-to-a-project).

The benefit of using `railway run` in local development is that it injects environment variables (`GOOGLE_SERVICE_ACCOUNT` and `REDIS_URL`) without needing to have them locally.
