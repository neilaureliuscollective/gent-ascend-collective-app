import 'server-only';
import { gateway, type ModelMessage } from 'ai';
import { streamAurelius } from './agent';
export function generateReply(model: string, messages: ModelMessage[], signal: AbortSignal) {
  return streamAurelius(gateway(model), messages, signal);
}
