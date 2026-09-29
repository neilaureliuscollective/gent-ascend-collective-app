import { runScan } from '@/domains/grooming/scan';
import { groomingError,verifyOrigin } from '@/domains/grooming/http';
export async function POST(request:Request){try{verifyOrigin(request);const size=Number(request.headers.get('content-length')||0);if(size>4500000)return Response.json({error:'Images are too large.'},{status:413});const id=await runScan(await request.formData());return Response.json({id},{headers:{'Cache-Control':'no-store'}});}catch(error){return groomingError(error);}}
