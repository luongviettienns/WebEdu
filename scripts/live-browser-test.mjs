import { chromium } from '../frontend/node_modules/@playwright/test/index.mjs';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const SCREENSHOTS_DIR = 'C:/Users/ASUS/.gemini/antigravity/brain/f796f1e4-fbd0-4e44-ba1f-3f57879fdc62/screenshots';
fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

async function runLiveTest() {
  console.log('🔄 Đang làm mới dữ liệu CSDL chuẩn về trạng thái sạch...');
  execSync('node backend/prisma/seed.mjs', { stdio: 'inherit' });

  console.log('🚀 Đang khởi động trình duyệt Chromium trực quan trên màn hình...');
  
  let browser;
  try {
    browser = await chromium.launch({
      headless: false,
      slowMo: 600, // 600ms giữa các thao tác để người dùng quan sát mượt mà
    });
  } catch (err) {
    console.log('⚠️ Không mở được giao diện headless:false, chuyển sang headless:true:', err.message);
    browser = await chromium.launch({ headless: true });
  }

  try {
    // ==========================================
    // KỊCH BẢN 1: HỌC VIÊN VỊ THÀNH NIÊN ĐĂNG KÝ
    // ==========================================
    console.log('\n--- [KỊCH BẢN 1] Học viên 14 tuổi đăng ký tài khoản (kèm phụ huynh) ---');
    const studentContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const studentPage = await studentContext.newPage();

    await studentPage.goto('http://localhost:3000/register');
    await studentPage.waitForLoadState('networkidle');

    // Điền họ tên, SĐT, Email
    await studentPage.fill('#reg-fullname', 'Trần Bảo Ngọc');
    await studentPage.fill('#reg-phone', '0912345678');
    await studentPage.fill('#reg-email', 'phuhuynh.ngoc@gmail.com');

    // Điền ngày sinh 14 tuổi (2012-06-15)
    await studentPage.fill('#reg-dob', '2012-06-15');

    // Chờ khối cam kết phụ huynh hiển thị
    await studentPage.waitForSelector('#reg-guardian-consent', { state: 'visible', timeout: 5000 });
    console.log('  ✅ Khối cam kết phụ huynh tự động kích hoạt khi học viên < 16 tuổi!');

    // Tích đồng ý cam kết cha mẹ
    await studentPage.check('#reg-guardian-consent');

    // Điền mã xác thực email (mã kiểm thử test bypass)
    await studentPage.fill('#reg-verification-code', '999999');

    // Điền mật khẩu
    await studentPage.fill('#reg-password', 'Password@123');
    await studentPage.fill('#reg-confirm-password', 'Password@123');

    await studentPage.screenshot({ path: path.join(SCREENSHOTS_DIR, '01_dang_ky_co_phu_huynh.png') });
    console.log('  📸 Đã chụp màn hình: 01_dang_ky_co_phu_huynh.png');

    // Bấm Đăng ký
    await studentPage.click('button[type="submit"]');
    await studentPage.waitForURL((url) => url.pathname.includes('/login'), { timeout: 10000 });
    console.log('  ✅ Đăng ký thành công! Hệ thống chuyển hướng về /login');

    await studentPage.screenshot({ path: path.join(SCREENSHOTS_DIR, '02_dang_ky_thanh_cong_ve_login.png') });
    console.log('  📸 Đã chụp màn hình: 02_dang_ky_thanh_cong_ve_login.png');

    // ==========================================
    // KỊCH BẢN 2: HỌC VIÊN ĐĂNG NHẬP & KIỂM TRA PHÂN QUYỀN
    // ==========================================
    console.log('\n--- [KỊCH BẢN 2] Học viên mới đăng nhập & Kiểm tra màn hình Chờ xếp lớp ---');
    await studentPage.fill('#login-email', 'phuhuynh.ngoc@gmail.com');
    await studentPage.fill('#login-password', 'Password@123');
    await studentPage.click('button[type="submit"]');

    await studentPage.waitForURL((url) => url.pathname.includes('/student/overview'), { timeout: 10000 });
    console.log('  ✅ Học viên đăng nhập thành công vào /student/overview!');

    // Kiểm tra banner Chờ xếp lớp
    const pendingText = await studentPage.locator('text=Bạn chưa được xếp lớp').textContent();
    console.log(`  ✅ Thấy banner trạng thái: "${pendingText.trim()}"`);
    await studentPage.screenshot({ path: path.join(SCREENSHOTS_DIR, '03_hoc_vien_cho_xep_lop.png') });
    console.log('  📸 Đã chụp màn hình: 03_hoc_vien_cho_xep_lop.png');

    // Thử truy cập trái phép trang Admin
    console.log('  🔒 Thử nghiệm bảo mật: Học viên truy cập trái phép vào /admin/students...');
    await studentPage.goto('http://localhost:3000/admin/students');
    await studentPage.waitForSelector('text=Bạn không có quyền truy cập', { timeout: 5000 });
    console.log('  🛡️ CHẶN THÀNH CÔNG (403 Access Denied) — Học viên không thể xem trang Admin!');
    await studentPage.screenshot({ path: path.join(SCREENSHOTS_DIR, '04_hoc_vien_bi_chan_403.png') });
    console.log('  📸 Đã chụp màn hình: 04_hoc_vien_bi_chan_403.png');

    // ==========================================
    // KỊCH BẢN 3: ADMIN TIẾP NHẬN HỌC VIÊN VÀO HÀNG ĐỢI
    // ==========================================
    console.log('\n--- [KỊCH BẢN 3] Admin đăng nhập & Kiểm tra hàng đợi chờ xếp lớp ---');
    const adminContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const adminPage = await adminContext.newPage();

    await adminPage.goto('http://localhost:3000/login');
    await adminPage.fill('#login-email', 'admin@webedu.vn');
    await adminPage.fill('#login-password', 'Password@123');
    await adminPage.click('button[type="submit"]');

    await adminPage.waitForURL((url) => url.pathname.includes('/admin/students'), { timeout: 10000 });
    console.log('  ✅ Admin đăng nhập thành công vào /admin/students!');

    // Vào hàng đợi chờ xếp lớp
    await adminPage.goto('http://localhost:3000/admin/students/pending');
    await adminPage.waitForSelector('text=Trần Bảo Ngọc', { timeout: 8000 });
    console.log('  ✅ NHẤT QUÁN DỮ LIỆU: Thấy ngay học viên "Trần Bảo Ngọc" trong hàng đợi!');

    const consentTag = await adminPage.locator('text=Đã xác nhận').first().textContent();
    console.log(`  ✅ Trạng thái phụ huynh chuẩn xác: "${consentTag.trim()}"`);

    await adminPage.screenshot({ path: path.join(SCREENSHOTS_DIR, '05_admin_hang_doi_cho_xep_lop.png') });
    console.log('  📸 Đã chụp màn hình: 05_admin_hang_doi_cho_xep_lop.png');

    // ==========================================
    // KỊCH BẢN 4: ADMIN THỬ VÔ HIỆU HÓA GV CÓ LỚP
    // ==========================================
    console.log('\n--- [KỊCH BẢN 4] Admin thử vô hiệu hóa Giáo viên đang có lớp hoạt động ---');
    await adminPage.goto('http://localhost:3000/admin/teachers');
    await adminPage.waitForSelector('text=Trương Mỹ Lan', { timeout: 8000 });

    // Bấm nút "Vô hiệu hóa" của GV Trương Mỹ Lan
    const deactBtn = adminPage.locator('button:has-text("Vô hiệu hóa")').first();
    await deactBtn.click();

    // Chờ modal chặn xuất hiện
    await adminPage.waitForSelector('text=Không thể vô hiệu hóa giáo viên', { timeout: 5000 });
    console.log('  🛡️ BẢO VỆ BẤT BIẾN NGHIỆP VỤ THÀNH CÔNG: Chặn vô hiệu hóa GV đang phụ trách lớp!');
    await adminPage.screenshot({ path: path.join(SCREENSHOTS_DIR, '06_chan_khoa_giao_vien_co_lop.png') });
    console.log('  📸 Đã chụp màn hình: 06_chan_khoa_giao_vien_co_lop.png');

    // Đóng modal cảnh báo
    await adminPage.click('button:has-text("Đã hiểu")');

    // ==========================================
    // KỊCH BẢN 5: GIÁO VIÊN TRƯƠNG MỸ LAN & CÔ LẬP LỚP
    // ==========================================
    console.log('\n--- [KỊCH BẢN 5] Giáo viên đăng nhập & Kiểm tra lớp phụ trách ---');
    const teacherContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const teacherPage = await teacherContext.newPage();

    await teacherPage.goto('http://localhost:3000/login');
    await teacherPage.fill('#login-email', 'teacher.lan@webedu.vn');
    await teacherPage.fill('#login-password', 'Password@123');
    await teacherPage.click('button[type="submit"]');

    await teacherPage.waitForURL((url) => url.pathname.includes('/teacher/classes'), { timeout: 10000 });
    console.log('  ✅ Giáo viên đăng nhập thành công vào /teacher/classes!');

    await teacherPage.screenshot({ path: path.join(SCREENSHOTS_DIR, '07_giao_vien_lop_phu_trach.png') });
    console.log('  📸 Đã chụp màn hình: 07_giao_vien_lop_phu_trach.png');

    // Thử vào trang Superadmin
    console.log('  🔒 Thử nghiệm bảo mật: Giáo viên truy cập trái phép vào /superadmin/settings...');
    await teacherPage.goto('http://localhost:3000/superadmin/settings');
    await teacherPage.waitForSelector('text=Bạn không có quyền truy cập', { timeout: 5000 });
    console.log('  🛡️ CHẶN THÀNH CÔNG (403 Access Denied) — Giáo viên không thể vào trang Cấu hình!');
    await teacherPage.screenshot({ path: path.join(SCREENSHOTS_DIR, '08_giao_vien_bi_chan_superadmin.png') });
    console.log('  📸 Đã chụp màn hình: 08_giao_vien_bi_chan_superadmin.png');

    // ==========================================
    // KỊCH BẢN 6: SUPERADMIN ĐỔI TÊN TRUNG TÂM & ĐỒNG BỘ TOÀN HỆ THỐNG
    // ==========================================
    console.log('\n--- [KỊCH BẢN 6] Superadmin đổi Tên Trung Tâm & Đồng bộ tức thời sang Học viên ---');
    const superadminContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const superadminPage = await superadminContext.newPage();

    await superadminPage.goto('http://localhost:3000/login');
    await superadminPage.fill('#login-email', 'superadmin@webedu.vn');
    await superadminPage.fill('#login-password', 'Password@123');
    await superadminPage.click('button[type="submit"]');

    await superadminPage.waitForURL((url) => url.pathname.includes('/superadmin/settings'), { timeout: 10000 });
    console.log('  ✅ Superadmin đăng nhập thành công vào /superadmin/settings!');

    // Đổi tên trung tâm qua ô #cfg-center-name
    await superadminPage.fill('#cfg-center-name', 'Trung Tâm Hán Ngữ TD - Cơ Sở 1');
    await superadminPage.click('button:has-text("Lưu cấu hình hệ thống")');
    await superadminPage.waitForSelector('text=Lưu cấu hình hệ thống thành công', { timeout: 8000 });
    console.log('  ✅ Superadmin đã lưu Tên trung tâm mới!');
    await superadminPage.screenshot({ path: path.join(SCREENSHOTS_DIR, '09_superadmin_doi_ten_trung_tam.png') });
    console.log('  📸 Đã chụp màn hình: 09_superadmin_doi_ten_trung_tam.png');

    // Quay lại tab Học viên F5 kiểm tra đồng bộ
    console.log('  🔄 Kiểm tra đồng bộ: Học viên tải lại trang để xem Tên trung tâm mới...');
    await studentPage.goto('http://localhost:3000/student/overview');
    await studentPage.waitForLoadState('networkidle');
    const brandLocator = studentPage.locator('text=Trung Tâm Hán Ngữ TD - Cơ Sở 1').first();
    await brandLocator.waitFor({ state: 'visible', timeout: 8000 });
    const brandNameOnStudent = await brandLocator.textContent();
    console.log(`  🎉 ĐỒNG BỘ THÀNH CÔNG: Màn hình Học viên lập tức hiển thị "${brandNameOnStudent.trim()}"!`);
    await studentPage.screenshot({ path: path.join(SCREENSHOTS_DIR, '10_dong_bo_ten_trung_tam_sang_hoc_vien.png') });
    console.log('  📸 Đã chụp màn hình: 10_dong_bo_ten_trung_tam_sang_hoc_vien.png');

    console.log('\n===============================================================');
    console.log('🎉 TẤT CẢ 6 KỊCH BẢN CROSS-USER ĐỀU ĐẠT 100% PASS!');
    console.log('===============================================================\n');

  } catch (err) {
    console.error('❌ Lỗi trong quá trình kiểm thử:', err);
    throw err;
  } finally {
    await new Promise((r) => setTimeout(r, 2000));
    await browser.close();
    console.log('🏁 Đã đóng trình duyệt.');
  }
}

runLiveTest();
