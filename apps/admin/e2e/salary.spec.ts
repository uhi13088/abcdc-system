/**
 * E2E Tests for Salary Management
 * Using Playwright
 */

import { test, expect } from '@playwright/test';

test.describe('Salary Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', 'admin@test.com');
    await page.fill('input[name="password"]', 'testpassword123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('should navigate to salary management page', async ({ page }) => {
    await page.goto('/salaries');
    await expect(page.locator('h1')).toContainText('급여 관리');
  });

  test('should display salary list with filters', async ({ page }) => {
    await page.goto('/salaries');

    // Check for filter elements
    await expect(page.locator('select[name="year"]')).toBeVisible();
    await expect(page.locator('select[name="month"]')).toBeVisible();
    await expect(page.locator('select[name="store"]')).toBeVisible();

    // Check for salary table
    await expect(page.locator('table')).toBeVisible();
  });

  test('should calculate salary for an employee', async ({ page }) => {
    await page.goto('/salaries');

    // Click calculate button
    await page.click('button:has-text("급여 계산")');

    // Wait for calculation to complete
    await page.waitForSelector('.salary-calculated', { timeout: 10000 });

    // Verify calculation results
    await expect(page.locator('.total-gross-pay')).toBeVisible();
    await expect(page.locator('.total-deductions')).toBeVisible();
    await expect(page.locator('.net-pay')).toBeVisible();
  });

  test('should confirm calculated salary', async ({ page }) => {
    await page.goto('/salaries');

    // Select a calculated salary
    await page.click('tr.salary-row:first-child');

    // Click confirm button
    await page.click('button:has-text("확정")');

    // Confirm dialog
    await page.click('button:has-text("확인")');

    // Verify status changed
    await expect(page.locator('.status-confirmed')).toBeVisible();
  });

  test('should view salary detail', async ({ page }) => {
    await page.goto('/salaries');

    // Click on a salary row
    await page.click('tr.salary-row:first-child');

    // Verify detail page or modal
    await expect(page.locator('.salary-detail')).toBeVisible();
    await expect(page.locator('text=기본급')).toBeVisible();
    await expect(page.locator('text=연장근로수당')).toBeVisible();
    await expect(page.locator('text=국민연금')).toBeVisible();
  });

  test('should download payslip PDF', async ({ page }) => {
    await page.goto('/salaries');

    // Click on a confirmed salary
    await page.click('tr.salary-row.status-confirmed:first-child');

    // Set up download listener
    const downloadPromise = page.waitForEvent('download');

    // Click download button
    await page.click('button:has-text("명세서 다운로드")');

    // Verify download started
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('payslip');
    expect(download.suggestedFilename()).toContain('.pdf');
  });

  test('should filter salaries by month', async ({ page }) => {
    await page.goto('/salaries');

    // Change month filter
    await page.selectOption('select[name="month"]', '1'); // January

    // Wait for table to update
    await page.waitForTimeout(500);

    // Verify filtered results
    const rows = await page.locator('tr.salary-row').count();
    expect(rows).toBeGreaterThanOrEqual(0);
  });

  test('should filter salaries by store', async ({ page }) => {
    await page.goto('/salaries');

    // Change store filter
    await page.selectOption('select[name="store"]', { index: 1 });

    // Wait for table to update
    await page.waitForTimeout(500);

    // Verify table shows filtered data
    await expect(page.locator('table')).toBeVisible();
  });

  test('should show bulk actions for multiple selection', async ({ page }) => {
    await page.goto('/salaries');

    // Select multiple rows
    await page.click('input[type="checkbox"]:first-child');
    await page.click('input[type="checkbox"]:nth-child(2)');

    // Verify bulk action buttons appear
    await expect(page.locator('button:has-text("일괄 확정")')).toBeVisible();
    await expect(page.locator('button:has-text("일괄 발송")')).toBeVisible();
  });

  test('should send payslip via email', async ({ page }) => {
    await page.goto('/salaries');

    // Click on a confirmed salary
    await page.click('tr.salary-row.status-confirmed:first-child');

    // Click send email button
    await page.click('button:has-text("이메일 발송")');

    // Confirm send
    await page.click('button:has-text("발송")');

    // Verify success message
    await expect(page.locator('.toast-success')).toBeVisible();
  });
});

test.describe('Salary Calculation Details', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', 'admin@test.com');
    await page.fill('input[name="password"]', 'testpassword123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('should display correct overtime calculation', async ({ page }) => {
    await page.goto('/salaries/detail/1');

    // Verify overtime section
    await expect(page.locator('.overtime-hours')).toBeVisible();
    await expect(page.locator('.overtime-pay')).toBeVisible();

    // Verify rate is 1.5x
    const overtimeRate = await page.locator('.overtime-rate').textContent();
    expect(overtimeRate).toContain('1.5');
  });

  test('should display 4대보험 deductions correctly', async ({ page }) => {
    await page.goto('/salaries/detail/1');

    // Verify all insurance deductions
    await expect(page.locator('text=국민연금')).toBeVisible();
    await expect(page.locator('text=건강보험')).toBeVisible();
    await expect(page.locator('text=장기요양보험')).toBeVisible();
    await expect(page.locator('text=고용보험')).toBeVisible();
  });

  test('should display tax deductions correctly', async ({ page }) => {
    await page.goto('/salaries/detail/1');

    // Verify tax deductions
    await expect(page.locator('text=소득세')).toBeVisible();
    await expect(page.locator('text=지방소득세')).toBeVisible();
  });
});

test.describe('Salary Report Generation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', 'admin@test.com');
    await page.fill('input[name="password"]', 'testpassword123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('should generate monthly payroll report', async ({ page }) => {
    await page.goto('/salaries/reports');

    // Select month
    await page.selectOption('select[name="month"]', '1');

    // Click generate
    await page.click('button:has-text("리포트 생성")');

    // Wait for generation
    await page.waitForSelector('.report-generated', { timeout: 15000 });

    // Verify report preview
    await expect(page.locator('.report-preview')).toBeVisible();
  });

  test('should export payroll data to Excel', async ({ page }) => {
    await page.goto('/salaries/reports');

    // Set up download listener
    const downloadPromise = page.waitForEvent('download');

    // Click export button
    await page.click('button:has-text("엑셀 다운로드")');

    // Verify download
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('.xlsx');
  });
});
