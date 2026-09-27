import { apiError } from '@/domains/intelligence/http';
import { imageBlob } from '@/domains/studio/service';
import { IntelligenceError } from '@/domains/intelligence/service';
import { z } from 'zod';
export async function GET(request:Request){
 try{const params=new URL(request.url).searchParams;const id=params.get('id');const kind=params.get('kind');
  if(!z.uuid().safeParse(id).success||!['version','reference'].includes(kind??'')) throw new IntelligenceError('Invalid image.');
  const blob=await imageBlob(id!,kind as 'version'|'reference');
  return new Response(blob.stream(),{headers:{'Content-Type':blob.type||'image/png','Cache-Control':'private, no-store','Content-Disposition':'inline; filename="studio-image.png"','X-Content-Type-Options':'nosniff'}});
 }catch(error){return apiError(error);}
}
