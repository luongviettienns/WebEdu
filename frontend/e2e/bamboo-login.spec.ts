import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

declare global {
  interface Window {
    bambooFrames: { requested: number; drawn: number };
  }
}

test.use({ reducedMotion: 'no-preference' });

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/system-settings/config', route =>
    route.fulfill({ json: { centerName: 'Trung Tâm TD Hán Ngữ' } }),
  );
  await page.addInitScript(() => {
    const frames = window.bambooFrames = { requested: 0, drawn: 0 };
    const drawImage = CanvasRenderingContext2D.prototype.drawImage;
    let drewBamboo = false;
    CanvasRenderingContext2D.prototype.drawImage = function (...args: unknown[]) {
      if (this.canvas.hasAttribute('data-bamboo-leaves')) drewBamboo = true;
      return Reflect.apply(drawImage, this, args);
    };
    const requestFrame = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = callback => {
      frames.requested += 1;
      return requestFrame(timestamp => {
        drewBamboo = false;
        callback(timestamp);
        if (drewBamboo) frames.drawn += 1;
      });
    };
  });
});

const framesDrawn = (page: Page) => page.evaluate(() => window.bambooFrames.drawn);
const framesRequested = (page: Page) => page.evaluate(() => window.bambooFrames.requested);

async function expectFramesStopped(page: Page) {
  const count = await framesDrawn(page);
  // Observe a quiet interval long enough to catch a loop at either 30 or 60 Hz.
  await page.waitForTimeout(250);
  expect(await framesDrawn(page)).toBe(count);
}

test('login stays interactive when bamboo is running', async ({ page, isMobile }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' || /hydrat|did not match/i.test(message.text())) {
      errors.push(message.text());
    }
  });
  await page.route('**/api/v1/auth/login', route => route.fulfill({
    json: {
      redirectTo: '/forgot-password', expiresIn: 3600,
      user: {
        id: 'bamboo-test', email: 'bamboo-test@webedu.vn', fullName: 'Bamboo Test',
        phone: '0901000000', roles: ['STUDENT'], effectiveRole: 'STUDENT', status: 'ACTIVE',
      },
    },
  }));
  await page.goto('/login');

  const canvas = page.locator('canvas[data-bamboo-leaves]');
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveAttribute('aria-hidden', 'true');
  await expect(canvas).toHaveCSS('pointer-events', 'none');
  await expect.poll(() => framesDrawn(page)).toBeGreaterThan(40);
  await expect.poll(() => canvas.evaluate((element: HTMLCanvasElement) => {
    const ctx = element.getContext('2d');
    const pixels = ctx?.getImageData(0, 0, element.width, element.height).data;
    if (!pixels) return false;
    for (let i = 3; i < pixels.length; i += 4) {
      if (pixels[i] > 0) return true;
    }
    return false;
  })).toBe(true);
  const contrast = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
  expect(contrast.violations).toEqual([]);
  const screenshot = await page.screenshot({ path: testInfo.outputPath('login-bamboo.png') });
  await testInfo.attach('login-bamboo', { body: screenshot, contentType: 'image/png' });

  await page.locator('#login-email').fill('bamboo-test@webedu.vn');
  await page.keyboard.press('Tab');
  const password = page.locator('#login-password');
  await expect(password).toBeFocused();
  await password.fill('BambooTest123!');
  const submitted = page.waitForRequest(request =>
    request.url().endsWith('/api/v1/auth/login') && request.method() === 'POST',
  );
  const submit = page.getByRole('button', { name: 'Đăng nhập', exact: true });
  if (isMobile) await submit.tap();
  else await submit.click();
  expect((await submitted).postDataJSON()).toEqual({
    email: 'bamboo-test@webedu.vn', password: 'BambooTest123!', rememberMe: false,
  });
  await expect(page).toHaveURL(/\/forgot-password$/);
  await expect(canvas).toBeHidden();
  await expectFramesStopped(page);
  expect(errors).toEqual([]);
});

test('reduced motion starts idle and reacts to live preference changes', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/login');
  await expect(page.locator('canvas[data-bamboo-leaves]')).toBeVisible();
  await expectFramesStopped(page);
  expect(await framesDrawn(page)).toBe(0);
  const requested = await framesRequested(page);
  await expectFramesStopped(page);
  expect(await framesRequested(page)).toBe(requested);

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect.poll(() => framesDrawn(page)).toBeGreaterThan(2);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expectFramesStopped(page);
});

test('pauses outside the viewport and when the tab becomes hidden', async ({ page }) => {
  await page.goto('/login');
  const canvas = page.locator('canvas[data-bamboo-leaves]');
  await expect.poll(() => framesDrawn(page)).toBeGreaterThan(2);
  await canvas.evaluate(element => { element.style.transform = 'translateX(200vw)'; });
  await canvas.evaluate(element => new Promise<void>(resolve => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) return;
      observer.disconnect();
      resolve();
    });
    observer.observe(element);
  }));
  await expectFramesStopped(page);

  let drawn = await framesDrawn(page);
  await canvas.evaluate(element => { element.style.transform = ''; });
  await expect.poll(() => framesDrawn(page)).toBeGreaterThan(drawn + 2);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expectFramesStopped(page);

  drawn = await framesDrawn(page);
  await page.evaluate(() => {
    Reflect.deleteProperty(document, 'hidden');
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(() => framesDrawn(page)).toBeGreaterThan(drawn + 2);
});

test('rebuilds the backing canvas when DPR changes with the same viewport', async ({ page, isMobile }) => {
  await page.goto('/login');
  const canvas = page.locator('canvas[data-bamboo-leaves]');
  await expect.poll(() => framesDrawn(page)).toBeGreaterThan(2);
  const viewport = page.viewportSize();
  if (!viewport) throw new Error('Expected a fixed viewport');
  const session = await page.context().newCDPSession(page);
  await session.send('Emulation.setDeviceMetricsOverride', {
    ...viewport, deviceScaleFactor: 3, mobile: isMobile,
  });
  await expect.poll(() => page.evaluate(() => window.devicePixelRatio)).toBe(3);
  await expect.poll(() => canvas.evaluate((element: HTMLCanvasElement) => element.width))
    .toBe(Math.round(viewport.width * (isMobile ? 1.5 : 2)));
  const drawn = await framesDrawn(page);
  await expect.poll(() => framesDrawn(page)).toBeGreaterThan(drawn + 2);
});
