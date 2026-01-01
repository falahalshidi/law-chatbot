# إعداد ملف .env

## 📝 أنشئ ملف `.env` في جذر المشروع

انسخ المحتوى التالي وأنشئ ملف `.env`:

```env
# Pinecone Configuration
VITE_PINECONE_API_KEY=pcsk_4SU773_MzhiHDgW7hbCPMpx9jShvaJSxx4avqSLarbrhNaYDQPekQAVE1d3eWJTzCWnfi4
VITE_PINECONE_HOST=https://prod-1-data.ke.pinecone.io
VITE_PINECONE_MCP_ENDPOINT=https://prod-1-data.ke.pinecone.io/mcp/assistants/lawchatbot

# Alternative: OpenAI Direct API (if Pinecone doesn't work)
# Get your key from: https://platform.openai.com/api-keys
# VITE_OPENAI_API_KEY=sk-your-openai-api-key-here
# VITE_USE_OPENAI_DIRECT=true
```

## ✅ الخطوات

1. أنشئ ملف جديد باسم `.env` في نفس المجلد الذي يحتوي على `package.json`
2. انسخ المحتوى أعلاه
3. احفظ الملف
4. أعد تشغيل الخادم: `npm run dev`

## 🔒 الأمان

- **لا ترفع ملف `.env` إلى Git!** 
- الملف موجود في `.gitignore` بالفعل
- المفاتيح حساسة ويجب عدم مشاركتها

