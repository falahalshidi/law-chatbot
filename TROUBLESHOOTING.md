# حل مشاكل الاتصال - Troubleshooting

## 🔍 تشخيص المشكلة

إذا ظهرت رسالة "عذراً، حدث خطأ في الاتصال"، اتبع الخطوات التالية:

### 1. تحقق من Console

افتح Developer Tools في المتصفح (F12) واذهب إلى تبويب Console. ستجد رسائل تفصيلية عن الخطأ:

- **"Sending request to:"** - يظهر الـ endpoint المستخدم
- **"Response status:"** - يظهر حالة الاستجابة (200 = نجاح، 404 = غير موجود، 401 = غير مصرح، إلخ)
- **"API Error Response:"** - يظهر تفاصيل الخطأ

### 2. المشاكل الشائعة والحلول

#### المشكلة: CORS Error
**الرسالة:** `Access to fetch at ... has been blocked by CORS policy`

**الحل:**
- Pinecone MCP قد لا يدعم CORS من المتصفح مباشرة
- قد تحتاج لاستخدام Proxy server أو Backend API

#### المشكلة: 401 Unauthorized
**الرسالة:** `401` أو `Unauthorized`

**الحل:**
- تحقق من أن مفتاح API صحيح
- تأكد من أن المفتاح لم ينتهي صلاحيته
- تحقق من تنسيق الـ headers

#### المشكلة: 404 Not Found
**الرسالة:** `404` أو `Not Found`

**الحل:**
- تحقق من أن الـ endpoint صحيح
- قد يكون الـ endpoint تغير أو غير متاح

#### المشكلة: Network Error
**الرسالة:** `Failed to fetch` أو `Network error`

**الحل:**
- تحقق من اتصالك بالإنترنت
- قد يكون هناك firewall يمنع الاتصال
- جرب من شبكة أخرى

### 3. استخدام OpenAI مباشرة (بديل)

إذا كان Pinecone MCP لا يعمل، يمكنك استخدام OpenAI API مباشرة:

1. احصل على مفتاح OpenAI API من: https://platform.openai.com/api-keys
2. أنشئ ملف `.env` في جذر المشروع:
   ```env
   VITE_OPENAI_API_KEY=sk-your-openai-key-here
   VITE_USE_OPENAI_DIRECT=true
   ```
3. أعد تشغيل الخادم

### 4. استخدام Backend Proxy (الحل الموصى به)

لتفادي مشاكل CORS، استخدم Backend API كوسيط:

1. أنشئ Backend API (Node.js/Express أو Python/Flask)
2. Backend يتصل بـ Pinecone MCP
3. Frontend يتصل بـ Backend API

مثال Backend (Node.js):
```javascript
app.post('/api/chat', async (req, res) => {
  const response = await fetch(PINECONE_MCP_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Api-Key': PINECONE_API_KEY,
    },
    body: JSON.stringify(req.body),
  });
  const data = await response.json();
  res.json(data);
});
```

ثم في Frontend، غيّر `PINECONE_MCP_ENDPOINT` إلى `http://localhost:3000/api/chat`

### 5. التحقق من تنسيق Pinecone MCP

Pinecone MCP قد يحتاج تنسيق مختلف. جرب:

```javascript
// تنسيق بديل 1
{
  "assistant_id": "lawchatbot",
  "message": userMessage,
  "conversation_history": messages
}

// تنسيق بديل 2
{
  "query": userMessage,
  "context": messages.map(m => m.content).join("\n")
}
```

### 6. اختبار الـ Endpoint مباشرة

استخدم curl أو Postman لاختبار الـ endpoint:

```bash
curl -X POST https://prod-1-data.ke.pinecone.io/mcp/assistants/lawchatbot \
  -H "Content-Type: application/json" \
  -H "Api-Key: pcsk_4SU773_MzhiHDgW7hbCPMpx9jShvaJSxx4avqSLarbrhNaYDQPekQAVE1d3eWJTzCWnfi4" \
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "مرحبا"}]
  }'
```

### 7. معلومات إضافية للمساعدة

عند طلب المساعدة، قدم:
- رسالة الخطأ الكاملة من Console
- حالة الاستجابة (Status Code)
- محتوى الاستجابة (Response Body)
- لقطة شاشة من Network tab في Developer Tools

