import { expect, test } from "@playwright/test";

test("preloader appears briefly without blocking the hero", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });

  await expect(page.locator(".preloader")).toBeVisible();
  await expect(page.locator("canvas.hero-grainient")).toHaveCount(0);
  await expect(page.locator(".preloader")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /Noida Sports Talent Hunt/i })).toBeVisible();
});

test("preloader still releases when animation frames stall", async ({ page }) => {
  await page.addInitScript(() => {
    window.requestAnimationFrame = () => 0;
    window.cancelAnimationFrame = () => {};
  });
  await page.goto("/");

  await expect(page.locator(".preloader")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /Noida Sports Talent Hunt/i })).toBeVisible();
});

test("desktop hero effect appears without pointer interaction", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  await expect(page.locator(".preloader")).toHaveCount(0);
  const canvas = page.locator("canvas.hero-grainient");
  await expect(canvas).toBeVisible();
  await expect.poll(() => canvas.evaluate((element) => {
    const gl = element.getContext("webgl");
    return Boolean(gl && !gl.isContextLost() && gl.getParameter(gl.CURRENT_PROGRAM));
  })).toBe(true);
  const pixels = await canvas.evaluate((element) => element.width * element.height);
  expect(pixels).toBeLessThanOrEqual(1_210_000);
  await expect(page.getByRole("heading", { name: /Noida Sports Talent Hunt/i })).toBeVisible();
});

test("hero retains a gradient when WebGL is unavailable", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function getContext(type, ...args) {
      if (type === "webgl") return null;
      return original.call(this, type, ...args);
    };
  });
  await page.goto("/");

  await expect(page.locator(".preloader")).toHaveCount(0);
  await expect(page.locator("canvas.hero-grainient")).toBeVisible();
  const fallback = await page.locator(".hero-field").evaluate(
    (field) => getComputedStyle(field).backgroundImage,
  );
  expect(fallback).toContain("radial-gradient");
});

test("mobile hero shows the same effect within a smaller rendering budget", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expect(page.locator(".preloader")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /Noida Sports Talent Hunt/i })).toBeVisible();
  const canvas = page.locator("canvas.hero-grainient");
  await expect(canvas).toBeVisible();
  const pixels = await canvas.evaluate((element) => element.width * element.height);
  expect(pixels).toBeLessThanOrEqual(410_000);
  const animation = await page.locator(".hero-field").evaluate(
    (field) => getComputedStyle(field, "::before").animationName,
  );
  expect(animation).toBe("heroFieldDrift");
});

test("July typewriter stays scroll-linked but finishes within a short scroll", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.locator(".preloader")).toHaveCount(0);

  const paragraph = page.locator(".july-story .body-copy");
  const letterCount = await paragraph.locator(".type-char").count();
  const documentTop = await paragraph.evaluate((element) => element.getBoundingClientRect().top + scrollY);
  const visibleLetters = () => paragraph.locator(".type-char").evaluateAll(
    (letters) => letters.filter((letter) => Number(getComputedStyle(letter).opacity) > 0.95).length,
  );
  const scrollToFraction = async (fraction) => {
    await page.evaluate(
      ({ top, fraction: position }) => window.scrollTo({ top: top - innerHeight * position, behavior: "instant" }),
      { top: documentTop, fraction },
    );
    await page.waitForTimeout(450);
  };

  await scrollToFraction(0.92);
  expect(await visibleLetters()).toBe(0);

  await scrollToFraction(0.72);
  const partway = await visibleLetters();
  expect(partway).toBeGreaterThan(0);
  expect(partway).toBeLessThan(letterCount);

  await scrollToFraction(0.60);
  await expect.poll(visibleLetters).toBe(letterCount);
});

test("reduced motion never hides the hero or July copy", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  await expect(page.locator(".preloader")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /Noida Sports Talent Hunt/i })).toBeVisible();
  await expect(page.locator("canvas.hero-grainient")).toHaveCount(0);
  const lastLetter = page.locator(".july-story .body-copy .type-char").last();
  await expect(lastLetter).toHaveCSS("visibility", "visible");
});

test("gallery still loads when reached", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.locator(".preloader")).toHaveCount(0);
  await expect(page.locator(".archive-stage canvas")).toHaveCount(0);

  await page.locator(".archive-stage").scrollIntoViewIfNeeded();
  await expect(page.locator(".archive-stage canvas")).toBeVisible();
});
