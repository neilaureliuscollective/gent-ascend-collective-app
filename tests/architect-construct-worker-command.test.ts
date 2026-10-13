import { spawn } from 'node:child_process';
import { expect, it } from 'vitest';

it('starts the packaged worker command far enough to enforce authorization', async () => {
  const child = spawn('npm', ['run', 'architect:worker', '--silent'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ARCHITECT_ORIGIN_ENABLED: 'false',
      ARCHITECT_CONSTRUCT_ENABLED: 'false',
      ARCHITECT_CONSTRUCT_WORKER_TOKEN: '',
      APP_ENV: 'local',
      NODE_ENV: 'development',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const result = await new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
  expect(result.code).toBe(2);
  expect(result.stderr).toMatch(/Construct worker refused/);
  expect(result.stderr).not.toMatch(/Cannot find module|ERR_MODULE_NOT_FOUND|ExperimentalWarning.*strip-types/i);
}, 30000);
