import { expect, it } from 'vitest';
import {
  liveAdmissionFieldKinds,
  liveAdmissionForm,
  readProviderRejection,
} from '@/domains/live/admission-request';

it('serializes official Realtime admission as string FormData fields, not Blob file parts', () => {
  const body = liveAdmissionForm('v=0\r\na=synthetic-offer', {
    type: 'realtime',
    model: 'gpt-realtime',
  });
  const fields = liveAdmissionFieldKinds(body);
  expect(fields.sdpKind).toBe('string');
  expect(fields.sessionKind).toBe('string');
  expect(fields.sdp).toBe('v=0\r\na=synthetic-offer');
  expect(JSON.parse(fields.session ?? '')).toEqual({ type: 'realtime', model: 'gpt-realtime' });
});

it('keeps only allowlisted provider rejection fields', () => {
  const receipt = readProviderRejection(
    400,
    'application/json',
    JSON.stringify({
      error: {
        code: 'invalid_request_error',
        type: 'invalid_request_error',
        param: 'session',
        message: 'SECRET SDP and conversation text must never be retained',
      },
      request_id: 'req_abc123',
    }),
  );
  expect(receipt).toEqual({
    providerStatus: 400,
    providerCode: 'invalid_request_error',
    providerType: 'invalid_request_error',
    providerParam: 'session',
    providerRequestId: 'req_abc123',
  });
  expect(JSON.stringify(receipt)).not.toMatch(/SECRET|SDP|conversation/);
});
