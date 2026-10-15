// Isolated loopback fixture only. No application route, Auth bypass, provider call or hosted state.
import { createServer } from 'vite';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
const rows = new Map(),
  revisions = new Map(),
  files = new Map();
const server = await createServer({
  root: resolve('tests/label-fixture'),
  configFile: false,
  resolve: { alias: { '@': resolve('src') } },
  css: { postcss: resolve('.') },
  server: { host: '127.0.0.1', port: 3112, strictPort: true, fs: { allow: [resolve('.')] } },
  plugins: [
    {
      name: 'synthetic-label-api',
      configureServer(vite) {
        vite.middlewares.use(async (req, res, next) => {
          if (!req.url?.startsWith('/api/')) return next();
          const url = new URL(req.url, 'http://127.0.0.1:3112');
          const send = (data, status = 200) => {
            res.statusCode = status;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(data));
          };
          try {
            if (url.pathname === '/api/label-fixture') return send([...rows.values()].reverse());
            if (url.pathname === '/api/studio/design/file') {
              res.setHeader('Content-Type', 'application/pdf');
              res.setHeader('Content-Disposition', 'attachment; filename="synthetic-label.pdf"');
              return res.end(files.get(url.searchParams.get('id')));
            }
            let raw = '';
            for await (const chunk of req) {
              raw += chunk;
              if (raw.length > 524288) throw Error('Too large');
            }
            const body = JSON.parse(raw);
            const { parseDesignDocument } = await vite.ssrLoadModule(
              resolve('src/domains/studio/design/document.ts'),
            );
            const { createLabelDocument, assertLabelRevision } = await vite.ssrLoadModule(
              resolve('src/domains/studio/label/document.ts'),
            );
            const { validateDesign, blockingIssues } = await vite.ssrLoadModule(
              resolve('src/domains/studio/design/validate.ts'),
            );
            if (url.pathname === '/api/studio/label' && body.document)
              return send({
                issues: await validateDesign(parseDesignDocument(body.document), []),
                supplierApproval: false,
              });
            if (url.pathname === '/api/studio/label') {
              if (body.mode !== 'deterministic') throw Error('Fixture never calls a model.');
              const document = createLabelDocument({
                ...body,
                id: randomUUID(),
                brand: {
                  name: 'Aethelios',
                  voice: '',
                  background: '#0B3B32',
                  foreground: '#FFFFFF',
                  accent: '#C4912F',
                  typography: 'editorial',
                  logoReferenceId: null,
                },
                layout: { alignment: 'center', titleSize: 16, logoFraction: 0.32, accent: 'rule' },
                generation: 'deterministic',
              });
              const row = {
                id: document.id,
                title: document.title,
                document,
                revision: 1,
                updated_at: new Date().toISOString(),
              };
              rows.set(row.id, row);
              return send(row);
            }
            if (url.pathname === '/api/studio/design') {
              const previous = rows.get(body.id);
              if (!previous || previous.revision !== body.revision)
                return send({ error: 'DESIGN_CONFLICT' }, 409);
              const document = parseDesignDocument(body.document);
              assertLabelRevision(previous.document, document);
              const revision_id = randomUUID(),
                row = {
                  id: body.id,
                  title: document.title,
                  document,
                  revision: body.revision + 1,
                  updated_at: new Date().toISOString(),
                };
              rows.set(row.id, row);
              revisions.set(revision_id, document);
              return send({ ...row, revision_id });
            }
            if (url.pathname === '/api/studio/design/export') {
              const document = revisions.get(body.revisionId);
              if (!document) throw Error('Pinned revision missing');
              const issues = await validateDesign(document, []);
              const blocked = blockingIssues(issues);
              if (blocked.length) throw Error(blocked.map((i) => i.message).join(' '));
              const { exportPdf } = await vite.ssrLoadModule(
                resolve('src/domains/studio/design/pdf-export.ts'),
              );
              const bytes = await exportPdf(document, []);
              const exportId = randomUUID();
              files.set(exportId, Buffer.from(bytes));
              return send({
                id: body.id,
                status: 'complete',
                exportId,
                format: 'pdf',
                issues,
                width: 1465,
                height: 756,
                ppi: 300,
              });
            }
            send({ error: 'Unknown fixture endpoint' }, 404);
          } catch (error) {
            send({ error: error.message }, 422);
          }
        });
      },
    },
  ],
});
await server.listen();
