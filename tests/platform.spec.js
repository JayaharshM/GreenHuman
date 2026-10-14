import { test, expect } from "@playwright/test";
test("homepage, discovery and responsive navigation", async ({
  page,
}, testInfo) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "TOMORROW.",
  );
  await expect(page.locator(".hospital-card").first()).toBeVisible();
  await expect(page.locator(".request-card")).toHaveCount(3);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/home-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page.screenshot({
    path: `test-results/home-${testInfo.project.name}-viewport.png`,
  });
  if (testInfo.project.name === "mobile") {
    await page.getByRole("button", { name: "Open menu" }).click();
    await page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("link", { name: "Find hospitals" })
      .click();
  } else
    await page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("link", { name: "Find hospitals" })
      .click();
  await expect(page).toHaveURL(/\/hospitals/);
  await page
    .getByRole("textbox", { name: "Search by hospital, city or pincode" })
    .fill("Asha");
  await expect(page.locator(".hospital-card")).toHaveCount(1);
  await expect(page.locator(".hospital-card")).toContainText("Asha");
  await page.getByRole("button", { name: "Map view" }).click();
  await expect(page.locator(".leaflet-container")).toBeVisible();
  await page.getByRole("button", { name: "List view" }).click();
  await page
    .getByRole("textbox", { name: "Search by hospital, city or pincode" })
    .fill("no-such-hospital");
  await expect(
    page.getByRole("heading", { name: "No hospitals in this search, yet." }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("public routes render without runtime errors", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const path of [
    "/drives",
    "/urgent-requests",
    "/campus",
    "/volunteer",
    "/stories",
    "/about",
    "/contact",
    "/faq",
    "/privacy",
    "/terms",
    "/accessibility",
    "/login",
    "/register/donor",
    "/register/hospital",
    "/404",
  ]) {
    await page.goto(path);
    await expect(page.getByRole("main")).toBeVisible();
    await expect(
      page.getByRole("main").getByRole("heading").first(),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      path,
    ).toBe(true);
  }
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login\?next/);
  expect(errors).toEqual([]);
});
test("a donor registers, verifies email, requests a visit and joins a drive", async ({
  page,
}, testInfo) => {
  const email = `e2e-${Date.now()}-${testInfo.project.name}@lifeline.example`;
  await page.goto("/register/donor");
  await page.getByLabel("Full name").fill("E2E Demo Donor");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Phone number").fill("9000000000");
  await page.getByLabel("Date of birth").fill("2001-05-12");
  await page.getByRole("button", { name: "Keep going" }).click();
  await page.getByLabel("City", { exact: true }).fill("Pune");
  await page.getByLabel("State", { exact: true }).fill("Maharashtra");
  await page.getByLabel("Pincode", { exact: true }).fill("411001");
  await page.getByRole("button", { name: "Keep going" }).click();
  await page.getByLabel("Create a password").fill("TestingLife123!");
  await page.getByRole("checkbox", { name: /I consent to processing/ }).check();
  await page.getByRole("button", { name: "Join the movement" }).click();
  await expect(page).toHaveURL("/dashboard");
  await page
    .getByRole("link", { name: "Open local verification email" })
    .click();
  await page.getByRole("button", { name: "Verify my email" }).click();
  await expect(
    page.getByRole("heading", { name: "You’re all set." }),
  ).toBeVisible();
  await page.goto("/hospitals");
  await page
    .getByRole("textbox", { name: "Search by hospital, city or pincode" })
    .fill("Sahyadri");
  await page.locator(".hospital-card h3 a").click();
  await page.getByRole("button", { name: "Request a donation visit" }).click();
  await page
    .getByLabel("Preferred date")
    .fill(new Date(Date.now() + 86400000).toISOString().slice(0, 10));
  await page
    .getByRole("button", { name: "Request a visit", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Visit requested");
  await page.goto("/dashboard");
  await page
    .getByRole("button", { name: "My appointments", exact: true })
    .click();
  await expect(page.getByRole("table")).toContainText("Sahyadri");
  await expect(page.getByRole("table")).toContainText("requested");
  await page.goto("/drives");
  await page.locator(".drive-card h3 a").first().click();
  await page.getByRole("button", { name: "Save my place" }).click();
  await expect(
    page.getByRole("button", { name: "Cancel registration" }),
  ).toBeVisible();
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "My drives", exact: true }).click();
  await expect(page.getByRole("table")).toContainText("The Good Giving Day");
  await page.getByRole("button", { name: "Cancel registration" }).click();
  await expect(
    page.getByRole("heading", { name: "Nothing to review right now." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "My settings", exact: true }).click();
  await page
    .getByRole("checkbox", { name: "Optional future donation invitations" })
    .check();
  await page.getByRole("button", { name: "Save my choices" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Your choices are saved",
  );
});
test("hospital and NGO dashboards use real role-scoped records", async ({
  page,
}, testInfo) => {
  const reviewId = `${testInfo.project.name}-${Date.now()}`;
  await page.goto("/login");
  await page.getByLabel("Email address").fill("hospital@lifeline.example");
  await page.getByLabel(/^Password/).fill(process.env.SEED_PASSWORD);
  await page.getByRole("button", { name: "Let’s get you in" }).click();
  await expect(page).toHaveURL("/hospital/dashboard");
  await page.getByRole("button", { name: "Requirements", exact: true }).click();
  await page.getByRole("button", { name: "New requirement" }).click();
  await page.getByLabel("Blood group", { exact: true }).selectOption("AB-");
  await page.getByLabel("Verified units required").fill("2");
  await page
    .getByLabel("Requirement description")
    .fill(`E2E reviewed requirement ${reviewId}. No patient information.`);
  await page
    .getByLabel("Donation instructions")
    .fill("This is a test requirement. Do not visit.");
  await page
    .getByLabel("Expires at")
    .fill(new Date(Date.now() + 86400000).toISOString().slice(0, 16));
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("table")).toContainText("pending");
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.goto("/login");
  await page.getByLabel("Email address").fill("admin@lifeline.example");
  await page.getByLabel(/^Password/).fill(process.env.SEED_PASSWORD);
  await page.getByRole("button", { name: "Let’s get you in" }).click();
  await expect(page).toHaveURL("/admin");
  await page.getByRole("button", { name: "Requirements", exact: true }).click();
  const row = page
    .getByRole("row")
    .filter({ hasText: `E2E reviewed requirement ${reviewId}` });
  await row.getByRole("button", { name: "Verify", exact: true }).click();
  await page
    .getByLabel("Medical verification review note")
    .fill("Independently reviewed the demonstration requirement.");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(row).toContainText("active");
  await page.goto("/urgent-requests");
  await page.getByLabel("Blood group", { exact: true }).selectOption("AB-");
  await expect(page.locator(".request-card").first()).toContainText("AB-");
});
