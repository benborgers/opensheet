// I'm using a serverless function to redirect instead of vercel.json
// because I can't figure out how to make vercel.json's redirects
// respect setting a CORS header.

module.exports = (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");

  res.status(301);
  res.setHeader("location", `https://opensheet.elk.sh${req.url}`);
  res.send();
};
