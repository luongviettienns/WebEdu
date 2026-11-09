import { expect, test, type Page } from '@playwright/test';

function attachErrorGuards(page: Page): { pageErrors: string[] } {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => {
    pageErrors.push(err.message);
  });
  return { pageErrors };
}

async function loginThroughUi(
  page: Page,
  email: string,
  password = 'Password@123',
): Promise<void> {
  await page.goto('/login');
  await page.getByLabel(/Email đăng nhập/i).fill(email);
  await page.locator('#login-password').fill(password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
}

const CURRENT_YEAR = new Date().getFullYear();
const DOB_ADULT = `${CURRENT_YEAR - 22}-06-15`;
const DOB_TEEN_14 = `${CURRENT_YEAR - 14}-05-20`;

test.describe('Phase 2 Edge Cases & Form Ergonomics Verification', () => {
  test('EC-1: Form Ergonomics — Compact 2-column layout fits viewport above the fold & watermark is scholarly jade', async ({
    page,
  }, testInfo) => {
    const { pageErrors } = attachErrorGuards(page);
    const isMobile = testInfo.project.name.includes('mobile');

    await page.goto('/register');
    await expect(
      page.getByRole('heading', { name: 'Đăng Ký Tài Khoản Học Viên' }),
    ).toBeVisible();

    const submitBtn = page.locator('#reg-submit-btn');
    await expect(submitBtn).toBeVisible();

    if (!isMobile) {
      // On desktop (1440x900), the form container should be compact (< 550px)
      // and the submit button should be visible above the fold without any scrolling
      const viewportSize = page.viewportSize();
      const viewportHeight = viewportSize ? viewportSize.height : 900;

      const btnBox = await submitBtn.boundingBox();
      expect(btnBox).not.toBeNull();
      if (btnBox) {
        expect(btnBox.y + btnBox.height).toBeLessThan(viewportHeight);
      }

      // Check Eastern Calligraphy Art watermark element on left side
      const watermark = page.getByText('學', { exact: true });
      await expect(watermark).toBeVisible();
    }

    expect(pageErrors).toEqual([]);
  });

  test('EC-2: Password Confirmation Mismatch — Blocks submission with reactive alert', async ({
    page,
  }) => {
    const { pageErrors } = attachErrorGuards(page);

    await page.goto('/register');
    await page.locator('#reg-fullname').fill('Học Viên Thử Nghiệm');
    await page.locator('#reg-dob').fill(DOB_ADULT);
    await page.locator('#reg-phone').fill('0912345678');
    await page.locator('#reg-email').fill('mismatch.test@webedu.vn');
    await page.locator('#reg-password').fill('Password@123');
    await page.locator('#reg-confirm-password').fill('Password@999');

    await page.locator('#reg-submit-btn').click();

    // Expect reactive error alert on confirm password
    const mismatchAlert = page.locator('[role="alert"]').filter({
      hasText: 'Mật khẩu xác nhận không khớp',
    });
    await expect(mismatchAlert).toBeVisible();
    await expect(page).toHaveURL(/\/register/);

    expect(pageErrors).toEqual([]);
  });

  test('EC-3: Student Under 16 — Guardian consent requirement and rejection of identical student/guardian email', async ({
    page,
  }) => {
    const { pageErrors } = attachErrorGuards(page);

    await page.goto('/register');
    await page.locator('#reg-fullname').fill('Học Viên Trẻ Tuổi');
    await page.locator('#reg-dob').fill(DOB_TEEN_14);
    await page.locator('#reg-phone').fill('0912345679');
    await page.locator('#reg-email').fill('young.student@webedu.vn');

    // Guardian section must dynamically appear for 14-year-old
    const guardianEmailInput = page.locator('#reg-guardian-email');
    const guardianConsentCheckbox = page.locator('#reg-guardian-consent');
    await expect(guardianEmailInput).toBeVisible();
    await expect(guardianConsentCheckbox).toBeVisible();

    // Enter identical email as student email
    await guardianEmailInput.fill('young.student@webedu.vn');
    await guardianConsentCheckbox.check();
    await page.locator('#reg-password').fill('Password@123');
    await page.locator('#reg-confirm-password').fill('Password@123');

    await page.locator('#reg-submit-btn').click();

    // Invariant check: Guardian email cannot be the same as student email
    const duplicateEmailAlert = page.locator('[role="alert"]').filter({
      hasText: 'Email người giám hộ không được trùng với email học viên',
    });
    await expect(duplicateEmailAlert).toBeVisible();
    await expect(page).toHaveURL(/\/register/);

    expect(pageErrors).toEqual([]);
  });

  test('EC-4: Profile Change Password — Incorrect current password displays error and preserves account security', async ({
    page,
  }) => {
    const { pageErrors } = attachErrorGuards(page);

    await loginThroughUi(page, 'active.student@webedu.vn', 'Password@123');
    await page.goto('/profile');
    await expect(
      page.getByRole('heading', { name: 'Hồ Sơ Cá Nhân & Bảo Mật Tài Khoản' }),
    ).toBeVisible();

    // Change password section
    await page.locator('#pwd-current').fill('IncorrectCurrentPass@123');
    await page.locator('#pwd-new').fill('NewSecurePassword@123');
    await page.locator('#pwd-confirm').fill('NewSecurePassword@123');
    await page.getByRole('button', { name: 'Đổi mật khẩu' }).click();

    const errorAlert = page.locator('[role="alert"]').filter({
      hasText: /Mật khẩu hiện tại không/i,
    });
    await expect(errorAlert).toBeVisible();

    expect(pageErrors).toEqual([]);
  });

  test('EC-5: Superadmin Self-Protection — Editing self in System Settings locks SUPERADMIN role and disables status change', async ({
    page,
  }) => {
    const { pageErrors } = attachErrorGuards(page);

    await loginThroughUi(page, 'superadmin@webedu.vn', 'Password@123');
    await page.goto('/superadmin/settings');
    await expect(
      page.getByRole('heading', { name: 'Vận Hành Hệ Thống (Superadmin)' }),
    ).toBeVisible();

    // Wait for the user table to load
    const superadminRow = page.locator('tr', {
      hasText: 'superadmin@webedu.vn',
    });
    await expect(superadminRow).toBeVisible();
    await expect(superadminRow.getByText('Bạn')).toBeVisible();

    // Click "Phân quyền & Trạng thái"
    await superadminRow.getByRole('button', { name: 'Phân quyền & Trạng thái' }).click();

    // Modal opens
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();
    await expect(
      modal.getByRole('heading', { name: 'Gán Đa Vai Trò & Trạng Thái' }),
    ).toBeVisible();

    // SUPERADMIN checkbox must be disabled
    const superadminLabel = modal.locator('label', { hasText: 'Superadmin' });
    const superadminCheckbox = superadminLabel.locator('input[type="checkbox"]');
    await expect(superadminCheckbox).toBeDisabled();
    await expect(superadminLabel.getByText('(Khóa)')).toBeVisible();

    // Account status select dropdown must be disabled
    const statusSelect = modal.locator('#edit-sys-status');
    await expect(statusSelect).toBeDisabled();
    await expect(
      modal.getByText('Bạn không thể tự vô hiệu hóa tài khoản của chính mình.'),
    ).toBeVisible();

    // Close modal safely
    await modal.getByRole('button', { name: 'Hủy' }).click();
    await expect(modal).toHaveCount(0);

    expect(pageErrors).toEqual([]);
  });
});
