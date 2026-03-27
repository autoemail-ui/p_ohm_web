export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const GAS_URL = process.env.GAS_URL;
  const LINE_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const LINE_GROUP_ID = process.env.LINE_GROUP_ID;

  try {
    const body = req.body;
    const gasRes = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      redirect: 'follow'
    });
    const gasData = await gasRes.json();

    if (body.action === 'submit' && gasData.success) {
      const d = gasData.data;
      const messages = [buildFlexMessage(d)];

      if (d.dailySummary) {
        messages.push(buildDailySummaryFlex(d.dailySummary, d.skuList, d.focusList));
      }

      await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${LINE_TOKEN}` },
        body: JSON.stringify({ to: LINE_GROUP_ID, messages })
      });
    }

    return res.status(200).json(gasData);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

function buildFlexMessage(d) {
  const shiftEmoji = d.shift === 'เช้า' ? '🌅' : d.shift === 'บ่าย' ? '🌤️' : '🌙';
  const salesBar = Math.min(Number(d.salesPercent), 100);
  const perHeadBar = Math.min(Number(d.perHeadPercent), 100);

  var bodyContents = [];

  bodyContents.push({
    type: 'box', layout: 'horizontal', contents: [
      { type: 'text', text: '👥 ทีมงาน', size: 'sm', color: '#6B7280', flex: 1 },
      { type: 'text', text: d.team || '-', size: 'sm', color: '#F1F5F9', align: 'end', flex: 2, wrap: true, weight: 'bold' }
    ]
  });
  bodyContents.push({ type: 'separator', margin: 'lg', color: '#E5E7EB' });

  bodyContents.push({
    type: 'box', layout: 'horizontal', spacing: 'md', margin: 'lg', contents: [
      buildStatBox('สินค้า', formatNum(d.product), '#1A56DB'),
      buildStatBox('บัตร', formatNum(d.card), '#7C3AED'),
      buildStatBox('ลูกค้า', formatNum(d.customers), '#059669')
    ]
  });

  bodyContents.push({ type: 'separator', margin: 'xl', color: '#E5E7EB' });
  bodyContents.push({
    type: 'box', layout: 'horizontal', margin: 'xl', contents: [
      { type: 'text', text: '💰 ยอดรวม', size: 'md', color: '#374151', flex: 1 },
      { type: 'text', text: formatNum(d.total), size: 'xl', weight: 'bold', color: '#1A56DB', align: 'end', flex: 1 }
    ]
  });
  bodyContents.push(buildProgressBar('เป้ายอดขาย', d.salesPercent, salesBar, formatNum(d.salesTarget)));

  bodyContents.push({ type: 'separator', margin: 'xl', color: '#E5E7EB' });
  bodyContents.push({
    type: 'box', layout: 'horizontal', margin: 'xl', contents: [
      { type: 'text', text: '👤 ต่อหัว', size: 'md', color: '#374151', flex: 1 },
      { type: 'text', text: formatNum(d.perHead), size: 'xl', weight: 'bold', color: '#7C3AED', align: 'end', flex: 1 }
    ]
  });
  bodyContents.push(buildProgressBar('เป้าต่อหัว', d.perHeadPercent, perHeadBar, formatNum(d.perHeadTarget)));

  bodyContents.push({ type: 'separator', margin: 'xl', color: '#E5E7EB' });
  bodyContents.push({
    type: 'box', layout: 'horizontal', margin: 'xl', contents: [
      { type: 'text', text: '💳 Wallet (TM)', size: 'md', color: '#374151', flex: 2 },
      { type: 'text', text: `${formatNum(d.tm)} / ${d.walletPercent}%`, size: 'md', weight: 'bold', color: '#059669', align: 'end', flex: 2 }
    ]
  });

  if (d.allCafeeTarget > 0 || d.allCafee > 0) {
    bodyContents.push({ type: 'separator', margin: 'xl', color: '#E5E7EB' });
    bodyContents.push({
      type: 'box', layout: 'horizontal', margin: 'xl', contents: [
        { type: 'text', text: '☕ All Cafee', size: 'md', color: '#374151', flex: 2 },
        { type: 'text', text: formatNum(d.allCafee), size: 'xl', weight: 'bold', color: '#D97706', align: 'end', flex: 1 }
      ]
    });
    if (d.allCafeeTarget > 0) {
      const cafeeBar = Math.min(Number(d.allCafeePercent), 100);
      bodyContents.push(buildProgressBar('เป้า All Cafee', d.allCafeePercent, cafeeBar, formatNum(d.allCafeeTarget)));
    }
  }

  if (d.focusList && d.focusList.length > 0) {
    bodyContents.push({ type: 'separator', margin: 'xl', color: '#E5E7EB' });
    bodyContents.push({ type: 'text', text: '🎯 Focus 4SKU', size: 'sm', color: '#6B7280', margin: 'xl' });
    const fv = d.focusValues || {};
    bodyContents.push({
      type: 'box', layout: 'vertical', margin: 'sm', contents: d.focusList.map(f => ({
        type: 'box', layout: 'horizontal', margin: 'xs', contents: [
          { type: 'text', text: '• ' + f, size: 'sm', color: '#F59E0B', flex: 3 },
          { type: 'text', text: fv[f] ? formatNum(fv[f]) : '-', size: 'sm', weight: 'bold', color: '#F1F5F9', align: 'end', flex: 1 }
        ]
      }))
    });
  }

  if (d.skuList && d.skuList.length > 0) {
    bodyContents.push({ type: 'separator', margin: 'xl', color: '#E5E7EB' });
    bodyContents.push({ type: 'text', text: '📦 รายการ SKU', size: 'sm', color: '#6B7280', margin: 'xl' });
    bodyContents.push({
      type: 'box', layout: 'vertical', margin: 'sm', contents: d.skuList.map(s => ({
        type: 'text', text: '• ' + s, size: 'xs', color: '#94A3B8', margin: 'xs'
      }))
    });
  }

  return {
    type: 'flex',
    altText: `📊 ยอดขายผลัด${d.shift} ${d.date}`,
    contents: {
      type: 'bubble', size: 'giga',
      header: {
        type: 'box', layout: 'vertical', backgroundColor: '#1A56DB', paddingAll: '20px', contents: [
          { type: 'text', text: '📊 รายงานยอดขาย', weight: 'bold', color: '#FFFFFF', size: 'lg' },
          { type: 'text', text: `${d.date} | ผลัด${d.shift} ${shiftEmoji}`, color: '#FFFFFFCC', size: 'sm', margin: 'sm' }
        ]
      },
      body: { type: 'box', layout: 'vertical', paddingAll: '20px', contents: bodyContents },
      footer: {
        type: 'box', layout: 'vertical', paddingAll: '12px', backgroundColor: '#F9FAFB', contents: [
          { type: 'text', text: `#${d.runningNo}`, size: 'xs', color: '#9CA3AF', align: 'end' }
        ]
      }
    }
  };
}

function buildDailySummaryFlex(s, skuList, focusList) {
  const salesBar = Math.min(Number(s.salesPercent), 100);
  const perHeadBar = Math.min(Number(s.perHeadPercent), 100);

  var bodyContents = [
    {
      type: 'box', layout: 'horizontal', spacing: 'md', contents: [
        buildStatBox('สินค้า', formatNum(s.product), '#1A56DB'),
        buildStatBox('บัตร', formatNum(s.card), '#7C3AED'),
        buildStatBox('ลูกค้า', formatNum(s.customers), '#059669')
      ]
    },
    { type: 'separator', margin: 'xl', color: '#E5E7EB' },
    {
      type: 'box', layout: 'horizontal', margin: 'xl', contents: [
        { type: 'text', text: '💰 ยอดรวมทั้งวัน', size: 'md', color: '#374151', flex: 2 },
        { type: 'text', text: formatNum(s.total), size: 'xl', weight: 'bold', color: '#1A56DB', align: 'end', flex: 1 }
      ]
    },
    buildProgressBar('เป้ารวมวัน', s.salesPercent, salesBar, formatNum(s.salesTarget)),
    { type: 'separator', margin: 'xl', color: '#E5E7EB' },
    {
      type: 'box', layout: 'horizontal', margin: 'xl', contents: [
        { type: 'text', text: '👤 ต่อหัวเฉลี่ย', size: 'md', color: '#374151', flex: 1 },
        { type: 'text', text: formatNum(s.perHead), size: 'xl', weight: 'bold', color: '#7C3AED', align: 'end', flex: 1 }
      ]
    },
    buildProgressBar('เป้าต่อหัวรวม', s.perHeadPercent, perHeadBar, formatNum(s.perHeadTarget)),
    { type: 'separator', margin: 'xl', color: '#E5E7EB' },
    {
      type: 'box', layout: 'horizontal', margin: 'xl', contents: [
        { type: 'text', text: '💳 Wallet รวม', size: 'md', color: '#374151', flex: 2 },
        { type: 'text', text: `${formatNum(s.tm)} / ${s.walletPercent}%`, size: 'md', weight: 'bold', color: '#059669', align: 'end', flex: 2 }
      ]
    }
  ];

  if (s.allCafeeTarget > 0 || s.allCafee > 0) {
    bodyContents.push({ type: 'separator', margin: 'xl', color: '#E5E7EB' });
    bodyContents.push({
      type: 'box', layout: 'horizontal', margin: 'xl', contents: [
        { type: 'text', text: '☕ All Cafee รวม', size: 'md', color: '#374151', flex: 2 },
        { type: 'text', text: formatNum(s.allCafee), size: 'xl', weight: 'bold', color: '#D97706', align: 'end', flex: 1 }
      ]
    });
    if (s.allCafeeTarget > 0) {
      const cafeeBar = Math.min(Number(s.allCafeePercent), 100);
      bodyContents.push(buildProgressBar('เป้า All Cafee', s.allCafeePercent, cafeeBar, formatNum(s.allCafeeTarget)));
    }
  }

  const sfv = s.focusValues || {};
  const sfvKeys = Object.keys(sfv);
  if (sfvKeys.length > 0) {
    bodyContents.push({ type: 'separator', margin: 'xl', color: '#E5E7EB' });
    bodyContents.push({ type: 'text', text: '🎯 Focus 4SKU รวมวัน', size: 'sm', color: '#6B7280', margin: 'xl' });
    bodyContents.push({
      type: 'box', layout: 'vertical', margin: 'sm', contents: sfvKeys.map(k => ({
        type: 'box', layout: 'horizontal', margin: 'xs', contents: [
          { type: 'text', text: '• ' + k, size: 'sm', color: '#F59E0B', flex: 3 },
          { type: 'text', text: formatNum(sfv[k]), size: 'sm', weight: 'bold', color: '#F1F5F9', align: 'end', flex: 1 }
        ]
      }))
    });
  }

  return {
    type: 'flex',
    altText: `📋 สรุปยอดขายทั้งวัน ${s.date}`,
    contents: {
      type: 'bubble', size: 'giga',
      header: {
        type: 'box', layout: 'vertical', backgroundColor: '#7C3AED', paddingAll: '20px', contents: [
          { type: 'text', text: '📋 สรุปยอดขายทั้งวัน', weight: 'bold', color: '#FFFFFF', size: 'lg' },
          { type: 'text', text: `${s.date} | ผลัด: ${s.shifts.join(', ')}`, color: '#FFFFFFCC', size: 'sm', margin: 'sm' }
        ]
      },
      body: { type: 'box', layout: 'vertical', paddingAll: '20px', contents: bodyContents }
    }
  };
}

function buildStatBox(label, value, color) {
  return {
    type: 'box', layout: 'vertical', flex: 1, backgroundColor: color + '0D', cornerRadius: '8px', paddingAll: '12px', contents: [
      { type: 'text', text: label, size: 'xs', color: '#6B7280', align: 'center' },
      { type: 'text', text: value, size: 'lg', weight: 'bold', color: color, align: 'center', margin: 'xs' }
    ]
  };
}

function buildProgressBar(label, percent, barWidth, targetVal) {
  return {
    type: 'box', layout: 'vertical', margin: 'md', contents: [
      {
        type: 'box', layout: 'horizontal', contents: [
          { type: 'text', text: `${label}: ${targetVal}`, size: 'xs', color: '#6B7280', flex: 2 },
          { type: 'text', text: `${percent}%`, size: 'xs', weight: 'bold', color: Number(percent) >= 100 ? '#059669' : '#DC2626', align: 'end', flex: 1 }
        ]
      },
      {
        type: 'box', layout: 'vertical', backgroundColor: '#E5E7EB', height: '6px', margin: 'sm', cornerRadius: '3px', contents: [
          { type: 'box', layout: 'vertical', backgroundColor: Number(percent) >= 100 ? '#059669' : '#3B82F6', height: '6px', width: barWidth + '%', cornerRadius: '3px', contents: [] }
        ]
      }
    ]
  };
}

function formatNum(n) {
  return Number(n).toLocaleString('en-US');
}
