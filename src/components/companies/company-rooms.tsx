'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { Company } from '@/domains/companies/schema';
import { BriefEditor } from './brief-editor';
export function CompanyRooms() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch('/api/companies', {
          cache: 'no-store',
          signal: controller.signal,
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? 'Company rooms unavailable.');
        setCompanies(result.companies);
      } catch (error) {
        if (!controller.signal.aborted)
          setError(error instanceof Error ? error.message : 'Company rooms unavailable.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, []);
  return (
    <section className="company-rooms" aria-labelledby="company-rooms-title">
      <div className="company-room-actions">
        <h2 id="company-rooms-title">Your company rooms</h2>
        <button
          className="button"
          disabled={loading || Boolean(error)}
          onClick={() => setCreating(true)}
        >
          Create company
        </button>
      </div>
      {loading && <p role="status">Loading your companies…</p>}
      {error && (
        <p role="alert">
          {error} <Link href="/enter">Sign in ↗</Link>
        </p>
      )}
      {!loading && !error && !companies.length && (
        <p>
          Create your first company, confirm its context, and start building. Existing personal
          conversations stay in Talk.
        </p>
      )}
      {creating && (
        <BriefEditor
          onCancel={() => setCreating(false)}
          onSaved={(company) => {
            setCompanies((previous) => [company, ...previous]);
            setCreating(false);
          }}
        />
      )}
      <div className="company-job-list">
        {companies.map((company) => (
          <Link className="company-job" key={company.id} href={`/app/companies/${company.id}`}>
            <div>
              <h3>{company.name}</h3>
              <p>Private room · brief version {company.version}</p>
            </div>
            <span aria-hidden="true">↗</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
