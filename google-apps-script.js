

function getSS() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss) return ss;
  var id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  return null;
}

function initSheetId() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss) {
    PropertiesService.getScriptProperties().setProperty('SHEET_ID', ss.getId());
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;

    if (action === 'submit') return handleSubmit(data);
    if (action === 'getDropdown') return handleGetDropdown();
    if (action === 'saveDropdown') return handleSaveDropdown(data);
    if (action === 'getTargets') return handleGetTargets(data);
    if (action === 'saveTargets') return handleSaveTargets(data);

    return jsonResponse({ success: false, error: 'Unknown action' });
  } catch (err) {
    return jsonResponse({ success: false, error: err.message });
  } finally {
    lock.releaseLock();
  }
}

function handleSubmit(data) {
  const ss = getSS();
  const sheet = ss.getSheetByName('ข้อมูลรวม');
  const dbSheet = ss.getSheetByName('_database');

  const runningNo = getNextRunningNo(dbSheet);
  const total = Number(data.product) + Number(data.card);
  const perHead = Number(data.customers) > 0 ? total / Number(data.customers) : 0;
  const walletPercent = total > 0 ? (Number(data.tm) / total) * 100 : 0;

  const targetSheet = ss.getSheetByName('ยอดขาย');
  var salesTarget = 0;
  var perHeadTarget = 0;

  var dateParts = data.date.split('/');
  var targetKey = dateParts[2] + '-' + dateParts[1];
  var shiftMap = { 'เช้า': 'Morning', 'บ่าย': 'Afternoon', 'ดึก': 'Night' };
  var shiftSuffix = shiftMap[data.shift] || 'Morning';

  var tLastRow = targetSheet.getLastRow();
  if (tLastRow >= 2) {
    var tRows = targetSheet.getRange(2, 1, tLastRow - 1, 7).getValues();
    for (var ti = 0; ti < tRows.length; ti++) {
      if (String(tRows[ti][0]).trim() === targetKey) {
        var colMap = { 'Morning': [1,4], 'Afternoon': [2,5], 'Night': [3,6] };
        salesTarget = Number(tRows[ti][colMap[shiftSuffix][0]]) || 0;
        perHeadTarget = Number(tRows[ti][colMap[shiftSuffix][1]]) || 0;
        break;
      }
    }
  }

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
  const ss = getSS();
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
  const ss = getSS();
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

function handleGetTargets(data) {
  const ss = getSS();
  const targetSheet = ss.getSheetByName('ยอดขาย');
  const month = data.month;
  const year = data.year;
  const key = year + '-' + String(month).padStart(2, '0');

  const lastRow = targetSheet.getLastRow();
  var result = { salesMorning: 0, salesAfternoon: 0, salesNight: 0, perHeadMorning: 0, perHeadAfternoon: 0, perHeadNight: 0 };

  if (lastRow >= 2) {
    const rows = targetSheet.getRange(2, 1, lastRow - 1, 7).getValues();
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i][0]).trim() === key) {
        result = {
          salesMorning: Number(rows[i][1]) || 0,
          salesAfternoon: Number(rows[i][2]) || 0,
          salesNight: Number(rows[i][3]) || 0,
          perHeadMorning: Number(rows[i][4]) || 0,
          perHeadAfternoon: Number(rows[i][5]) || 0,
          perHeadNight: Number(rows[i][6]) || 0
        };
        break;
      }
    }
  }

  return jsonResponse({ success: true, targets: result, key: key });
}

function handleSaveTargets(data) {
  const ss = getSS();
  const targetSheet = ss.getSheetByName('ยอดขาย');
  const key = data.key;
  const t = data.targets;

  const lastRow = targetSheet.getLastRow();
  var foundRow = -1;

  if (lastRow >= 2) {
    const keys = targetSheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < keys.length; i++) {
      if (String(keys[i][0]).trim() === key) {
        foundRow = i + 2;
        break;
      }
    }
  }

  const rowData = [key, t.salesMorning, t.salesAfternoon, t.salesNight, t.perHeadMorning, t.perHeadAfternoon, t.perHeadNight];

  var writeRow;

  if (foundRow > 0) {
    targetSheet.getRange(foundRow, 1, 1, 7).setValues([rowData]);
    writeRow = foundRow;
  } else {
    targetSheet.appendRow(rowData);
    writeRow = targetSheet.getLastRow();
  }

  targetSheet.getRange(writeRow, 8).setValue(new Date());
  targetSheet.getRange(writeRow, 9).setValue('แก้ไขเป้า ' + key + ': ขายเช้า=' + t.salesMorning + ' บ่าย=' + t.salesAfternoon + ' ดึก=' + t.salesNight + ' | ต่อหัวเช้า=' + t.perHeadMorning + ' บ่าย=' + t.perHeadAfternoon + ' ดึก=' + t.perHeadNight);

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
  initSheetId();
  const ss = getSS();

  let sheet1 = ss.getSheetByName('ข้อมูลรวม');
  if (!sheet1) {
    sheet1 = ss.insertSheet('ข้อมูลรวม');
    sheet1.appendRow(['ลำดับ', 'วันที่', 'ผลัด', 'สินค้า', 'บัตร', 'รวม', 'ลูกค้า', 'ต่อหัว', 'TM', 'Wallet%', 'ทีมงาน', 'เวลาบันทึก']);
  }

  let sheet2 = ss.getSheetByName('ยอดขาย');
  if (!sheet2) {
    sheet2 = ss.insertSheet('ยอดขาย');
    sheet2.appendRow(['key(YYYY-MM)', 'เป้าขายเช้า', 'เป้าขายบ่าย', 'เป้าขายดึก', 'เป้าต่อหัวเช้า', 'เป้าต่อหัวบ่าย', 'เป้าต่อหัวดึก', 'วันที่แก้ไข', 'รายละเอียด']);
  }

  let sheet3 = ss.getSheetByName('_database');
  if (!sheet3) {
    sheet3 = ss.insertSheet('_database');
    sheet3.appendRow(['รันเลข', 'รายชื่อทีมงาน']);
    sheet3.getRange('A2').setValue(0);
  }
}
