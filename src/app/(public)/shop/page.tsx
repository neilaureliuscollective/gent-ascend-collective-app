import { redirect } from 'next/navigation';
export const metadata = { title: 'Legacy Reserve', robots: { index: false, follow: false } };
export default function RetiredShop() {
  redirect('/app/lifestyle');
}
