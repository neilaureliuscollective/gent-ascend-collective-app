/** Practical starting options, not generated advice or a saved personal assessment. */
export const firstSessionPaths = {
  presence: {
    label: 'Look sharper',
    title: 'Make your daily grooming deliberate.',
    detail:
      'Start with a simple ritual you can repeat. Your grooming space keeps your routine and products together.',
    action: 'Choose my morning grooming ritual',
    href: '/app/grooming',
    destination: 'Open Grooming',
  },
  body: {
    label: 'Get stronger',
    title: 'Make room for your next session.',
    detail:
      'Choose a session that fits your time and equipment. Log what you actually do, then build from it.',
    action: 'Prepare my next training session',
    href: '/app/performance',
    destination: 'Open Performance',
  },
  focus: {
    label: 'Get organized',
    title: 'Give one important thing your attention.',
    detail:
      'Choose a manageable step for today. Command keeps it ready and lets you record what moved forward.',
    action: 'Spend twenty focused minutes on my priority',
    href: '/app',
    destination: 'Open Command',
  },
} as const;
