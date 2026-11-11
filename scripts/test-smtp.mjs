import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import nodemailer from '../backend/node_modules/nodemailer/dist/esm/nodemailer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../backend/.env');

// Simple .env parser to avoid extra dependencies
function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  const env = {};
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    let val = line.slice(eqIdx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

const env = { ...loadEnv(envPath), ...process.env };

const host = (env.SMTP_HOST || '').trim();
const rawPort = env.SMTP_PORT || 465;
const port = Number(rawPort) || 465;
const rawSecure = (env.SMTP_SECURE || '').trim().toLowerCase();
const secure = rawSecure === 'true' || rawSecure === '1' || port === 465;
const user = (env.SMTP_USER || '').trim();
const pass = (env.SMTP_PASS || '').trim();
const from = env.SMTP_FROM || 'Trung Tâm TD Hán Ngữ <onboarding@resend.dev>';
const targetRecipient = process.argv[2];

console.log('--- KIỂM TRA CẤU HÌNH GỬI EMAIL (RESEND / SMTP) ---');
console.log(`- SMTP_HOST   : ${host || '(Chưa cấu hình)'}`);
console.log(`- SMTP_PORT   : ${port}`);
console.log(`- SMTP_SECURE : ${secure}`);
console.log(`- SMTP_USER   : ${user || '(Chưa cấu hình)'}`);
console.log(`- SMTP_PASS   : ${pass ? pass.slice(0, 6) + '...' + pass.slice(-4) : '(Chưa cấu hình)'}`);
console.log(`- SMTP_FROM   : ${from}`);
console.log('----------------------------------------------------');

if (!host) {
  console.error('❌ Lỗi: Chưa khai báo SMTP_HOST trong backend/.env');
  process.exit(1);
}

if (!user || !pass) {
  console.error('❌ Lỗi: Chưa khai báo SMTP_USER hoặc SMTP_PASS trong backend/.env');
  console.error('👉 Với Resend: SMTP_USER=resend, SMTP_PASS=re_xxxxxxxxx (API Key)');
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host,
  port,
  secure,
  auth: {
    user,
    pass,
  },
  connectionTimeout: 15_000,
  greetingTimeout: 10_000,
  socketTimeout: 15_000,
});

async function main() {
  try {
    console.log('⏳ Đang kiểm tra kết nối tới SMTP server...');
    await transporter.verify();
    console.log('✅ Kết nối và xác thực SMTP thành công!');

    if (!targetRecipient) {
      console.log('\n💡 Mẹo: Bạn có thể chạy lệnh sau để gửi thử một email thật:');
      console.log('   node scripts/test-smtp.mjs <dia-chi-email-nhan>');
      console.log('   (Lưu ý: Với domain test onboarding@resend.dev của Resend, bạn cần gửi tới email đăng ký tài khoản Resend)');
      return;
    }

    console.log(`\n⏳ Đang gửi thử 1 email tới: ${targetRecipient} ...`);
    const info = await transporter.sendMail({
      from,
      to: targetRecipient,
      subject: '[WebEdu] Thử nghiệm gửi email qua Resend SMTP',
      text: 'Xin chào!\n\nĐây là email kiểm tra hệ thống gửi mail của WebEdu (Trung Tâm TD Hán Ngữ) qua dịch vụ Resend.\nNếu bạn nhận được email này, tính năng gửi email đã hoạt động chính xác 100%!',
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1c1917; max-width: 560px; padding: 20px; border: 1px solid #e7e5e4; border-radius: 8px;">
          <h2 style="color: #991b1b; margin-top: 0;">Trung Tâm TD Hán Ngữ</h2>
          <p>Xin chào,</p>
          <p>Đây là email kiểm tra hệ thống gửi email của <strong>WebEdu</strong> qua dịch vụ <strong>Resend SMTP</strong>.</p>
          <div style="background: #f5f5f4; padding: 12px 16px; border-radius: 6px; margin: 16px 0;">
            <p style="margin: 0; font-weight: bold; color: #15803d;">✔ Cấu hình SMTP thành công!</p>
            <p style="margin: 4px 0 0 0; font-size: 13px; color: #57534e;">Thời gian gửi: ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</p>
          </div>
          <p style="font-size: 13px; color: #78716c;">Email này được gửi tự động từ hệ thống WebEdu.</p>
        </div>
      `,
    });

    console.log('🎉 GỬI EMAIL THÀNH CÔNG!');
    console.log(`- Message ID: ${info.messageId}`);
    if (info.response) {
      console.log(`- Response  : ${info.response}`);
    }
  } catch (error) {
    console.error('\n❌ GỬI EMAIL THẤT BẠI!');
    console.error(`Chi tiết lỗi: ${error.message}`);
    if (error.response) {
      console.error(`Mã phản hồi SMTP: ${error.response}`);
    }
    if (error.message.includes('535') || error.message.includes('Authentication')) {
      console.error('👉 Nguyên nhân: Sai API Key của Resend (SMTP_PASS) hoặc sai SMTP_USER (phải là "resend").');
    } else if (error.message.includes('validation_error') || error.message.includes('from')) {
      console.error('👉 Nguyên nhân: Địa chỉ gửi (SMTP_FROM) chưa được verify domain trên Resend.');
      console.error('   Nếu chưa có domain, hãy dùng: SMTP_FROM="Trung Tâm TD Hán Ngữ <onboarding@resend.dev>"');
      console.error('   và chỉ gửi tới chính địa chỉ email bạn dùng để đăng ký Resend.');
    }
    process.exit(1);
  }
}

main();
