import { publishedKnowledge } from './published-knowledge';

/**
 * Single authoritative intelligence edition. Prompt strings, eval reports and
 * knowledge docs must read these values rather than restating drifted copies.
 *
 * `promptVersion` is the Talk/text instruction set stored on ordinary turns.
 * `livePromptVersion` is the Live persistence tag only; Live still composes the
 * shared instruction set from prompt.ts. Do not treat either string as a model id.
 */
export const intelligenceEdition = {
  promptVersion: 'aethelios-2026-10-15.collaborator.1',
  knowledgeEdition: publishedKnowledge.edition,
  livePromptVersion: 'aethelios-live-pilot.3',
  evalPack: 'collaborator.3',
} as const;

export const promptVersion = intelligenceEdition.promptVersion;
export const knowledgeEdition = intelligenceEdition.knowledgeEdition;
