const SHEET_ID = 'YOUR_GOOGLE_SHEET_ID';

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;

    if (action === 'submit') return handleSubmit(data);
    if (action === 'getDropdown') return handleGetDropdown();
    if (action === 'saveDropdown') return handleSaveDropdown(data);
    if (action === 'getTargets') return handleGetTargets();
    if (action === 'saveTargets') return handleSaveTargets(data);

    return jsonResponse({ success: false, error: 'Unknown action' });
  } catch (err) {
    return jsonResponse({ success: false, error: err.message });
  } finally {
    lock.releaseLock();
  }
}

function handleSubmit(data) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName('ข้อมูลรวม');
  const dbSheet = ss.getSheetByName('_database');

  const runningNo = getNextRunningNo(dbSheet);
  const total = Number(data.product) + Number(data.card);
  const perHead = Number(data.customers) > 0 ? total / Number(data.customers) : 0;
  const walletPercent = total > 0 ? (Number(data.tm) / total) * 100 : 0;

  const targetSheet = ss.getSheetByName('ยอดขาย');
  const targetData = targetSheet.getRange('A2:B2').getValues()[0];
  const salesTarget = Number(targetData[0]) || 0;
  const perHeadTarget = Number(targetData[1]) || 0;

  const salesPercent = salesTarget > 0 ? (total / salesTarget) * 100 : 0;
  const perHeadPercent = perHeadTarget > 0 ? (perHead / perHeadTarget) * 100 : 0;

  sheet.appendRow([
    runningNo,
    data.date,
    data.shift,
    Number(data.product),
    Number(data.card),
    total,
    Number(data.customers),
    perHead,
    Number(data.tm),
    walletPercent,
    data.team,
    new Date()
  ]);

  return jsonResponse({
    success: true,
    data: {
      runningNo,
      date: data.date,
      shift: data.shift,
      product: Number(data.product),
      card: Number(data.card),
      total,
      customers: Number(data.customers),
      perHead: perHead.toFixed(2),
      tm: Number(data.tm),
      walletPercent: walletPercent.toFixed(2),
      team: data.team,
      salesTarget,
      salesPercent: salesPercent.toFixed(2),
      perHeadTarget,
      perHeadPercent: perHeadPercent.toFixed(2)
    }
  });
}

function handleGetDropdown() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const dbSheet = ss.getSheetByName('_database');
  const lastRow = dbSheet.getLastRow();
  const names = [];

  if (lastRow >= 2) {
    const range = dbSheet.getRange(2, 2, lastRow - 1, 1).getValues();
    range.forEach(row => {
      if (row[0] && row[0].toString().trim() !== '') {
        names.push(row[0].toString().trim());
      }
    });
  }

  return jsonResponse({ success: true, names });
}

function handleSaveDropdown(data) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const dbSheet = ss.getSheetByName('_database');
  const lastRow = dbSheet.getLastRow();

  if (lastRow >= 2) {
    dbSheet.getRange(2, 2, lastRow - 1, 1).clearContent();
  }

  const names = data.names || [];
  names.forEach((name, i) => {
    dbSheet.getRange(i + 2, 2).setValue(name);
  });

  return jsonResponse({ success: true });
}

function handleGetTargets() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const targetSheet = ss.getSheetByName('ยอดขาย');
  const values = targetSheet.getRange('A2:B2').getValues()[0];

  return jsonResponse({
    success: true,
    salesTarget: Number(values[0]) || 0,
    perHeadTarget: Number(values[1]) || 0
  });
}

function handleSaveTargets(data) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const targetSheet = ss.getSheetByName('ยอดขาย');

  const oldValues = targetSheet.getRange('A2:B2').getValues()[0];
  const oldSales = Number(oldValues[0]) || 0;
  const oldPerHead = Number(oldValues[1]) || 0;

  targetSheet.getRange('A2').setValue(Number(data.salesTarget));
  targetSheet.getRange('B2').setValue(Number(data.perHeadTarget));

  const lastRow = targetSheet.getLastRow();
  targetSheet.getRange(lastRow + 1, 3).setValue(new Date());
  targetSheet.getRange(lastRow + 1, 4).setValue('เป้ายอดขาย: ' + oldSales + ' → ' + data.salesTarget);
  targetSheet.getRange(lastRow + 1, 5).setValue('เป้าต่อหัว: ' + oldPerHead + ' → ' + data.perHeadTarget);

  return jsonResponse({ success: true });
}

function getNextRunningNo(dbSheet) {
  let current = Number(dbSheet.getRange('A2').getValue()) || 0;
  current++;
  dbSheet.getRange('A2').setValue(current);
  return current;
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function setupSheets() {
  const ss = SpreadsheetApp.openById(SHEET_ID);

  let sheet1 = ss.getSheetByName('ข้อมูลรวม');
  if (!sheet1) {
    sheet1 = ss.insertSheet('ข้อมูลรวม');
    sheet1.appendRow(['ลำดับ', 'วันที่', 'ผลัด', 'สินค้า', 'บัตร', 'รวม', 'ลูกค้า', 'ต่อหัว', 'TM', 'Wallet%', 'ทีมงาน', 'เวลาบันทึก']);
  }

  let sheet2 = ss.getSheetByName('ยอดขาย');
  if (!sheet2) {
    sheet2 = ss.insertSheet('ยอดขาย');
    sheet2.appendRow(['เป้ายอดขาย', 'เป้าต่อหัว', 'วันที่เปลี่ยน', 'รายละเอียด', 'รายละเอียด2']);
    sheet2.getRange('A2').setValue(0);
    sheet2.getRange('B2').setValue(0);
  }

  let sheet3 = ss.getSheetByName('_database');
  if (!sheet3) {
    sheet3 = ss.insertSheet('_database');
    sheet3.appendRow(['รันเลข', 'รายชื่อทีมงาน']);
    sheet3.getRange('A2').setValue(0);
  }
}
