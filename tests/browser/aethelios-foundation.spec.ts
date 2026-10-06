import { test, expect } from './fixtures';
import type { WorkspaceData } from '../../src/domains/intelligence/types';
const conversation = 'cd000000-0000-4000-8000-000000000001';
const owner = 'cd000000-0000-4000-8000-000000000003';
const fixture: WorkspaceData = { ownerId: owner, conversations: [{ id: conversation, person_id: owner, title: 'A real decision to resume', created_at: '2026-10-06T00:00:00Z', updated_at: '2026-10-06T00:00:00Z' }], turns: [], memories: [], actionProposals: [], context: { profile: {name:'Synthetic user',priority:'Private preference',timezone:'UTC',units:'metric',updatedAt:''},goal:null,memories:[] },canChat:true,configured:true,model:'fixture' };
for (const width of [360, 390, 820, 1440]) test(`direct intelligence opening, composer and three destinations at ${width}`, async ({ page }) => {
  await page.setViewportSize({width,height:900});
  let modelCalls=0;
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/api/aurelius**', route => {
    if (route.request().method() !== 'GET') modelCalls++;
    return route.fulfill({json:fixture});
  });
  await page.goto('/app');
  await expect(page.getByLabel('Message Aethelios')).toBeVisible();
  const nav=page.getByRole('navigation',{name:'Main navigation'});
  await expect(nav.getByRole('link')).toHaveCount(3);
  if (width <= 1100) await expect(nav.getByRole('link', {name:'Ongoing',exact:true})).toBeVisible();
  await expect(nav.getByRole('link',{name:'Aethelios',exact:true})).toHaveAttribute('aria-current','page');
  await expect(page.getByRole('heading',{name:'What’s on your mind?'})).toBeVisible();
  await expect(page.getByLabel('Use personal context')).not.toBeChecked();
  await expect(page.getByRole('button',{name:'A real decision to resume →'})).toBeVisible();
  await page.getByLabel('Message Aethelios').fill('Unsent decision draft');
  await page.setViewportSize({width:width<1000?900:390,height:650});
  await expect(page.getByLabel('Message Aethelios')).toHaveValue('Unsent decision draft');
  expect(modelCalls).toBe(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(errors).toEqual([]);
  await page.screenshot({path:`test-results/aethelios-foundation-${width}.png`,fullPage:true});
  await nav.getByRole('link', {name:'Ongoing',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Carry it forward.'})).toBeVisible();
});
test('source picker sends only explicit selection and displays a saved acknowledgment', async ({ page }) => {
  let sent:Record<string,unknown>|null=null;
  await page.route('**/api/aurelius**',route => {
    if (route.request().url().endsWith('/chat')) {
      sent=route.request().postDataJSON();
      const turn={id:sent!.requestId,person_id:owner,conversation_id:sent!.conversationId,user_text:sent!.text,assistant_text:'A useful next step.',status:'complete',model:'fixture',context_included:sent!.includeContext,prompt_version:'fixture',feedback:null,created_at:'2026-10-06T00:00:00Z',finished_at:'2026-10-06T00:00:01Z'};
      return route.fulfill({contentType:'application/x-ndjson',body:JSON.stringify({type:'delta',text:turn.assistant_text})+'\n'+JSON.stringify({type:'saved',turn})+'\n'});
    }
    return route.fulfill({json:fixture});
  });
  await page.goto('/app');
  await page.getByText('Context sources · 0 selected',{exact:true}).click();
  await page.getByLabel('Active goal',{exact:true}).check();
  await page.getByLabel('Message Aethelios').fill('Compare this decision');
  await page.getByRole('button',{name:'Send',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('Reply saved.');
  expect(sent!.includeContext).toBe(true);
  expect(sent!.contextSources).toEqual({profile:false,goals:true,memory:false,daily:false,lifestyle:false});
});
test('specialist preparation stays disabled until explicit consent', async ({ page }) => {
  await page.route('**/api/aurelius',route=>route.fulfill({json:fixture}));
  await page.goto('/app');
  await page.getByLabel('Message Aethelios').fill('Create a campaign image for my project');
  const prepare=page.getByRole('button',{name:'Prepare in Studio ↗'});
  await expect(prepare).toBeDisabled();
  await page.getByLabel('Share saved Studio records for this preparation').check();
  await expect(prepare).toBeEnabled();
});
test('public identity, legacy entry and specialist links remain reachable',async({page,request})=>{
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'Clear thinking. Work that carries forward.'})).toBeVisible();
  for(const path of ['/experience','/experience/world','/gent-ascend']){
    await page.goto(path);
    await expect(page.getByRole('heading',{name:'Clear thinking. Work that carries forward.'})).toBeVisible();
  }
  for(const path of ['/app/ongoing','/app/library','/app/daily','/app/presence','/app/performance','/app/studio','/app/collection']) expect((await request.get(path)).ok()).toBe(true);
  await page.goto('/app/library');
  await expect(page.getByText('Conversation history is unavailable.',{exact:true})).toBeVisible();
  await expect(page.getByText('Memory is unavailable.',{exact:true})).toBeVisible();
});
test('private bridge fails closed and clears old cookie paths',async({request})=>{
  for(const endpoint of ['start','callback']){
    const response=await request.get(`/api/aethelios-link/${endpoint}?code=ignored&state=ignored`);
    expect(response.status()).toBe(410);
    expect(response.headers()['cache-control']).toBe('private, no-store');
    expect(response.headers()['set-cookie']).toContain('aethelios-founder-link=');
    expect(response.headers()['set-cookie']).toContain('Max-Age=0');
  }
  expect((await request.get('/dev')).status()).toBe(404);
  expect((await request.post('/api/aurelius/chat',{data:{}})).status()).toBeGreaterThanOrEqual(400);
});
test('PWA identity and former icon URLs resolve without changing app origin or ID',async({request})=>{
  const manifest=await (await request.get('/manifest.webmanifest')).json();
  expect(manifest.name).toBe('Aethelios');expect(manifest.short_name).toBe('Aethelios');expect(manifest.id).toBe('/');expect(manifest.scope).toBe('/');expect(manifest.start_url).toBe('/app');
  for(const icon of manifest.icons)expect((await request.get(icon.src)).ok()).toBe(true);
  for(const url of ['/brand/icon-192.png','/brand/icon-v2-512.png','/brand/app-crest-20261004-512.png','/brand/app-crest-20261004-maskable-512.png','/apple-touch-icon.png'])expect((await request.get(url)).ok()).toBe(true);
});
test('capability search uses a keyboard-safe sheet without losing the conversation draft', async ({page})=>{
  await page.setViewportSize({width:390,height:740});
  await page.route('**/api/aurelius',route=>route.fulfill({json:fixture}));
  await page.goto('/app');
  await page.getByLabel('Message Aethelios').fill('Keep this thought');
  const button=page.locator('.aethelios-room-heading').getByRole('button',{name:'Capabilities',exact:true});
  await button.click();
  const dialog=page.getByRole('dialog',{name:'Capabilities'});
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Find a capability').fill('Presence');
  await expect(dialog.getByRole('link')).toHaveCount(1);
  await expect(dialog.getByRole('link',{name:'Presence',exact:false})).toHaveAttribute('href','/app/presence');
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(button).toBeFocused();
  await expect(page.getByLabel('Message Aethelios')).toHaveValue('Keep this thought');
});
