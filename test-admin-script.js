#!/usr/bin/env node

/**
 * Browser automation script for testing admin course management
 */

const browserModule = (await import("../../../.claude/skills/browser-automation/browser.mjs")).default;

// Step 1: Login as admin
console.log("Step 1: Navigating to login page...");
const loginPage = await browserModule.page("http://localhost:5178/login");
const emailField = await loginPage.locator('input[type="email"]').first();
const passwordField = await loginPage.locator('input[type="password"]').first();
const loginBtn = await loginPage.locator('button:has-text("Login")').first();

await emailField.fill("admin@quiz.com");
await passwordField.fill("admin123");
await loginBtn.click();
await loginPage.waitForNavigation();

console.log("Step 2: Logged in, navigating to admin courses...");
await page.goto("http://localhost:5178/admin/courses");
await page.waitForLoadState("domcontentloaded");

const courseForm = await page.locator("form").first();
const title = await page.locator('input[name="title"]');

console.log("Course management form found:", !!courseForm);
console.log("Title input found:", !!title);
