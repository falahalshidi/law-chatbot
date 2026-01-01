# حل مشكلة "Failed to fetch" / CORS Error

## 🔴 المشكلة

خطأ "Failed to fetch" يحدث عادة بسبب:
- **CORS (Cross-Origin Resource Sharing)**: Pinecone MCP لا يسمح بالطلبات من المتصفح مباشرة
- الـ endpoint غير متاح أو محظور

## ✅ الحلول

### الحل 1: استخدام Vite Proxy (مُفعّل تلقائياً)

تم إضافة Vite proxy في `vite.config.ts`. في وضع التطوير (development)، سيتم استخدام proxy تلقائياً.

**لا حاجة لإجراء أي شيء - فقط أعد تشغيل الخادم:**

```bash
npm run dev
```

### الحل 2: استخدام OpenAI مباشرة (موصى به)

إذا لم يعمل Pinecone MCP، استخدم OpenAI API مباشرة:

1. **احصل على مفتاح OpenAI:**
   - اذهب إلى: https://platform.openai.com/api-keys
   - أنشئ حساب أو سجل دخول
   - أنشئ مفتاح API جديد

2. **أنشئ ملف `.env` في جذر المشروع:**
   ```env
   VITE_OPENAI_API_KEY=sk-your-openai-key-here
   VITE_USE_OPENAI_DIRECT=true
   ```

3. **أعد تشغيل الخادم:**
   ```bash
   npm run dev
   ```

### الحل 3: إنشاء Backend Proxy (للإنتاج)

للإنتاج، أنشئ Backend API كوسيط:

#### باستخدام Node.js/Express:

```javascript
// server.js
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/chat', async (req, res) => {
  try {
    const response = await fetch('https://prod-1-data.ke.pinecone.io/mcp/assistants/lawchatbot', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Api-Key': 'pcsk_4SU773_MzhiHDgW7hbCPMpx9jShvaJSxx4avqSLarbrhNaYDQPekQAVE1d3eWJTzCWnfi4',
      },
      body: JSON.stringify(req.body),
    });
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
```

ثم غيّر `PINECONE_MCP_ENDPOINT` في `.env` إلى:
```env
VITE_PINECONE_MCP_ENDPOINT=http://localhost:3000/api/chat
```

## 🔍 التحقق من الحل

1. افتح Developer Tools (F12)
2. اذهب إلى Console
3. أرسل رسالة
4. تحقق من:
   - "Using proxy: true" - يعني أن Proxy يعمل
   - "Response status: 200" - يعني أن الطلب نجح

## 📝 ملاحظات

- **Vite Proxy** يعمل فقط في وضع التطوير (`npm run dev`)
- للإنتاج، استخدم **Backend Proxy** أو **OpenAI مباشرة**
- **OpenAI مباشرة** هو الأسهل والأسرع

## 🚀 الخطوات السريعة

**للحل السريع:**
1. احصل على مفتاح OpenAI من https://platform.openai.com/api-keys
2. أنشئ ملف `.env`:
   ```env
   VITE_OPENAI_API_KEY=sk-your-key
   VITE_USE_OPENAI_DIRECT=true
   ```
3. أعد تشغيل: `npm run dev`

**جاهز!** 🎉

