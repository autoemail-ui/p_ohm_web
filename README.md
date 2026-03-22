# 📊 ระบบรายงานยอดขาย

## โครงสร้างไฟล์

```
sales-report/
├── api/
│   └── submit.js          ← Vercel API route
├── public/
│   └── index.html         ← หน้าเว็บหลัก
├── google-apps-script.js  ← โค้ดสำหรับ Google Apps Script
├── .env.example
├── vercel.json
└── package.json
```

---

## ขั้นตอนที่ 1: ตั้งค่า Google Sheet

1. สร้าง Google Sheet ใหม่
2. คัดลอก **Sheet ID** จาก URL (ส่วนที่อยู่ระหว่าง `/d/` กับ `/edit`)
3. ไปที่ **Extensions > Apps Script**
4. ลบโค้ดเดิมทิ้ง แล้ววางโค้ดจากไฟล์ `google-apps-script.js`
5. แก้ไข `YOUR_GOOGLE_SHEET_ID` เป็น Sheet ID ของคุณ
6. รันฟังก์ชัน `setupSheets()` ครั้งเดียวเพื่อสร้างชีททั้ง 3
7. Deploy:
   - กด **Deploy > New deployment**
   - เลือก Type = **Web app**
   - Execute as = **Me**
   - Who has access = **Anyone**
   - กด **Deploy** แล้วคัดลอก URL ไว้

---

## ขั้นตอนที่ 2: ตั้งค่า LINE Messaging API

1. ไปที่ [LINE Developers Console](https://developers.line.biz/)
2. เปิด Channel ที่จะใช้
3. คัดลอก **Channel Access Token** (Long-lived)
4. **Group ID**: เชิญ Bot เข้ากลุ่มไลน์ แล้วหา Group ID ได้จาก Webhook event

---

## ขั้นตอนที่ 3: Deploy ขึ้น Vercel

1. สร้าง GitHub Repository ใหม่
2. Push โฟลเดอร์ `sales-report` ขึ้น GitHub
3. ไปที่ [vercel.com](https://vercel.com) แล้ว Import โปรเจกต์
4. ตั้ง **Environment Variables** ใน Vercel:

| ชื่อ | ค่า |
|------|-----|
| `GAS_URL` | URL ที่ได้จาก Google Apps Script Deploy |
| `LINE_CHANNEL_ACCESS_TOKEN` | Channel Access Token จาก LINE |
| `LINE_GROUP_ID` | Group ID ของกลุ่มไลน์ |

5. กด **Deploy**

---

## การใช้งาน

- **กรอกข้อมูล**: เปิดเว็บ → กรอกวันที่ ผลัด ยอดขาย → กดบันทึก
- **ตั้งค่า**: กดปุ่มเฟือง ⚙️ → กรอก PIN `0000`
  - **แก้ไข Dropdown**: เพิ่ม/ลบ/สลับลำดับรายชื่อทีมงาน
  - **แก้ไขเป้าหมาย**: เปลี่ยนเป้ายอดขายและเป้าต่อหัว
- **LINE แจ้งเตือน**: ระบบจะส่ง Flex Message สวยๆ เข้ากลุ่มทุกครั้งที่บันทึก

---

## สูตรคำนวณ

| ฟิลด์ | สูตร |
|-------|------|
| รวม | สินค้า + บัตร |
| ต่อหัว | รวม ÷ ลูกค้า |
| Wallet% | (TM ÷ รวม) × 100 |
| % เป้ายอดขาย | (รวม ÷ เป้ายอดขาย) × 100 |
| % เป้าต่อหัว | (ต่อหัว ÷ เป้าต่อหัว) × 100 |

---

## PIN เริ่มต้น

`0000` (แก้ไขได้ในโค้ด index.html บรรทัดที่เช็ค `pinValue === '0000'`)
