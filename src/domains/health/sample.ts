import type { SavedObservation } from './schema';

const sampleOwner = 'sample';
const sampleRecord = 's2000000-0000-4000-8000-000000000001';

function row(
  id: string,
  name: string,
  code: string,
  value: string,
  unit: string,
  date: string,
  range: string,
  flag: string,
): SavedObservation {
  return {
    id,
    record_id: sampleRecord,
    name,
    code,
    value,
    unit,
    date,
    specimen: 'serum',
    method: 'synthetic immunoassay',
    range,
    flag,
    version: 1,
    status: 'active',
    confirmed_at: `${date}T12:00:00Z`,
  };
}

/** Isolated synthetic evidence. Never merge into an owner's records snapshot. */
export const sampleBloodwork: SavedObservation[] = [
  row(
    's1000000-0000-4000-8000-000000000001',
    'LDL cholesterol',
    '13457-7',
    '128',
    'mg/dL',
    '2026-04-02',
    '0–99',
    'H',
  ),
  row(
    's1000000-0000-4000-8000-000000000002',
    'HDL cholesterol',
    '2085-9',
    '52',
    'mg/dL',
    '2026-04-02',
    '40–60',
    '',
  ),
  row(
    's1000000-0000-4000-8000-000000000003',
    'Glucose',
    '2345-7',
    '94',
    'mg/dL',
    '2026-04-02',
    '70–99',
    '',
  ),
  row(
    's1000000-0000-4000-8000-000000000004',
    'TSH',
    '3016-3',
    '1.8',
    'mIU/L',
    '2026-04-02',
    '0.4–4.0',
    '',
  ),
  row(
    's1000000-0000-4000-8000-000000000005',
    'LDL cholesterol',
    '13457-7',
    '121',
    'mg/dL',
    '2026-07-18',
    '0–99',
    'H',
  ),
  row(
    's1000000-0000-4000-8000-000000000006',
    'HDL cholesterol',
    '2085-9',
    '55',
    'mg/dL',
    '2026-07-18',
    '40–60',
    '',
  ),
  row(
    's1000000-0000-4000-8000-000000000007',
    'Glucose',
    '2345-7',
    '91',
    'mg/dL',
    '2026-07-18',
    '70–99',
    '',
  ),
  row(
    's1000000-0000-4000-8000-000000000008',
    'TSH',
    '3016-3',
    '2.0',
    'mIU/L',
    '2026-07-18',
    '0.4–4.0',
    '',
  ),
  row(
    's1000000-0000-4000-8000-000000000009',
    'LDL cholesterol',
    '13457-7',
    '118',
    'mg/dL',
    '2026-10-04',
    '0–99',
    'H',
  ),
  row(
    's1000000-0000-4000-8000-000000000010',
    'HDL cholesterol',
    '2085-9',
    '57',
    'mg/dL',
    '2026-10-04',
    '40–60',
    '',
  ),
  row(
    's1000000-0000-4000-8000-000000000011',
    'Glucose',
    '2345-7',
    '89',
    'mg/dL',
    '2026-10-04',
    '70–99',
    '',
  ),
  row(
    's1000000-0000-4000-8000-000000000012',
    'TSH',
    '3016-3',
    '1.9',
    'mIU/L',
    '2026-10-04',
    '0.4–4.0',
    '',
  ),
];

export const sampleBloodworkRecord = {
  id: sampleRecord,
  title: 'Synthetic sample laboratory report',
  mime: 'text/csv' as const,
  size: 420,
  path: 'sample/isolated',
  hash: null,
  status: 'confirmed' as const,
  version: 1,
  created_at: '2026-10-04T12:00:00Z',
  candidates: [],
};

export const sampleWorkspaceNotice =
  'Sample workspace. These values are synthetic and are not your records.';

export function isSampleObservation(id: string) {
  return id.startsWith('s1000000-') || id.startsWith('s2000000-');
}

export function sampleProjection() {
  return {
    sample: true as const,
    owner: sampleOwner,
    record: sampleBloodworkRecord,
    observations: sampleBloodwork,
    notice: sampleWorkspaceNotice,
  };
}
