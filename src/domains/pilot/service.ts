import 'server-only';
import { currentIdentity } from '@/domains/identity/current';
import { currentPerson } from '@/domains/person/current';
import { currentFounderAccess } from '@/domains/access/founder';

export async function readPilot() {
  const identity = await currentIdentity();
  const person = await currentPerson();
  if (!identity || !person) return null;
  const { data, error } = await identity.client.from('membership_accounts')
    .select('beta_access').eq('person_id', person.id).single();
  if (error || !data) throw new Error('Pilot access could not be loaded.');
  return { person, beta: data.beta_access, founder: await currentFounderAccess() };
}

export async function readPilotCohort() {
  const identity = await currentIdentity();
  if (!identity || !(await currentFounderAccess())) return null;
  const [invitations, feedback] = await Promise.all([
    identity.client.from('pilot_invitations').select('*').order('created_at', { ascending: false }),
    identity.client.from('pilot_feedback').select('*').order('created_at', { ascending: false }).limit(50),
  ]);
  if (invitations.error || feedback.error) throw new Error('Pilot cohort could not be loaded.');
  return { invitations: invitations.data, feedback: feedback.data };
}

export async function reservePilotEmail(email: string) {
  const identity = await currentIdentity();
  if (!identity || !(await currentFounderAccess())) throw new Error('Founder access required.');
  const { error } = await identity.client.rpc('pilot_reserve', { p_email: email });
  if (error) throw new Error('Unable to reserve this address. It may already be listed.');
}

export async function claimPilot() {
  const identity = await currentIdentity();
  if (!identity) return false;
  const { data, error } = await identity.client.rpc('pilot_claim');
  if (error) throw new Error('We could not verify the invitation for this account.');
  return data;
}

export async function submitPilotFeedback(category: string, message: string) {
  const identity = await currentIdentity();
  if (!identity) throw new Error('Sign in to send feedback.');
  const { error } = await identity.client.rpc('pilot_submit_feedback', {
    p_category: category, p_message: message,
  });
  if (error) throw new Error('Feedback could not be saved. Please try again.');
}
