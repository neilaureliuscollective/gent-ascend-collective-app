import { listCompanies, saveCompany } from '@/domains/companies/service';
import { apiError, mutationBody, privateJson } from '@/domains/intelligence/http';
export async function GET() {
  try {
    return privateJson({ companies: await listCompanies() });
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request) {
  try {
    return privateJson({ company: await saveCompany(await mutationBody(request, 65536)) });
  } catch (error) {
    return apiError(error);
  }
}
