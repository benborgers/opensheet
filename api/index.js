import { google } from 'googleapis'

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT), // Added in Vercel dashboard
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
})

const sheets = google.sheets({ version: 'v4', auth })

export default async function (req, res) {
  const { id, sheet } = req.query

  sheets.spreadsheets.values.get({
    spreadsheetId: id,
    range: sheet
  }, (error, result) => {
    if(error) {
      return res.json({ error: error.response.data.error.message })
    }

    const rows = []

    const rawRows = result.data.values
    const headers = rawRows.shift()

    rawRows.forEach(row => {
      const rowData = {}
      row.forEach((item, index) => {
        rowData[headers[index]] = item
        rows.push(rowData)
      })
    })

    return res.json(rows)
  })
}
