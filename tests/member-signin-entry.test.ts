import { beforeEach, expect, it, vi } from 'vitest';
const auth = vi.hoisted(() => ({
  signIn: vi.fn(),
  pilot: vi.fn(),
  access: vi.fn(),
  person: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
}));
vi.mock('next/headers', () => ({ cookies: async () => ({ set: vi.fn() }) }));
vi.mock('@/platform/supabase/server', () => ({
  serverClient: async () => ({ auth: { signInWithPassword: auth.signIn } }),
}));
vi.mock('@/platform/supabase/connection', () => ({
  supabaseConnection: () => ({ url: 'https://synthetic.supabase.co', key: 'synthetic' }),
}));
vi.mock('@/domains/person/current', () => ({ currentPerson: auth.person }));
vi.mock('@/domains/pilot/service', () => ({ readPilot: auth.pilot }));
vi.mock('@/domains/access/current', () => ({ currentAccess: auth.access }));
import { signIn } from '../src/app/auth/actions';
function form() {
  const f = new FormData();
  f.set('entry', 'world');
  f.set('email', 'synthetic@example.test');
  f.set('password', 'synthetic-password');
  return f;
}
beforeEach(() => {
  auth.signIn.mockResolvedValue({ error: null });
  auth.access.mockResolvedValue(new Set());
  auth.person.mockResolvedValue({ onboarding_completed: false, priority: '' });
});
it('returning beta membership enters the product without a mandatory priority field', async () => {
  auth.pilot.mockResolvedValue({ beta: true, founder: false, person: { priority: '' } });
  await expect(signIn(form())).rejects.toThrow('redirect:/app');
});
it('founder enters the product without repeating setup', async () => {
  auth.pilot.mockResolvedValue({ beta: false, founder: true, person: { priority: '' } });
  await expect(signIn(form())).rejects.toThrow('redirect:/app');
});
it('paid membership enters Command through the existing capability check', async () => {
  auth.pilot.mockResolvedValue({ beta: false, founder: false, person: { priority: '' } });
  auth.access.mockResolvedValue(new Set(['aurelius.context']));
  await expect(signIn(form())).rejects.toThrow('redirect:/app');
});
it('unclaimed invitation still has a place to establish access', async () => {
  auth.pilot.mockResolvedValue({ beta: false, founder: false, person: { priority: '' } });
  await expect(signIn(form())).rejects.toThrow('redirect:/app/welcome');
});
it('failed authentication stays on sign-in', async () => {
  auth.signIn.mockResolvedValue({ error: { code: 'invalid_credentials', status: 400 } });
  await expect(signIn(form())).rejects.toThrow('redirect:/enter?error=credentials');
});

it('returning free member with completed initialization goes directly to Command', async () => {
  auth.pilot.mockResolvedValue({ beta: false, founder: false });
  auth.person.mockResolvedValue({ onboarding_completed: true, priority: '' });
  await expect(signIn(form())).rejects.toThrow('redirect:/app');
});
it('explicit public direction claim keeps its review flow', async () => {
  const claim = form();
  claim.set('claim', '1');
  await expect(signIn(claim)).rejects.toThrow('redirect:/experience/world?claim=1');
});
