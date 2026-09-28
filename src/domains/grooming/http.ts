import { GroomingError } from './service';
import { verifyOrigin } from '@/domains/intelligence/http';
import { IntelligenceError } from '@/domains/intelligence/service';
import { ImageGenerationError } from '@/platform/openai/image';
export function groomingError(error:unknown){const known=error instanceof GroomingError||error instanceof IntelligenceError||error instanceof ImageGenerationError;return Response.json({error:known?error.message:'Grooming Concierge could not complete this request.'},{status:known?error.status:503,headers:{'Cache-Control':'private, no-store'}});}
export {verifyOrigin};
