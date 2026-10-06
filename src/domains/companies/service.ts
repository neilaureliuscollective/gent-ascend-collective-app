import 'server-only';
import {
  intelligenceSession,
  IntelligenceError,
  conversationTurns,
} from '@/domains/intelligence/service';
import { currentAccess } from '@/domains/access/current';
import { aiConfigSchema } from '@/domains/intelligence/validation';
import { companyInput } from './schema';
export async function listCompanies() {
  const { client, person } = await intelligenceSession();
  const result = await client
    .from('companies')
    .select('*')
    .eq('person_id', person.id)
    .order('created_at', { ascending: false });
  if (result.error) throw new IntelligenceError('Company rooms could not be loaded.', 503);
  return result.data ?? [];
}
export async function readCompany(id: string) {
  const { client, person } = await intelligenceSession();
  const result = await client
    .from('companies')
    .select('*')
    .eq('person_id', person.id)
    .eq('id', id)
    .maybeSingle();
  if (result.error) throw new IntelligenceError('Company could not be loaded.', 503);
  if (!result.data) throw new IntelligenceError('Company not found.', 404);
  return result.data;
}
export async function saveCompany(body: unknown) {
  const parsed = companyInput.safeParse(body);
  if (!parsed.success)
    throw new IntelligenceError('Enter a company name and a brief of at most 12,000 characters.');
  const { client, person } = await intelligenceSession();
  const { id, name, brief, version } = parsed.data;
  const result =
    version === 0
      ? await client
          .from('companies')
          .insert({ id, person_id: person.id, name, brief })
          .select('*')
          .single()
      : await client
          .from('companies')
          .update({ name, brief, version: version + 1, confirmed_at: new Date().toISOString() })
          .eq('id', id)
          .eq('person_id', person.id)
          .eq('version', version)
          .select('*')
          .maybeSingle();
  if (result.error || !result.data)
    throw new IntelligenceError(
      'The brief changed or could not be saved. Reload before editing again.',
      409,
    );
  return result.data;
}
export async function readCompanyTalk(
  companyId: string,
  conversationId?: string,
  before?: string,
  listBefore?: string,
) {
  const company = await readCompany(companyId);
  const { client, person } = await intelligenceSession();
  let query = client
    .from('ai_conversations')
    .select('*')
    .eq('person_id', person.id)
    .eq('company_id', company.id)
    .is('archived_at', null)
    .order('updated_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(41);
  if (listBefore) {
    const [time, id] = listBefore.split('|');
    query = query.or(`updated_at.lt.${time},and(updated_at.eq.${time},id.lt.${id})`);
  }
  const [list, turns, access] = await Promise.all([
    query,
    conversationId ? conversationTurns(conversationId, before, company.id) : Promise.resolve([]),
    currentAccess(),
  ]);
  if (list.error) throw new IntelligenceError('Company conversations could not be loaded.', 503);
  const config = aiConfigSchema.parse(process.env);
  return {
    company,
    conversations: (list.data ?? []).slice(0, 40),
    turns: turns.slice(-40),
    hasOlderTurns: turns.length > 40,
    nextCursor:
      list.data?.length === 41 && list.data[39]
        ? `${list.data[39].updated_at}|${list.data[39].id}`
        : null,
    canChat: access.has('aurelius.context') && Boolean(config.OPENAI_API_KEY),
  };
}
