'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { MemoryEditor } from '@/components/aurelius/memory-editor';
import type { libraryOverview } from '@/domains/workspace/overview';
export function IntelligenceLibrary({ initial }: { initial: Awaited<ReturnType<typeof libraryOverview>> }) {
  const [query, setQuery] = useState('');
  const router = useRouter();
  const matches = (title: string) => title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
  return <>
    <label htmlFor="intelligence-library-search">Filter loaded titles</label><input id="intelligence-library-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Find a conversation or project" />
    <p className="muted">Filters the 40 most recent active conversations and up to 100 project titles loaded here. Open conversation history for older messages and archives. This is title matching, not semantic search.</p>
    <section><h2>Conversations</h2>{initial.conversations.status === 'ready' ? <><ul className="intelligence-records">{initial.conversations.data.filter(item => matches(item.title)).map(item => <li key={item.id}><Link href={`/app?conversation=${item.id}`}>{item.title} →</Link><time dateTime={item.updated_at}>{item.updated_at.slice(0,10)}</time><small>Conversation</small></li>)}</ul>{!initial.conversations.data.filter(item => matches(item.title)).length && <p>No conversations match the loaded titles.</p>}</> : <p role="status">{initial.conversations.status === 'locked' ? 'Sign in to see your history.' : 'Conversation history is unavailable.'}</p>}<Link href="/app">Open full conversation history and archive →</Link></section>
    <section><h2>Confirmed memory</h2>{initial.memories.status === 'ready' ? <MemoryEditor memories={initial.memories.data} onChanged={async () => router.refresh()} /> : <p role="status">{initial.memories.status === 'locked' ? 'Sign in to manage memory.' : 'Memory is unavailable.'}</p>}</section>
    <section><h2>Saved creative work</h2>{initial.projects.status === 'ready' ? <><ul className="intelligence-records">{initial.projects.data.filter(item => matches(item.title)).map(item => <li key={item.id}><Link href={`/app/studio?project=${item.id}`}>{item.title} →</Link><small>Studio project · open for saved images, versions and finishes</small><time dateTime={item.updated_at}>{item.updated_at.slice(0,10)}</time></li>)}</ul>{!initial.projects.data.filter(item => matches(item.title)).length && <p>No projects match the loaded titles.</p>}</> : <p role="status">Studio work is unavailable or access is not enabled. Reopen Studio to check.</p>}</section>
  </>;
}
