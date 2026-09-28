import { apiError, mutationBody, privateJson } from '@/domains/intelligence/http';
import { IntelligenceError } from '@/domains/intelligence/service';
import { createScene, createSceneInput, deleteScene, deleteSceneInput, updateScene, updateSceneInput } from '@/domains/studio/storyboard';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try { const input = createSceneInput.safeParse(await mutationBody(request)); if (!input.success) throw new IntelligenceError('Check the scene.'); return privateJson(await createScene(input.data), 201); }
  catch (error) { return apiError(error); }
}
export async function PATCH(request: Request) {
  try { const input = updateSceneInput.safeParse(await mutationBody(request)); if (!input.success) throw new IntelligenceError('Check the scene.'); return privateJson(await updateScene(input.data)); }
  catch (error) { return apiError(error); }
}
export async function DELETE(request: Request) {
  try { const input = deleteSceneInput.safeParse(await mutationBody(request)); if (!input.success) throw new IntelligenceError('Check the scene.'); return privateJson(await deleteScene(input.data)); }
  catch (error) { return apiError(error); }
}
