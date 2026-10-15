declare module '*architect-apps-worker-image.mjs' {
  export const defaultWorkerImage: string;
  export function workerImageName(env?: NodeJS.ProcessEnv): string;
  export function createWorkerImageStage(base?: string): string;
  export function workerImageBuildArgs(image: string, stage: string): string[];
  export function executeWorkerImageBuild(options?: {
    env?: NodeJS.ProcessEnv;
    image?: string;
    spawn?: (
      file: string,
      args: string[],
      options?: { encoding?: string; stdio?: string; cwd?: string },
    ) => { status: number | null; stdout?: string; stderr?: string };
    silent?: boolean;
    inherit?: boolean;
    stageRoot?: string;
  }): { image: string; action: string; reason?: string; status?: number; id?: string; command?: string[] };
}

declare module '*architect-apps-packaged-worker.mjs' {
  export const defaultPackagedWorkRoot: string;
  export const defaultWorkerImage: string;
  export function dockerSocketGid(
    sock?: string,
    spawn?: (file: string, args: string[]) => { status: number | null; stdout?: string },
  ): number | null;
  export function packagedWorkerInvocation(input?: {
    image?: string;
    workRoot?: string;
    dockerSock?: string;
    dockerGid?: number | null;
    spawn?: (file: string, args: string[]) => { status: number | null; stdout?: string };
    env?: Record<string, string | undefined>;
    once?: boolean;
    preflight?: boolean;
    health?: boolean;
    proveWrite?: boolean;
    compileFixture?: boolean;
    name?: string;
  }): { command: string; args: string[]; workRoot: string; image: string };
  export function preparePackagedWorkRoot(
    workRoot: string,
    spawn?: (file: string, args: string[]) => { status: number | null; stdout?: string; stderr?: string },
  ): { ok: boolean; uid?: string; gid?: string; mode?: string; workRoot: string; sharedGid?: string; reason?: string };
  export function assertPackagedWorkerIsolation(args: string[]): void;
  export function packagedWorkerTopologyArgs(input?: {
    workRoot?: string;
    image?: string;
    toolchain?: string;
    probe?: string;
    dockerGid?: number | null;
  }): string[];
  export function provePackagedWorkerTopology(options?: {
    spawn?: (file: string, args: string[]) => { status: number | null; stdout?: string; stderr?: string };
    workRoot?: string;
    image?: string;
    toolchain?: string;
  }): {
    ok: boolean;
    action: string;
    reason?: string;
    workRoot?: string;
    image?: string;
    toolchain?: string;
    command?: string[];
    output?: string;
  };
}
