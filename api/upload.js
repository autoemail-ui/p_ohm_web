export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const GAS_URL = process.env.GAS_URL;

  try {
    const gasRes = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'uploadImage', images: req.body.images }),
      redirect: 'follow'
    });
    const gasData = await gasRes.json();
    return res.status(200).json(gasData);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

export const config = {
  api: { bodyParser: { sizeLimit: '50mb' } }
};
