import type { IntelligenceOperation, IntelligencePhase } from './intelligence-motion';
/** Terminal/save truth wins over ornamental activity; labels never create new work. */
export function motionPresentationPhase(operation: IntelligenceOperation): IntelligencePhase {
  if (operation.persistence === 'uncertain')
    return operation.phase === 'cancelled' ? 'cancelled' : 'failed';
  if (operation.phase === 'complete' && operation.persistence === 'pending') return 'saving';
  if (['failed', 'cancelled'].includes(operation.phase)) return operation.phase;
  if (operation.label) return 'ready';
  return operation.phase;
}
