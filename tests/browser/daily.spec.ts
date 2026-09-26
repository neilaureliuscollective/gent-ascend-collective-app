import { test, expect } from '@playwright/test';
import { sampleData } from '../../src/domains/daily/model';
for (const width of [360, 768, 1440])
  test(`sample dashboard is useful, isolated and responsive at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 960 });
    const writes: string[] = [];
    page.on('request', (r) => {
      if (r.method() !== 'GET' && r.url().includes('/api/')) writes.push(r.url());
    });
    await page.goto('/');
    await page.getByRole('button', { name: 'Explore a sample day' }).click();
    await expect(page.getByText('Sample experience', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const action = page.getByRole('checkbox', {
      name: 'Give the most important project 45 focused minutes',
    });
    await action.click();
    await expect(action).toBeChecked();
    await action.click();
    await expect(action).not.toBeChecked();
    await page.getByRole('button', { name: 'Update your check-in' }).click();
    await page
      .getByLabel('What matters most today?')
      .fill('Make room for a meaningful conversation');
    await page.getByRole('button', { name: '3 Steady', exact: true }).click();
    await page.getByLabel('Hours slept').fill('8');
    await page.getByRole('button', { name: 'Apply to sample' }).click();
    await expect(
      page.getByRole('heading', { name: 'Make room for a meaningful conversation' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Add a deliberate action' }).click();
    await page.getByLabel('One action you can take').fill('Call a friend');
    await page.getByRole('button', { name: 'Apply to sample' }).click();
    await expect(page.getByRole('checkbox', { name: 'Call a friend' })).toBeVisible();
    await page.getByRole('button', { name: 'Evening', exact: true }).click();
    await page.getByRole('button', { name: 'Reflect on today', exact: true }).click();
    await page
      .getByLabel('A win, a lesson, or something to remember')
      .fill('A small step was enough.');
    await page.getByRole('button', { name: 'Apply to sample' }).click();
    await expect(page.locator('.reflection-card')).toContainText('A small step was enough.');
    await page.getByRole('button', { name: '30 days', exact: true }).click();
    await page.getByText('Read the daily values').click();
    await expect(page.locator('.daily-table-scroll tbody tr')).toHaveCount(30);
    expect(writes).toEqual([]);
    await page.getByRole('button', { name: 'Exit sample' }).click();
    await expect(page.getByRole('heading', { name: 'Make today yours.' })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: 'Call a friend' })).toHaveCount(0);
  });
test('daily editor preserves unsaved text on conflict and reloads only deliberately', async ({
  page,
}) => {
  const data = { ...sampleData('2026-09-21'), mode: 'personal' as const, name: 'Synthetic tester' };
  let conflict = true;
  await page.route('**/api/daily', async (route) => {
    if (route.request().method() === 'PUT') {
      if (conflict)
        return route.fulfill({
          status: 409,
          json: { error: 'Your day changed in another session. Reload first.' },
        });
      const update = route.request().postDataJSON();
      data.entries = data.entries.map((e) =>
        e.day === update.day ? { ...e, ...update, version: update.version + 1 } : e,
      );
    }
    return route.fulfill({ json: data });
  });
  await page.goto('http://127.0.0.1:3102/?mode=daily');
  await page.getByRole('button', { name: 'Update your check-in' }).click();
  await page.getByLabel('What matters most today?').fill('Keep this draft');
  await page.getByRole('button', { name: 'Save your day', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('another session');
  await expect(page.getByLabel('What matters most today?')).toHaveValue('Keep this draft');
  await expect(page.getByRole('button', { name: 'Save your day', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Reload saved day (discard draft)' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  conflict = false;
  await page.getByRole('button', { name: 'Update your check-in' }).click();
  await page.getByLabel('What matters most today?').fill('A saved intention');
  await page.getByRole('button', { name: 'Save your day', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Your day is saved.');
  await expect(page.getByRole('heading', { name: 'A saved intention' })).toBeVisible();
});
test('completion endpoint rejects unsigned and hostile-origin requests',async ({request})=>{
 const url='http://127.0.0.1:3100/api/daily/complete';
 const input={day:'2026-09-25',actionId:'62000000-0000-4000-8000-000000000001',version:1};
 expect((await request.post(url,{data:input,headers:{Origin:'https://hostile.example'}})).status()).toBe(403);
 expect((await request.post(url,{data:input,headers:{Origin:'http://127.0.0.1:3100'}})).status()).toBe(401);
});
test('evening review stays a draft until confirmed and allows correction', async ({page})=>{
 const data={...sampleData('2026-09-21'),mode:'personal' as const,name:'Synthetic tester'};
 const day=data.entries.find(entry=>entry.day===data.today)!;
 const methods:string[]=[];
 await page.route('**/api/daily',async route=>{
  const input=route.request().postDataJSON();
  day.reflection=input.reflection;
  day.version+=1;
  await route.fulfill({json:data});
 });
 await page.route('**/api/daily/review',async route=>{
  const method=route.request().method();methods.push(method);
  if(method==='POST') return route.fulfill({json:{review:{progress:'Finished the client brief',blocker:'Late meeting delayed planning',tomorrow:'Protect the morning'},sourceDayVersion:day.version}});
  const input=route.request().postDataJSON();
  day.review={...input.review,version:1,source_kind:'user',source_day_version:day.version,confirmed_at:new Date().toISOString()};
  return route.fulfill({json:data});
 });
 await page.goto('http://127.0.0.1:3102/?mode=daily');
 await page.getByRole('button',{name:'Leave a reflection'}).click();
 await page.getByLabel('A win, a lesson, or something to remember').fill('I finished the client brief; the late meeting delayed planning.');
 await page.getByRole('button',{name:'Save your day',exact:true}).click();
 await expect(page.locator('.reflection-card')).toContainText('I finished the client brief');
 await page.getByRole('button',{name:'Close the loop for today'}).click();
 await page.getByRole('button',{name:'Prepare from my reflection with Aethelios'}).click();
 await expect(page.getByLabel('What moved forward?')).toHaveValue('Finished the client brief');
 await expect(page.locator('.evening-review-summary')).toHaveCount(0);
 await page.getByLabel('What should tomorrow remember?').fill('Write first, meet later');
 await page.getByRole('button',{name:'Confirm review'}).click();
 await expect(page.getByText('Write first, meet later')).toBeVisible();
 expect(methods).toEqual(['POST','PUT']);
 await page.getByRole('button',{name:'Refine your review'}).click();
 await expect(page.getByLabel('What should tomorrow remember?')).toHaveValue('Write first, meet later');
});
test('dashboard conversation starter is a draft, never an automatic model request', async ({
  page,
}) => {
  const writes: string[] = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.url().includes('/api/aurelius')) writes.push(r.url());
  });
  await page.goto('/');
  await page.getByRole('link', { name: 'Plan with Aethelios' }).click();
  await expect(page.getByLabel('Message Aethelios')).toHaveValue(
    'Help me choose what matters most today and turn it into a manageable plan.',
  );
  expect(writes).toEqual([]);
});
test('daily API rejects anonymous reads/writes and hostile origins', async ({ request }) => {
  expect((await request.get('/api/daily')).status()).toBe(401);
  const input = {
    day: '2026-09-21',
    version: 0,
    energy: null,
    sleep_minutes: null,
    intention: '',
    reflection: '',
    actions: [],
  };
  expect(
    (
      await request.put('/api/daily', {
        headers: { Origin: 'https://attacker.example' },
        data: input,
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.put('/api/daily', { headers: { Origin: 'http://127.0.0.1:3100' }, data: input })
    ).status(),
  ).toBe(401);
});
test('review API rejects hostile origins and unsigned requests',async({request})=>{
 const input={day:'2026-09-21',sourceDayVersion:1,requestId:'87000000-0000-4000-8000-000000000099'};
 expect((await request.post('/api/daily/review',{headers:{Origin:'https://attacker.example'},data:input})).status()).toBe(403);
 expect((await request.post('/api/daily/review',{headers:{Origin:'http://127.0.0.1:3100'},data:input})).status()).toBe(401);
 const confirmation=await request.put('/api/daily/review',{headers:{Origin:'http://127.0.0.1:3100','Content-Type':'application/json'},data:JSON.stringify({...input,expectedReviewVersion:0,review:{progress:'Own work',blocker:'',tomorrow:''}})});
 expect(confirmation.status(),JSON.stringify(await confirmation.json())).toBe(401);
});

test('short-screen daily editor supports keyboard dismissal, focus return and large text', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore a sample day' }).click();
  await page.addStyleTag({ content: 'html { font-size: 200%; }' });
  const trigger = page.getByRole('button', { name: 'Update your check-in' });
  await trigger.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByLabel('Hours slept').fill('0');
  await page.getByRole('button', { name: 'Apply to sample' }).click();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(page.getByLabel('Hours slept')).toHaveValue('0');
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('unrecognized conversation starter stays empty', async ({ page }) => {
  await page.goto('/aethelios?starter=constructor');
  await expect(page.getByLabel('Message Aethelios')).toHaveValue('');
});
