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
      const flexMessage = buildFlexMessage(d);

      await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${LINE_TOKEN}`
        },
        body: JSON.stringify({
          to: LINE_GROUP_ID,
          messages: [flexMessage]
        })
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

  return {
    type: 'flex',
    altText: `📊 ยอดขายผลัด${d.shift} ${d.date}`,
    contents: {
      type: 'bubble',
      size: 'giga',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'text',
                text: '📊 รายงานยอดขาย',
                weight: 'bold',
                color: '#FFFFFF',
                size: 'lg',
                flex: 0
              }
            ]
          },
          {
            type: 'text',
            text: `${d.date} | ผลัด${d.shift} ${shiftEmoji}`,
            color: '#FFFFFFCC',
            size: 'sm',
            margin: 'sm'
          }
        ],
        backgroundColor: '#1A56DB',
        paddingAll: '20px'
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              buildStatBox('สินค้า', formatNum(d.product), '#1A56DB'),
              buildStatBox('บัตร', formatNum(d.card), '#7C3AED'),
              buildStatBox('ลูกค้า', formatNum(d.customers), '#059669')
            ],
            spacing: 'md'
          },
          {
            type: 'separator',
            margin: 'xl',
            color: '#E5E7EB'
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'text',
                text: '💰 ยอดรวม',
                size: 'md',
                color: '#374151',
                flex: 1
              },
              {
                type: 'text',
                text: formatNum(d.total),
                size: 'xl',
                weight: 'bold',
                color: '#1A56DB',
                align: 'end',
                flex: 1
              }
            ],
            margin: 'xl'
          },
          buildProgressBar('เป้ายอดขาย', d.salesPercent, salesBar, formatNum(d.salesTarget)),
          {
            type: 'separator',
            margin: 'xl',
            color: '#E5E7EB'
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'text',
                text: '👤 ต่อหัว',
                size: 'md',
                color: '#374151',
                flex: 1
              },
              {
                type: 'text',
                text: formatNum(d.perHead),
                size: 'xl',
                weight: 'bold',
                color: '#7C3AED',
                align: 'end',
                flex: 1
              }
            ],
            margin: 'xl'
          },
          buildProgressBar('เป้าต่อหัว', d.perHeadPercent, perHeadBar, formatNum(d.perHeadTarget)),
          {
            type: 'separator',
            margin: 'xl',
            color: '#E5E7EB'
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'text',
                text: '💳 Wallet (TM)',
                size: 'md',
                color: '#374151',
                flex: 2
              },
              {
                type: 'text',
                text: `${formatNum(d.tm)} / ${d.walletPercent}%`,
                size: 'md',
                weight: 'bold',
                color: '#059669',
                align: 'end',
                flex: 2
              }
            ],
            margin: 'xl'
          },
          {
            type: 'separator',
            margin: 'xl',
            color: '#E5E7EB'
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'text',
                text: '👥 ทีมงาน',
                size: 'sm',
                color: '#6B7280',
                flex: 1
              },
              {
                type: 'text',
                text: d.team || '-',
                size: 'sm',
                color: '#374151',
                align: 'end',
                flex: 2,
                wrap: true
              }
            ],
            margin: 'xl'
          }
        ],
        paddingAll: '20px'
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: `#${d.runningNo}`,
            size: 'xs',
            color: '#9CA3AF',
            align: 'end'
          }
        ],
        paddingAll: '12px',
        backgroundColor: '#F9FAFB'
      }
    }
  };
}

function buildStatBox(label, value, color) {
  return {
    type: 'box',
    layout: 'vertical',
    contents: [
      {
        type: 'text',
        text: label,
        size: 'xs',
        color: '#6B7280',
        align: 'center'
      },
      {
        type: 'text',
        text: value,
        size: 'lg',
        weight: 'bold',
        color: color,
        align: 'center',
        margin: 'xs'
      }
    ],
    flex: 1,
    backgroundColor: color + '0D',
    cornerRadius: '8px',
    paddingAll: '12px'
  };
}

function buildProgressBar(label, percent, barWidth, targetVal) {
  return {
    type: 'box',
    layout: 'vertical',
    contents: [
      {
        type: 'box',
        layout: 'horizontal',
        contents: [
          {
            type: 'text',
            text: `${label}: ${targetVal}`,
            size: 'xs',
            color: '#6B7280',
            flex: 2
          },
          {
            type: 'text',
            text: `${percent}%`,
            size: 'xs',
            weight: 'bold',
            color: Number(percent) >= 100 ? '#059669' : '#DC2626',
            align: 'end',
            flex: 1
          }
        ]
      },
      {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'box',
            layout: 'vertical',
            contents: [],
            backgroundColor: Number(percent) >= 100 ? '#059669' : '#3B82F6',
            height: '6px',
            width: barWidth + '%',
            cornerRadius: '3px'
          }
        ],
        backgroundColor: '#E5E7EB',
        height: '6px',
        margin: 'sm',
        cornerRadius: '3px'
      }
    ],
    margin: 'md'
  };
}

function formatNum(n) {
  return Number(n).toLocaleString('en-US');
}
