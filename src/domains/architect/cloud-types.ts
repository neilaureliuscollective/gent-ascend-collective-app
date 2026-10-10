import type { WebProject } from './project';
export type CloudProject = {
  id: string;
  person_id: string;
  name: string;
  revision: number;
  archived: boolean;
  created_at: string;
};
export type CloudVersion = {
  id: string;
  person_id: string;
  project_id: string;
  revision: number;
  content: WebProject;
  created_at: string;
};
export type ArchitectJob = {
  id: string;
  person_id: string;
  project_id: string;
  expected: number;
  request_hash: string;
  status: 'reserved' | 'complete' | 'failed';
  model: string;
  output: WebProject | null;
  created_at: string;
  finished_at: string | null;
};
