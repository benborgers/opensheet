import { extname } from "path"
import { google } from 'googleapis'

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT), // Added in Vercel dashboard
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
})

const sheets = google.sheets({ version: 'v4', auth })

// A map of response handler based on requested format.
const responders = {
  ".json": function(res, { error, rows }) {
    if (error) {
      return res.json({ error })
    }

    return res.json(rows)
  },
  ".xml": function(res, { error, id, sheet, rows }) {
    res.setHeader('Content-Type', 'text/xml')

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';

    if (error) {
      xml += `<error>${error}</error>`
    } else {
      const rowName = sheet.replace(/\s/g, '')
      xml += `<spreadsheet id="${id}">\n`
      rows.forEach(row => {
        xml += `<${rowName}>\n`
        Object.keys(row).forEach(header => {
          const headerName = header.replace(/\s/g, '')
          xml += `<${headerName}>${row[header]}</${headerName}>\n`
        })
        xml += `</${rowName}>\n`
      })
      xml += '</spreadsheet>'
    }

    return res.send(xml)
  }
}

export default async function (req, res) {
  let { id, sheet } = req.query

  const format = extname(sheet) || '.json'
  sheet = sheet.replace(format, '')

  const responder = responders[format]

  // Allow any other website to access this API.
  res.setHeader('Access-Control-Allow-Origin', '*')

  if (! isNaN(sheet)) {
    const { data } = await sheets.spreadsheets.get({
      spreadsheetId: id
    })

    if (parseInt(sheet) === 0) {
      return responder(res, { error: 'For this API, sheet numbers start at 1' })
    }

    const sheetIndex = parseInt(sheet) - 1

    if (!data.sheets[sheetIndex]) {
      return responder(res, { error: `There is no sheet number ${sheet}` })
    }

    sheet = data.sheets[sheetIndex].properties.title
  }

  sheets.spreadsheets.values.get({
    spreadsheetId: id,
    range: sheet
  }, (error, result) => {
    if (error) {
      return responder(res, { error: error.response.data.error.message })
    }

    const rows = []

    const rawRows = result.data.values
    const headers = rawRows.shift()

    rawRows.forEach(row => {
      const rowData = {}
      row.forEach((item, index) => {
        rowData[headers[index]] = item
      })
      rows.push(rowData)
    })

    // Cache rows for 30 seconds.
    res.setHeader('Cache-Control', 's-maxage=30')
    return responder(res, {
      id,
      sheet,
      rows,
    })
  })
}
