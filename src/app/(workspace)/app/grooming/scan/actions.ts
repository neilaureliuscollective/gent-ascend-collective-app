'use server';
import { revalidatePath } from 'next/cache';import { redirect } from 'next/navigation';import { deleteScan } from '@/domains/grooming/scan';
export async function deleteScanAction(form:FormData){let result='deleted';try{await deleteScan(form.get('id'));revalidatePath('/app/grooming/scan');}catch{result='error';}redirect(`/app/grooming/scan?result=${result}#history`);}
