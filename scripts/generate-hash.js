import crypto from 'crypto';

const password = process.argv[2] || 'admin123';
const salt = crypto.randomBytes(16);
const hash = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');

const saltBase64 = salt.toString('base64');
const hashBase64 = hash.toString('base64');
const fullHash = `${saltBase64}:${hashBase64}`;

console.log('\n✅ Hash تم إنشاؤه بنجاح!\n');
console.log('Hash:', fullHash);
console.log('\n📋 انسخ الأمر التالي والصقه في Supabase SQL Editor:\n');
console.log(`UPDATE users SET password_hash = '${fullHash}' WHERE email = 'admin@example.com';\n`);
console.log(`⚠️  استخدم كلمة المرور: ${password} لتسجيل الدخول\n`);

