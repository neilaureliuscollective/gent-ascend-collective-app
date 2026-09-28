import { generateLook } from '@/domains/grooming/look';import { groomingError,verifyOrigin } from '@/domains/grooming/http';
export async function POST(request:Request){try{verifyOrigin(request);const id=await generateLook(await request.json());return Response.json({id},{headers:{'Cache-Control':'no-store'}});}catch(error){return groomingError(error);}}
