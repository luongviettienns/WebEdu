import { expect, request as playwrightRequest, test, type Page } from '@playwright/test';
import { Buffer } from 'node:buffer';
import { join } from 'node:path';

const INSPECTOR_URL = `http://127.0.0.1:${process.env.QA_MAIL_INSPECTOR_PORT || 4026}`;
const FIXTURES = join(__dirname, 'fixtures');

async function reseedQaDatabase(): Promise<void> {
  const ctx = await playwrightRequest.newContext();
  try {
    const res = await ctx.post(`${INSPECTOR_URL}/reseed`);
    expect(res.ok(), 'QA environment /reseed must succeed').toBeTruthy();
  } finally {
    await ctx.dispose();
  }
}

async function loginThroughUi(page: Page, email: string, password = 'Password@123'): Promise<void> {
  await page.goto('/login');
  await page.getByLabel(/Email đăng nhập/i).fill(email);
  await page.locator('#login-password').fill(password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
}

async function openUpload(page: Page): Promise<void> {
  await page.goto('/teacher/assessments');
  await page.getByRole('button', { name: 'Tải đề Word/PDF' }).click();
  await expect(page.getByRole('heading', { name: 'Tải đề Word/PDF' })).toBeVisible();
}

test.describe('Phase 5 — Question bank & import review', () => {
  test.beforeEach(async () => {
    await reseedQaDatabase();
  });

  test('CRUD one single-choice assessment', async ({ page }) => {
    await loginThroughUi(page, 'teacher.lan@webedu.vn');
    await page.goto('/teacher/assessments');
    await expect(page.getByRole('heading', { name: 'Ngân hàng đề' })).toBeVisible();

    await page.getByRole('button', { name: '+ Tạo đề' }).click();
    await page.getByLabel('Tên đề').fill('Đề trắc nghiệm HSK1');
    await page.getByLabel('Loại đề').selectOption('HOMEWORK');
    const courseSelect = page.getByLabel('Khóa HSK');
    const courseValue = await courseSelect.locator('option').nth(1).getAttribute('value');
    if (courseValue) await courseSelect.selectOption(courseValue);
    await page.getByRole('button', { name: 'Lưu nháp' }).click();

    await page.getByLabel('Nội dung câu hỏi').fill('你好吗？');
    await page.getByPlaceholder('Phương án A').fill('我很好');
    await page.getByPlaceholder('Phương án B').fill('谢谢');
    await page.getByLabel('Đáp án A').check();
    await page.getByRole('button', { name: 'Thêm câu' }).click();
    await expect(page.getByText('1. 你好吗？')).toBeVisible();
  });

  test('legacy .doc upload shows a clear error', async ({ page }) => {
    await loginThroughUi(page, 'teacher.lan@webedu.vn');
    await openUpload(page);
    await page.getByLabel('Tải đề Word hoặc PDF').setInputFiles({
      name: 'de.doc',
      mimeType: 'application/msword',
      buffer: Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
    });
    await expect(page.getByText('Chỉ hỗ trợ file .docx, .pdf tối đa 20MB')).toBeVisible();
  });

  test('publish is blocked while imported questions still need review', async ({ page }) => {
    await loginThroughUi(page, 'teacher.lan@webedu.vn');
    await openUpload(page);
    await page.getByLabel('Tải đề Word hoặc PDF').setInputFiles(join(FIXTURES, 'sample-questions.docx'));
    await expect(page.getByText('3 · Hoàn tất')).toBeVisible();
    await expect(page.getByText('Nhận diện 3 câu; 1 câu cần kiểm tra')).toBeVisible();
    await page.getByRole('button', { name: 'Kiểm tra đề' }).click();
    await expect(page.getByRole('button', { name: 'Phát hành' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Thêm câu' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Lưu nháp' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Xem trước như HV' })).toBeVisible();
  });
});
