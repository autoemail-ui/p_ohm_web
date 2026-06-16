export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const GAS_URL = process.env.GAS_URL;

  if (!GAS_URL) return res.status(500).json({ success: false, error: 'GAS_URL not configured' });
  if (!req.body || !req.body.image) return res.status(400).json({ success: false, error: 'No image data received' });

  try {
    const payload = JSON.stringify({
      action: 'uploadImage',
      image: req.body.image,
      fileName: req.body.fileName || 'image'
    });

    const gasRes = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      redirect: 'follow'
    });

    const text = await gasRes.text();

    try {
      const gasData = JSON.parse(text);
      return res.status(200).json(gasData);
    } catch (parseErr) {
      return res.status(500).json({ success: false, error: 'GAS response not JSON', raw: text.substring(0, 200) });
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Fetch to GAS failed: ' + err.message });
  }
}
