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

  test('pre-validates duration and oversized image before calling import API', async ({ page }) => {
    await loginThroughUi(page, 'teacher.lan@webedu.vn');
    await openUpload(page);

    let importCalls = 0;
    await page.route('**/api/assessments/import', (route) => {
      importCalls += 1;
      return route.continue();
    });

    await page.getByLabel('Thời gian làm bài').fill('0');
    await page.getByLabel('Tải đề Word hoặc PDF').setInputFiles(join(FIXTURES, 'sample-questions.docx'));
    await expect(page.getByText('Thời gian làm bài phải là số nguyên từ 1 đến 1440 phút')).toBeVisible();
    expect(importCalls).toBe(0);

    await page.getByLabel('Thời gian làm bài').fill('');
    await page.getByLabel('Thêm hình').setInputFiles({
      name: 'huge.png',
      mimeType: 'image/png',
      buffer: Buffer.alloc(5 * 1024 * 1024 + 10, 0x89),
    });
    await expect(page.getByText('Ảnh "huge.png" phải khác rỗng và không vượt quá 5MB')).toBeVisible();
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

  test('regenerates unused option ID after middle delete, edits points, and reorders with Xuống', async ({
    page,
  }) => {
    await loginThroughUi(page, 'teacher.lan@webedu.vn');
    await page.goto('/teacher/assessments');
    await page.getByRole('button', { name: '+ Tạo đề' }).click();
    await page.getByLabel('Tên đề').fill('Đề test thứ tự và phương án');
    await page.getByLabel('Loại đề').selectOption('HOMEWORK');
    const courseSelect = page.getByLabel('Khóa HSK');
    const courseValue = await courseSelect.locator('option').nth(1).getAttribute('value');
    if (courseValue) await courseSelect.selectOption(courseValue);
    await page.getByRole('button', { name: 'Lưu nháp' }).click();
    await expect(page.getByText('Đã lưu nháp')).toBeVisible();

    const composer = page.getByRole('region', { name: 'Thêm câu hỏi mới' });
    await composer.getByLabel('Nội dung câu hỏi').fill('Câu 1 đầu tiên');
    await composer.getByRole('button', { name: '+ Thêm phương án' }).click();
    await composer.getByPlaceholder('Phương án A').fill('Đáp án đúng');
    await composer.getByPlaceholder('Phương án B').fill('Phương án giữa sẽ xóa');
    await composer.getByPlaceholder('Phương án C').fill('Phương án C giữ lại');

    await composer.getByRole('button', { name: 'Xóa', exact: true }).nth(1).click();
    await expect(composer.getByPlaceholder('Phương án B')).toHaveCount(0);
    await expect(composer.getByPlaceholder('Phương án C')).toHaveValue('Phương án C giữ lại');

    await composer.getByRole('button', { name: '+ Thêm phương án' }).click();
    await expect(composer.getByPlaceholder('Phương án B')).toHaveCount(1);
    await expect(composer.getByPlaceholder('Phương án C')).toHaveValue('Phương án C giữ lại');
    await composer.getByPlaceholder('Phương án B').fill('Phương án B mới');
    await composer.getByLabel('Đáp án A').check();
    await composer.getByLabel('Điểm', { exact: true }).fill('2');
    await composer.getByRole('button', { name: 'Thêm câu' }).click();
    await expect(page.getByText('1. Câu 1 đầu tiên')).toBeVisible();

    await composer.getByLabel('Nội dung câu hỏi').fill('Câu 2 thứ hai');
    await composer.getByPlaceholder('Phương án A').fill('Lựa chọn 1');
    await composer.getByPlaceholder('Phương án B').fill('Lựa chọn 2');
    await composer.getByLabel('Đáp án A').check();
    await composer.getByRole('button', { name: 'Thêm câu' }).click();
    await expect(page.getByText('2. Câu 2 thứ hai')).toBeVisible();

    const card1 = page.getByRole('article', { name: 'Câu 1' });
    await card1.getByLabel('Điểm câu 1').fill('3.5');
    await page.getByRole('button', { name: 'Lưu nháp' }).click();
    await expect(page.getByText('Đã lưu nháp')).toBeVisible();

    await card1.getByRole('button', { name: 'Xuống' }).click();
    await expect(page.getByText('1. Câu 2 thứ hai')).toBeVisible();
    await expect(page.getByText('2. Câu 1 đầu tiên')).toBeVisible();
    await expect(page.getByLabel('Điểm câu 2')).toHaveValue('3.5');

    await page.reload();
    await page
      .locator('tr', { hasText: 'Đề test thứ tự và phương án' })
      .getByRole('button', { name: 'Sửa' })
      .click();
    await expect(page.getByText('1. Câu 2 thứ hai')).toBeVisible();
    await expect(page.getByText('2. Câu 1 đầu tiên')).toBeVisible();
    await expect(page.getByLabel('Điểm câu 2')).toHaveValue('3.5');
  });

  test('ImportReviewPane persists edited title and question points across reload and confirms needsReview', async ({
    page,
  }) => {
    await loginThroughUi(page, 'teacher.lan@webedu.vn');
    await openUpload(page);
    await page.getByLabel('Tải đề Word hoặc PDF').setInputFiles(join(FIXTURES, 'sample-questions.docx'));
    await expect(page.getByText('3 · Hoàn tất')).toBeVisible();
    await page.getByRole('button', { name: 'Kiểm tra đề' }).click();
    await expect(page.getByRole('button', { name: 'Phát hành' })).toBeDisabled();

    await page.getByLabel('Tên đề').fill('Đề nhập đã sửa tên');
    await page.getByLabel('Điểm câu 1').fill('2.5');
    await page.getByRole('button', { name: 'Lưu nháp' }).click();
    await expect(page.getByText('Đã lưu nháp')).toBeVisible();

    await page.reload();
    await page
      .locator('tr', { hasText: 'Đề nhập đã sửa tên' })
      .getByRole('button', { name: 'Duyệt' })
      .click();
    await expect(page.getByLabel('Tên đề')).toHaveValue('Đề nhập đã sửa tên');
    await expect(page.getByLabel('Điểm câu 1')).toHaveValue('2.5');
    await expect(page.getByRole('button', { name: 'Phát hành' })).toBeDisabled();

    const card3 = page.getByRole('article', { name: 'Câu 3' });
    await expect(card3.getByText('Cần kiểm tra')).toBeVisible();
    await card3.getByLabel('Đáp án A').check();
    await card3.getByRole('button', { name: 'Lưu & xác nhận' }).click();
    await expect(card3.getByText('Cần kiểm tra')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Phát hành' })).toBeEnabled();

    await page.getByRole('button', { name: 'Phát hành' }).click();
    await expect(
      page.locator('tr', { hasText: 'Đề nhập đã sửa tên' }).getByText('Đã phát hành'),
    ).toBeVisible();
  });
});
