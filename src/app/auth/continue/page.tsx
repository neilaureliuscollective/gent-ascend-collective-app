import { redirect } from 'next/navigation';
import { signInDestination } from '@/domains/identity/signin-destination';
export default async function ContinueSignIn() {
  let destination: string;
  try {
    destination = await signInDestination();
  } catch {
    destination = '/enter?error=service';
  }
  // A Server Component redirect preserves the App Router navigation destination.
  redirect(destination);
}
