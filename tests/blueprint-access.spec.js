const { test, expect } = require('@playwright/test');
const { loadDiagnostic, answerAll } = require('./helpers');

test('Blueprint opens directly without email or consent', async ({ page }) => {
  const { submissions } = await loadDiagnostic(page);
  await answerAll(page);
  await expect(page.locator('#resultClosing #contactGate')).toBeVisible();
  await expect(page.locator('#fullName')).toHaveCount(0);
  await page.locator('#takeBlueprintBtn').click();
  await expect(page.locator('#blueprint')).toBeVisible();
  expect(submissions).toHaveLength(0);
});
test('invalid optional email does not block Blueprint access', async ({ page }) => {
  const { submissions } = await loadDiagnostic(page);
  await answerAll(page);
  await page.locator('#emailBlueprintPdf').check();
  await page.locator('#email').fill('person@gmail.com');
  await page.locator('#takeBlueprintBtn').click();
  await expect(page.locator('#blueprint')).toBeVisible();
  expect(submissions).toHaveLength(0);
});
test('email request requires consent and sends only on explicit submit', async ({ page }) => {
  const { submissions } = await loadDiagnostic(page);
  await answerAll(page);
  await page.locator('#email').fill('dana@example.com');
  await page.locator('#contactGate button').click();
  expect(submissions).toHaveLength(0);
  await page.locator('#emailBlueprintPdf').check();
  await page.locator('#contactGate button').click();
  await expect(page.locator('#blueprintEmailStatus')).toContainText('sent to our team');
  expect(submissions).toHaveLength(1);
  expect(submissions[0]['Blueprint PDF Requested']).toBe('Yes');
  expect(submissions[0]['Work Email']).toBe('dana@example.com');
  await page.locator('#takeBlueprintBtn').click();
  await expect(page.locator('#blueprint')).toBeVisible();
});
test('failed email request can be retried without blocking the Blueprint', async ({ page }) => {
  await loadDiagnostic(page);
  await page.route('**/formspree.io/**', route => route.fulfill({ status: 500, body: '{}' }));
  await answerAll(page);
  await page.locator('#emailBlueprintPdf').check();
  await page.locator('#email').fill('dana@example.com');
  await page.locator('#contactGate button').click();
  await expect(page.locator('#blueprintEmailStatus')).toContainText('could not be sent');
  await expect(page.locator('#contactGate button')).toBeEnabled();
  await page.locator('#takeBlueprintBtn').click();
  await expect(page.locator('#blueprint')).toBeVisible();
});
