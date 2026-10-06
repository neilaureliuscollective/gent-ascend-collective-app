/** Practical starting options, not generated advice or a saved personal assessment. */
export const firstSessionPaths = {
  presence: {
    label: 'Make a decision',
    title: 'Find a clear way forward.',
    detail:
      'Bring a decision, compare the tradeoffs and choose your next step.',
    action: 'Prepare the decision I need to make',
    href: '/app?starter=perspective',
    destination: 'Open Aethelios',
  },
  body: {
    label: 'Create something',
    title: 'Give an idea a useful form.',
    detail:
      'Develop a creative brief and review your work in Studio.',
    action: 'Write a brief for my next creative project',
    href: '/app/studio',
    destination: 'Open Studio',
  },
  focus: {
    label: 'Get organized',
    title: 'Give one important thing your attention.',
    detail:
      'Choose a manageable step for today. Ongoing keeps it ready and lets you record what moved forward.',
    action: 'Spend twenty focused minutes on my priority',
    href: '/app/ongoing',
    destination: 'Open Ongoing',
  },
} as const;
