function getSS() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss) return ss;
  var id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  return null;
}

function initSheetId() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss) PropertiesService.getScriptProperties().setProperty('SHEET_ID', ss.getId());
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
    if (action === 'getSku') return handleGetSku();
    if (action === 'saveSku') return handleSaveSku(data);
    if (action === 'getFocus') return handleGetFocus();
    if (action === 'saveFocus') return handleSaveFocus(data);
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
  var salesTarget = 0, perHeadTarget = 0, allCafeeTarget = 0;
  var dateParts = data.date.split('/');
  var targetKey = dateParts[2] + '-' + dateParts[1];
  var shiftMap = { 'เช้า': 'Morning', 'บ่าย': 'Afternoon', 'ดึก': 'Night' };
  var shiftSuffix = shiftMap[data.shift] || 'Morning';

  var tLastRow = targetSheet.getLastRow();
  if (tLastRow >= 2) {
    var tKeys = targetSheet.getRange(2, 1, tLastRow - 1, 1).getDisplayValues();
    var tVals = targetSheet.getRange(2, 2, tLastRow - 1, 9).getValues();
    for (var ti = 0; ti < tKeys.length; ti++) {
      if (tKeys[ti][0].trim() === targetKey) {
        var colMap = { 'Morning': [0,3,6], 'Afternoon': [1,4,7], 'Night': [2,5,8] };
        salesTarget = Number(tVals[ti][colMap[shiftSuffix][0]]) || 0;
        perHeadTarget = Number(tVals[ti][colMap[shiftSuffix][1]]) || 0;
        allCafeeTarget = Number(tVals[ti][colMap[shiftSuffix][2]]) || 0;
        break;
      }
    }
  }

  const salesPercent = salesTarget > 0 ? (total / salesTarget) * 100 : 0;
  const perHeadPercent = perHeadTarget > 0 ? (perHead / perHeadTarget) * 100 : 0;
  var skuList = getColumnList(dbSheet, 3);
  var focusList = getColumnList(dbSheet, 4);

  var allCafee = Number(data.allCafee) || 0;
  var allCafeePercent = allCafeeTarget > 0 ? (allCafee / allCafeeTarget) * 100 : 0;

  var focusValues = data.focusValues || {};
  var focusJson = JSON.stringify(focusValues);

  sheet.appendRow([runningNo, data.date, data.shift, Number(data.product), Number(data.card), total, Number(data.customers), perHead, Number(data.tm), walletPercent, data.team, allCafee, focusJson, new Date()]);

  var dailySummary = null;
  if (data.shift === 'ดึก') {
    dailySummary = buildDailySummary(ss, data.date, targetKey);
  }

  return jsonResponse({
    success: true,
    data: {
      runningNo, date: data.date, shift: data.shift,
      product: Number(data.product), card: Number(data.card), total,
      customers: Number(data.customers), perHead: perHead.toFixed(2),
      tm: Number(data.tm), walletPercent: walletPercent.toFixed(2),
      team: data.team,
      allCafee, allCafeeTarget, allCafeePercent: allCafeePercent.toFixed(2),
      salesTarget, salesPercent: salesPercent.toFixed(2),
      perHeadTarget, perHeadPercent: perHeadPercent.toFixed(2),
      focusValues, skuList, focusList, dailySummary
    }
  });
}

function buildDailySummary(ss, dateStr, targetKey) {
  const sheet = ss.getSheetByName('ข้อมูลรวม');
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  const dates = sheet.getRange(2, 2, lastRow - 1, 1).getDisplayValues();
  const rows = sheet.getRange(2, 3, lastRow - 1, 11).getValues();
  var tP = 0, tC = 0, tCust = 0, tTm = 0, tAllOnline = 0, shifts = [];
  var mergedFocus = {};
  for (var i = 0; i < dates.length; i++) {
    if (dates[i][0].trim() === dateStr) {
      tP += Number(rows[i][1]) || 0;
      tC += Number(rows[i][2]) || 0;
      tCust += Number(rows[i][4]) || 0;
      tTm += Number(rows[i][6]) || 0;
      tAllOnline += Number(rows[i][9]) || 0;
      shifts.push(rows[i][0]);
      try {
        var fv = JSON.parse(rows[i][10] || '{}');
        for (var k in fv) { mergedFocus[k] = (mergedFocus[k] || 0) + (Number(fv[k]) || 0); }
      } catch(e) {}
    }
  }
  var gTotal = tP + tC;
  var gPerHead = tCust > 0 ? gTotal / tCust : 0;
  var gWallet = gTotal > 0 ? (tTm / gTotal) * 100 : 0;

  var targetSheet = ss.getSheetByName('ยอดขาย');
  var tLR = targetSheet.getLastRow();
  var dSales = 0, dPerHead = 0, dCafee = 0;
  if (tLR >= 2) {
    var tK = targetSheet.getRange(2, 1, tLR - 1, 1).getDisplayValues();
    var tV = targetSheet.getRange(2, 2, tLR - 1, 9).getValues();
    for (var j = 0; j < tK.length; j++) {
      if (tK[j][0].trim() === targetKey) {
        dSales = (Number(tV[j][0])||0) + (Number(tV[j][1])||0) + (Number(tV[j][2])||0);
        dPerHead = (Number(tV[j][3])||0) + (Number(tV[j][4])||0) + (Number(tV[j][5])||0);
        dCafee = (Number(tV[j][6])||0) + (Number(tV[j][7])||0) + (Number(tV[j][8])||0);
        break;
      }
    }
  }
  var shiftCount = shifts.length || 1;
  var allCafeePercent = dCafee > 0 ? (tAllOnline / dCafee * 100) : 0;
  var avgPerHeadTarget = dPerHead / shiftCount;
  return {
    date: dateStr, shifts: shifts, product: tP, card: tC, total: gTotal,
    customers: tCust, perHead: gPerHead.toFixed(2), tm: tTm,
    walletPercent: gWallet.toFixed(2),
    salesTarget: dSales, salesPercent: dSales > 0 ? (gTotal/dSales*100).toFixed(2) : '0.00',
    perHeadTarget: avgPerHeadTarget, perHeadPercent: avgPerHeadTarget > 0 ? (gPerHead/avgPerHeadTarget*100).toFixed(2) : '0.00',
    allCafee: tAllOnline, allCafeeTarget: dCafee, allCafeePercent: allCafeePercent.toFixed(2),
    focusValues: mergedFocus
  };
}

function handleGetDropdown() {
  const ss = getSS();
  return jsonResponse({ success: true, names: getColumnList(ss.getSheetByName('_database'), 2) });
}

function handleSaveDropdown(data) {
  const ss = getSS();
  saveColumnList(ss.getSheetByName('_database'), 2, data.names || []);
  return jsonResponse({ success: true });
}

function handleGetSku() {
  const ss = getSS();
  return jsonResponse({ success: true, skus: getColumnList(ss.getSheetByName('_database'), 3) });
}

function handleSaveSku(data) {
  const ss = getSS();
  saveColumnList(ss.getSheetByName('_database'), 3, data.skus || []);
  return jsonResponse({ success: true });
}

function handleGetFocus() {
  const ss = getSS();
  return jsonResponse({ success: true, focus: getColumnList(ss.getSheetByName('_database'), 4) });
}

function handleSaveFocus(data) {
  const ss = getSS();
  saveColumnList(ss.getSheetByName('_database'), 4, data.focus || []);
  return jsonResponse({ success: true });
}

function handleGetTargets(data) {
  const ss = getSS();
  const targetSheet = ss.getSheetByName('ยอดขาย');
  const key = data.year + '-' + String(data.month).padStart(2, '0');
  const lastRow = targetSheet.getLastRow();
  var r = { salesMorning:0,salesAfternoon:0,salesNight:0,perHeadMorning:0,perHeadAfternoon:0,perHeadNight:0,cafeeMorning:0,cafeeAfternoon:0,cafeeNight:0 };
  if (lastRow >= 2) {
    const keys = targetSheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
    const vals = targetSheet.getRange(2, 2, lastRow - 1, 9).getValues();
    for (var i = 0; i < keys.length; i++) {
      if (keys[i][0].trim() === key) {
        r = { salesMorning:Number(vals[i][0])||0, salesAfternoon:Number(vals[i][1])||0, salesNight:Number(vals[i][2])||0,
              perHeadMorning:Number(vals[i][3])||0, perHeadAfternoon:Number(vals[i][4])||0, perHeadNight:Number(vals[i][5])||0,
              cafeeMorning:Number(vals[i][6])||0, cafeeAfternoon:Number(vals[i][7])||0, cafeeNight:Number(vals[i][8])||0 };
        break;
      }
    }
  }
  return jsonResponse({ success: true, targets: r, key: key });
}

function handleSaveTargets(data) {
  const ss = getSS();
  const targetSheet = ss.getSheetByName('ยอดขาย');
  const key = data.key;
  const t = data.targets;
  const lastRow = targetSheet.getLastRow();
  var foundRow = -1;
  if (lastRow >= 2) {
    const keys = targetSheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
    for (var i = 0; i < keys.length; i++) {
      if (keys[i][0].trim() === key) { foundRow = i + 2; break; }
    }
  }
  const rowData = [key, t.salesMorning, t.salesAfternoon, t.salesNight, t.perHeadMorning, t.perHeadAfternoon, t.perHeadNight, t.cafeeMorning, t.cafeeAfternoon, t.cafeeNight];
  var writeRow;
  if (foundRow > 0) { targetSheet.getRange(foundRow, 1, 1, 10).setValues([rowData]); writeRow = foundRow; }
  else { targetSheet.appendRow(rowData); writeRow = targetSheet.getLastRow(); }
  targetSheet.getRange(writeRow, 11).setValue(new Date());
  targetSheet.getRange(writeRow, 12).setValue('แก้ไขเป้า ' + key);
  return jsonResponse({ success: true });
}

function getColumnList(dbSheet, col) {
  const lastRow = dbSheet.getLastRow();
  const list = [];
  if (lastRow >= 2) {
    const range = dbSheet.getRange(2, col, lastRow - 1, 1).getValues();
    range.forEach(row => { if (row[0] && row[0].toString().trim() !== '') list.push(row[0].toString().trim()); });
  }
  return list;
}

function saveColumnList(dbSheet, col, items) {
  const lastRow = dbSheet.getLastRow();
  if (lastRow >= 2) dbSheet.getRange(2, col, lastRow - 1, 1).clearContent();
  items.forEach((v, i) => { dbSheet.getRange(i + 2, col).setValue(v); });
}

function getNextRunningNo(dbSheet) {
  let c = Number(dbSheet.getRange('A2').getValue()) || 0;
  c++;
  dbSheet.getRange('A2').setValue(c);
  return c;
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function setupSheets() {
  initSheetId();
  const ss = getSS();
  let s1 = ss.getSheetByName('ข้อมูลรวม');
  if (!s1) { s1 = ss.insertSheet('ข้อมูลรวม'); s1.appendRow(['ลำดับ','วันที่','ผลัด','สินค้า','บัตร','รวม','ลูกค้า','ต่อหัว','TM','Wallet%','ทีมงาน','AllOnline','FocusSKU','เวลาบันทึก']); }
  let s2 = ss.getSheetByName('ยอดขาย');
  if (!s2) { s2 = ss.insertSheet('ยอดขาย'); s2.appendRow(['key(YYYY-MM)','เป้าขายเช้า','เป้าขายบ่าย','เป้าขายดึก','เป้าต่อหัวเช้า','เป้าต่อหัวบ่าย','เป้าต่อหัวดึก','AllOnlineเช้า','AllOnlineบ่าย','AllOnlineดึก','วันที่แก้ไข','รายละเอียด']); }
  let s3 = ss.getSheetByName('_database');
  if (!s3) { s3 = ss.insertSheet('_database'); s3.appendRow(['รันเลข','รายชื่อทีมงาน','SKU','Focus 4SKU']); s3.getRange('A2').setValue(0); }
}
