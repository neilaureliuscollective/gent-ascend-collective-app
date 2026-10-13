import { describe, expect, it } from 'vitest';
import {
  classifyDockerProbeError,
  ensureConstructImage,
  inspectConstructImage,
  probeDockerIsolation,
  type DockerExec,
} from '@/domains/architect-construct/docker';

describe('Construct Docker probe seam', () => {
  it('classifies a missing executable', async () => {
    const exec: DockerExec = async () => {
      const error = new Error('spawn docker ENOENT') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      throw error;
    };
    const probe = await probeDockerIsolation({ ...process.env, PATH: '/missing' }, exec);
    expect(probe).toMatchObject({ available: false, code: 'not-installed' });
    expect(probe.reason).toMatch(/not installed/);
  });

  it('classifies an executable whose daemon is down', async () => {
    const exec: DockerExec = async () => {
      throw new Error('Cannot connect to the Docker daemon at unix:///var/run/docker.sock. Is the docker daemon running?');
    };
    const probe = await probeDockerIsolation(process.env, exec);
    expect(probe).toMatchObject({ available: false, code: 'daemon-unavailable' });
  });

  it('classifies a probe timeout', async () => {
    const error = new Error('Command timed out') as NodeJS.ErrnoException;
    error.code = 'ETIMEDOUT';
    expect(classifyDockerProbeError(error).code).toBe('timeout');
    const exec: DockerExec = async () => {
      throw error;
    };
    expect((await probeDockerIsolation(process.env, exec)).code).toBe('timeout');
  });

  it('records a usable engine without claiming a sandbox', async () => {
    const exec: DockerExec = async () => ({ stdout: '27.3.1\n' });
    const probe = await probeDockerIsolation(
      { ...process.env, ARCHITECT_CONSTRUCT_IMAGE: 'node:24-alpine' },
      exec,
    );
    expect(probe).toEqual({
      available: true,
      backend: 'docker',
      version: '27.3.1',
      image: 'node:24-alpine',
      code: 'available',
      reason: null,
    });
  });

  it('inspects and ensures an image through the same injectable exec', async () => {
    const missing: DockerExec = async () => {
      throw new Error('Error: No such image');
    };
    expect((await inspectConstructImage('node:24-alpine', missing)).ready).toBe(false);
    let inspected = 0;
    const pulled: DockerExec = async (_file, args) => {
      if (args[0] === 'pull') return { stdout: 'Pulled' };
      if (args[0] === 'image') {
        inspected += 1;
        if (inspected === 1) throw new Error('Error: No such image');
        return { stdout: '[{}]' };
      }
      throw new Error(`unexpected ${args.join(' ')}`);
    };
    expect(await ensureConstructImage('node:24-alpine', pulled)).toEqual({
      ready: true,
      reason: null,
      pulled: true,
    });
  });

  it('records probe errors without using the host PATH', async () => {
    const exec: DockerExec = async () => {
      throw new Error('permission denied while trying to connect');
    };
    const probe = await probeDockerIsolation({ ...process.env, PATH: '/does-not-matter' }, exec);
    expect(probe.available).toBe(false);
    expect(probe.code).toBe('error');
  });
});
