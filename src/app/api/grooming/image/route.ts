import { photoBlob } from '@/domains/grooming/service';
import { lookBlob } from '@/domains/grooming/look';
import { groomingError } from '@/domains/grooming/http';
import { z } from 'zod';
export async function GET(request:Request){try{const query=new URL(request.url).searchParams,id=query.get('id'),kind=query.get('kind');if(!z.uuid().safeParse(id).success||!['photo','look'].includes(kind??''))return new Response('Not found',{status:404});const blob=kind==='photo'?await photoBlob(id):await lookBlob(id);return new Response(blob.stream(),{headers:{'Content-Type':blob.type||'image/png','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});}catch(error){return groomingError(error);}}
