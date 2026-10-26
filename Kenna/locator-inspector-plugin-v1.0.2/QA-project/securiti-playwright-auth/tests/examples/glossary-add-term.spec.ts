import { test, expect } from '@playwright/test';

// --- TEST DATA (edit these values in one place) ---
const data = {
  step7: 'moi',   // Fill: textbox "Name"
  step8: 'moiz',   // Fill: textbox "Name"
  step9: 'moizlocator',   // Fill: textbox "Name"
};

test('TODO rename: button Create', async ({ page }) => {
  // Step 1: open the application
  await page.goto('https://edc.qa.securiti.xyz/');
  // ASSERT (enable + edit): await expect(page).toHaveTitle(/.../);  // or await expect(page).toHaveURL(/.../);

  // Step 2: Click span "Glossary Terms"   [C text]
  await page.getByText('Glossary Terms', { exact: true }).click();
  // ASSERT (enable + edit): await expect(page.getByRole('...', { name: '...' })).toBeVisible();

  // Step 3: open the application
  await page.goto('https://edc.qa.securiti.xyz/glossary');
  // ASSERT (enable + edit): await expect(page).toHaveTitle(/.../);  // or await expect(page).toHaveURL(/.../);

  // Step 4: Click button "Add"   [A role]
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  // ASSERT (enable + edit): await expect(page.getByRole('...', { name: '...' })).toBeVisible();

  // Step 5: Click menuitem "Add Term"   [A testid]
  await page.getByTestId('add-term-button').click();
  // ASSERT (enable + edit): await expect(page.getByRole('...', { name: '...' })).toBeVisible();

  // Step 6: Click textbox "Name"   [A label]
  await page.getByLabel('Name', { exact: true }).click();
  // ASSERT (enable + edit): await expect(page.getByRole('...', { name: '...' })).toBeVisible();

  // Step 7: Type into textbox "Name"   [A label]
  await page.getByLabel('Name', { exact: true }).fill(data.step7);
  // ASSERT (enable): await expect(page.getByLabel('Name', { exact: true })).toHaveValue(data.step7);

  // Step 8: Type into textbox "Name"   [A label]
  await page.getByLabel('Name', { exact: true }).fill(data.step8);
  // ASSERT (enable): await expect(page.getByLabel('Name', { exact: true })).toHaveValue(data.step8);

  // Step 9: Type into textbox "Name"   [A label]
  await page.getByLabel('Name', { exact: true }).fill(data.step9);
  // ASSERT (enable): await expect(page.getByLabel('Name', { exact: true })).toHaveValue(data.step9);

  // Step 10: Click button "Create"   [A testid]
  await page.getByTestId('glossary-entity-modal-create-button').click();
  // ASSERT (enable + edit): await expect(page.getByRole('...', { name: '...' })).toBeVisible();

  // FINAL ASSERTION (enable + edit): verify the flow's end state, e.g.
  // await expect(page.getByRole('heading', { name: '...' })).toBeVisible();
});
