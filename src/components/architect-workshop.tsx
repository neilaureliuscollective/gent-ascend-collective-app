'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { ArchitectCloud } from './architect-cloud';
import {
  checkProject,
  exportDocument,
  MAX_SOURCE,
  parseProject,
  previewDocument,
  scaffold,
  type WebProject,
} from '@/domains/architect/project';
export function ArchitectWorkshop() {
  const [cloudKey, setCloudKey] = useState(0);
  const [name, setName] = useState('My next idea');
  const [brief, setBrief] = useState('A focused website for my new project.');
  const [project, setProject] = useState<WebProject | null>(null);
  const [revisions, setRevisions] = useState<WebProject[]>([]);
  const [preview, setPreview] = useState('');
  const [width, setWidth] = useState('100%');
  const [status, setStatus] = useState('');
  const [pasted, setPasted] = useState('');
  const [issues, setIssues] = useState<string[] | null>(null);
  const file = useRef<HTMLInputElement>(null);
  function load(p: WebProject) {
    setCloudKey((k) => k + 1);
    setProject(p);
    setRevisions([p]);
    setPreview(previewDocument(p, document));
    setIssues(null);
    setStatus('Project opened. Work lives in this tab; download project JSON before leaving.');
  }
  function download(contents: string, filename: string, type: string) {
    const url = URL.createObjectURL(new Blob([contents], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function update(key: 'html' | 'css', value: string) {
    if (project) {
      setProject({ ...project, [key]: value });
      setIssues(null);
      setStatus('Source changed. Apply revision to refresh the preview.');
    }
  }
  return (
    <section className="architect-workshop" aria-label="Architect static website workshop">
      <p>
        This working preview creates static HTML/CSS websites. The starter is a template, not
        AI-generated code. Local tools make no model call. Optional cloud AI sends only the saved
        source and request after explicit consent. JavaScript execution, arbitrary file uploads and
        deployment are not supported here.
      </p>
      <p>
        <Link href="/app/aethelios?starter=architect-workshop" prefetch={false}>
          Prepare a reviewed website request in Talk →
        </Link>{' '}
        Existing sign-in, model configuration, permissions and quotas apply there. Nothing is sent
        automatically. Save this project before leaving. Bring the reviewed JSON back here; no
        personal context is transferred by this link.
      </p>
      <details>
        <summary>Open reviewed project JSON from Talk</summary>
        <label>
          Project JSON
          <textarea maxLength={90000} value={pasted} onChange={(e) => setPasted(e.target.value)} />
        </label>
        <button
          type="button"
          disabled={!!project || !pasted.trim()}
          onClick={() => {
            try {
              load(parseProject(JSON.parse(pasted)));
              setPasted('');
            } catch {
              setStatus(
                'Invalid project JSON. Use version, name, brief, html and css within the documented limits.',
              );
            }
          }}
        >
          Open reviewed JSON
        </button>
        <p>
          Paste only the JSON object. Inspect untrusted model-generated source before export or
          publishing.
        </p>
      </details>
      <ArchitectCloud
        key={cloudKey}
        project={project}
        onLoad={(p) => {
          setProject(p);
          setRevisions((r) => [...r.slice(-9), p]);
          setPreview(previewDocument(p, document));
          setIssues(null);
          setStatus('Cloud source loaded locally for inspection.');
        }}
      />
      <div className="architect-start">
        <label>
          Project name
          <input maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Describe your website
          <textarea maxLength={2000} value={brief} onChange={(e) => setBrief(e.target.value)} />
        </label>
        <button
          type="button"
          className="button"
          disabled={!name.trim() || !!project}
          onClick={() => load(scaffold(name, brief))}
        >
          Create starter project
        </button>
        <button type="button" disabled={!!project} onClick={() => file.current?.click()}>
          Open saved project
        </button>
        <input
          ref={file}
          type="file"
          accept="application/json,.json"
          aria-label="Saved project file"
          onChange={async (e) => {
            const selected = e.target.files?.[0];
            if (!selected) return;
            try {
              if (selected.size > 200000) throw new Error('Project file is too large.');
              load(parseProject(JSON.parse(await selected.text())));
            } catch {
              setStatus('Could not open this file. Use a workshop JSON project under 200 KB.');
            }
            e.target.value = '';
          }}
        />
      </div>
      {project && (
        <>
          <h2>{project.name}</h2>
          <p>{project.brief}</p>
          <div className="architect-editors">
            <label>
              HTML source
              <textarea
                spellCheck={false}
                maxLength={MAX_SOURCE}
                value={project.html}
                onChange={(e) => update('html', e.target.value)}
              />
            </label>
            <label>
              CSS source
              <textarea
                spellCheck={false}
                maxLength={MAX_SOURCE}
                value={project.css}
                onChange={(e) => update('css', e.target.value)}
              />
            </label>
          </div>
          <div className="architect-actions">
            <button
              type="button"
              className="button"
              onClick={() => {
                setRevisions((r) => [...r.slice(-9), project]);
                setPreview(previewDocument(project, document));
                setStatus('Revision applied to the isolated static preview.');
              }}
            >
              Apply revision
            </button>
            <button
              type="button"
              onClick={() => {
                const found = checkProject(project);
                setIssues(found);
                setStatus(
                  found.length
                    ? 'Checks found items to review.'
                    : 'Static checks passed. This is not a full security or accessibility audit.',
                );
              }}
            >
              Run static checks
            </button>
            <button
              type="button"
              onClick={() =>
                download(
                  JSON.stringify(project, null, 2),
                  'aethelios-project.json',
                  'application/json',
                )
              }
            >
              Save project JSON
            </button>
            <button
              type="button"
              onClick={() => {
                download(exportDocument(project), 'index.html', 'text/html');
                setStatus(
                  'Source exported. Review raw code before running or publishing it independently.',
                );
              }}
            >
              Export website HTML
            </button>
          </div>
          {issues && (
            <section aria-label="Check results">
              <h3>Static check results</h3>
              {issues.length ? (
                <ul>
                  {issues.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
              ) : (
                <p>
                  Heading, main landmark and styling found; no flagged active or external content.
                  Confirm contrast, content and responsive behavior yourself.
                </p>
              )}
            </section>
          )}
          <label>
            Preview width
            <select value={width} onChange={(e) => setWidth(e.target.value)}>
              <option value="100%">Full width</option>
              <option value="344px">Fold / 344 px</option>
              <option value="390px">Phone / 390 px</option>
              <option value="768px">Tablet / 768 px</option>
            </select>
          </label>
          <div className="architect-preview">
            <iframe
              title="Isolated website preview"
              sandbox=""
              referrerPolicy="no-referrer"
              srcDoc={preview}
              style={{ width, maxWidth: '100%' }}
            />
          </div>
          <p>
            Preview strips active content and external links. Export contains your original source.
            Downloaded project files stay on your device. Optional cloud saves are explicit; no
            automatic sync.
          </p>
          {!!revisions.length && (
            <details>
              <summary>Review revisions ({revisions.length} retained in this tab)</summary>
              <ol>
                {revisions.map((r, index) => (
                  <li key={index}>
                    <button
                      type="button"
                      onClick={() => {
                        setProject(r);
                        setPreview(previewDocument(r, document));
                        setIssues(null);
                        setStatus('Selected revision restored.');
                      }}
                    >
                      Restore revision {index + 1}
                    </button>
                  </li>
                ))}
              </ol>
            </details>
          )}
          <button
            type="button"
            onClick={() => {
              if (
                window.confirm(
                  'Clear this project and its tab history? Download project JSON first to keep it.',
                )
              ) {
                setCloudKey((k) => k + 1);
                setProject(null);
                setRevisions([]);
                setPreview('');
                setIssues(null);
                setPasted('');
                setStatus('Project cleared from this tab.');
              }
            }}
          >
            Clear project
          </button>
        </>
      )}
      <p role="status" aria-live="polite">
        {status}
      </p>
    </section>
  );
}
