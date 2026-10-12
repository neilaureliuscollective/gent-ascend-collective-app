export type StudioSetupCheck = {
  name: string;
  status: 'detected' | 'missing' | 'disabled' | 'unavailable' | 'unverified';
  next: string;
};
export function studioConfiguration(env: Record<string, string | undefined>): StudioSetupCheck[] {
  const key = Boolean(env.OPENAI_API_KEY),
    runway = Boolean(env.RUNWAYML_API_SECRET),
    signing = (env.STUDIO_FOOTAGE_SIGNING_KEY?.length ?? 0) >= 32;
  return [
    {
      name: 'OpenAI application key',
      status: key ? 'detected' : 'missing',
      next: 'Confirm image and gpt-audio-1.5 access and project budget in the intended environment. Presence is not a live model test.',
    },
    {
      name: 'Narration activation',
      status: env.STUDIO_NARRATION_ENABLED === 'true' ? 'detected' : 'disabled',
      next: 'Enable STUDIO_NARRATION_ENABLED only after reviewed schema in the existing Gent Ascend database, private audio and real generation/reopen acceptance.',
    },
    {
      name: 'Runway application key',
      status: runway ? 'detected' : 'missing',
      next: 'Set server-only RUNWAYML_API_SECRET for the application, fund API credits and verify the organization budget. A connector is not this key.',
    },
    {
      name: 'Footage receipt signing',
      status: signing ? 'detected' : 'missing',
      next: 'Set independent STUDIO_FOOTAGE_SIGNING_KEY of at least 32 characters. Preserve it; rotation requires legacy receipt handling.',
    },
    {
      name: 'Footage activation',
      status: env.STUDIO_FOOTAGE_ENABLED === 'true' ? 'detected' : 'disabled',
      next: 'Enable STUDIO_FOOTAGE_ENABLED only after schema, private video, actual approved render/cost/recovery and output-host acceptance.',
    },
    {
      name: 'Live acceptance',
      status: 'unverified',
      next: 'This read-only report does not generate media, verify billing, test private bucket configuration or prove two-account RLS. Record ordinary-login acceptance in a protected preview using the existing database.',
    },
  ];
}
