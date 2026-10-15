// Disposable local Supabase only. Real Auth/PostgREST denials for voice bindings and design receipts.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { localSupabaseControlPlane } from './local-supabase-control-plane.mjs';

const env = Object.fromEntries(
  readFileSync('.env.development.local', 'utf8')
    .trim()
    .split(/\r?\n/)
    .map((line) => {
      const index = line.indexOf('=');
      return [line.slice(0, index), line.slice(index + 1)];
    }),
);
assert.equal(new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname, '127.0.0.1');
const client = () =>
  createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
const owner = client();
const foreign = client();
assert.equal(
  (await owner.auth.signInWithPassword({ email: 'founder@aurelius.test', password: env.AURELIUS_FOUNDER_PASSWORD }))
    .error,
  null,
);
assert.equal(
  (await foreign.auth.signInWithPassword({ email: 'member@aurelius.test', password: env.AURELIUS_FOUNDER_PASSWORD }))
    .error,
  null,
);
const plane = localSupabaseControlPlane();
const trusted = createClient(plane.url, plane.serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const conversation = crypto.randomUUID();
const turn = crypto.randomUUID();
try {
  assert.equal(
    (
      await owner.rpc('ai_begin_turn', {
        p_conversation: conversation,
        p_request: turn,
        p_text: 'Voice binding denial.',
        p_model: 'synthetic-no-model-call',
        p_context: false,
        p_prompt_version: 'talk-receipt-auth',
      })
    ).error,
    null,
  );
  const session = crypto.randomUUID();
  assert.ok(
    (
      await owner.from('ai_live_turn_bindings').insert({
        person_id: (await owner.auth.getUser()).data.user.id,
        conversation_id: conversation,
        session_id: session,
        provider_item_id: 'forged',
        turn_id: turn,
      })
    ).error,
    'direct binding insert must be denied',
  );
  assert.ok(
    (
      await owner.rpc('ai_live_observe_item', {
        p_session: session,
        p_conversation: conversation,
        p_item: 'item-1',
        p_response: 'resp-1',
      })
    ).error,
    'direct observe must be denied',
  );
  assert.ok(
    (
      await owner.rpc('ai_live_observe_trusted_item', {
        p_session: session,
        p_conversation: conversation,
        p_item: 'spoken-1',
        p_response: 'resp-1',
        p_turn: turn,
      })
    ).error,
    'browser clients cannot call the trusted observe path',
  );
  assert.ok(
    (
      await owner.rpc('ai_live_bind_turn', {
        p_session: session,
        p_conversation: conversation,
        p_item: 'item-1',
        p_response: 'resp-1',
        p_turn: turn,
      })
    ).error,
    'direct bind must be denied',
  );
  assert.ok(
    (
      await owner.rpc('ai_live_bind_finished_turn', {
        p_session: session,
        p_conversation: conversation,
        p_item: 'item-1',
        p_response: 'resp-1',
        p_turn: turn,
      })
    ).error,
    'nonexistent session must be denied',
  );
  assert.equal((await owner.rpc('ai_finish_turn', { p_request: turn, p_text: 'Saved.', p_status: 'complete' })).error, null);
  const reserved = await owner.rpc('ai_live_reserve', {
    p_id: crypto.randomUUID(),
    p_conversation: conversation,
    p_model: 'synthetic-no-model-call',
  });
  if (!reserved.error && reserved.data) {
    const liveSession = (
      await owner.from('ai_live_sessions').select('id').eq('conversation_id', conversation).maybeSingle()
    ).data?.id;
    assert.ok(liveSession);
    assert.ok(
      (
        await owner.rpc('ai_live_observe_item', {
          p_session: liveSession,
          p_conversation: conversation,
          p_item: 'spoken-1',
          p_response: 'resp-1',
        })
      ).error,
      'observe on a real session must be denied',
    );
    const invented = await owner.rpc('ai_live_bind_finished_turn', {
      p_session: liveSession,
      p_conversation: conversation,
      p_item: 'spoken-1',
      p_response: 'resp-1',
      p_turn: turn,
    });
    assert.ok(invented.error, 'invented spoken-1 from a browser client must not bind');
    const otherTurn = crypto.randomUUID();
    assert.equal(
      (await owner.rpc('ai_begin_turn', {
        p_conversation: conversation,
        p_request: otherTurn,
        p_text: 'Second completed turn.',
        p_model: 'synthetic-no-model-call',
        p_context: false,
        p_prompt_version: 'talk-receipt-auth',
      })).error,
      null,
    );
    assert.equal(
      (await owner.rpc('ai_finish_turn', { p_request: otherTurn, p_text: 'Saved again.', p_status: 'complete' }))
        .error,
      null,
    );
    const observed = await trusted.rpc('ai_live_observe_trusted_item', {
      p_session: liveSession,
      p_conversation: conversation,
      p_item: 'spoken-1',
      p_response: 'resp-1',
      p_turn: turn,
    });
    assert.equal(observed.error, null, 'trusted server fixture event must observe');
    assert.equal(observed.data.trusted, true);
    assert.equal(observed.data.turnId, turn);
    const wrongTurn = await owner.rpc('ai_live_bind_finished_turn', {
      p_session: liveSession,
      p_conversation: conversation,
      p_item: 'spoken-1',
      p_response: 'resp-1',
      p_turn: otherTurn,
    });
    assert.ok(wrongTurn.error, 'observed item must not bind to a different completed turn');
    const wrongResponse = await owner.rpc('ai_live_bind_finished_turn', {
      p_session: liveSession,
      p_conversation: conversation,
      p_item: 'spoken-1',
      p_response: 'resp-2',
      p_turn: turn,
    });
    assert.ok(wrongResponse.error, 'observed item must not bind to a mismatched response');
    const bound = await owner.rpc('ai_live_bind_finished_turn', {
      p_session: liveSession,
      p_conversation: conversation,
      p_item: 'spoken-1',
      p_response: 'resp-1',
      p_turn: turn,
    });
    assert.equal(bound.error, null, 'server-observed item on its intended completed turn can bind');
    assert.equal(bound.data.turnId, turn);
    const replay = await owner.rpc('ai_live_bind_finished_turn', {
      p_session: liveSession,
      p_conversation: conversation,
      p_item: 'spoken-1',
      p_response: 'resp-1',
      p_turn: turn,
    });
    assert.equal(replay.error, null, 'identical bind retry recovers');
    assert.equal(replay.data.recovered, true);
    assert.equal(replay.data.turnId, turn);
  }
  assert.ok(
    (
      await owner.rpc('architect_apps_retain_design', {
        p_request: crypto.randomUUID(),
        p_project: crypto.randomUUID(),
        p_digest: 'a'.repeat(64),
        p_receipt: {
          identity: {
            conversationId: conversation,
            boardId: crypto.randomUUID(),
            boardVersion: 1,
            directionId: crypto.randomUUID(),
          },
        },
        p_source_kind: 'talk-authorized',
        p_verified: true,
      })
    ).error,
    'caller-asserted verified retain without a Talk board or project must be denied',
  );
  assert.ok(
    (
      await owner.from('ai_talk_direction_transfers').insert({
        id: crypto.randomUUID(),
        conversation_id: conversation,
        board_id: crypto.randomUUID(),
        board_version: 1,
        direction_id: 'direction-c',
        direction_uuid: crypto.randomUUID(),
        project_id: crypto.randomUUID(),
        digest: 'a'.repeat(64),
        receipt: { schema: 'talk-architect-direction/v1' },
        imported: true,
      })
    ).error,
    'direct imported receipt insert must be denied',
  );
  assert.ok(
    (
      await owner.rpc('ai_talk_record_direction_transfer', {
        p_id: crypto.randomUUID(),
        p_conversation: conversation,
        p_board: crypto.randomUUID(),
        p_version: 1,
        p_direction: 'direction-c',
        p_direction_uuid: crypto.randomUUID(),
        p_project: crypto.randomUUID(),
        p_digest: 'a'.repeat(64),
        p_receipt: { schema: 'talk-architect-direction/v1' },
      })
    ).error,
    'receipt without Architect acknowledgment must be denied',
  );
  assert.equal((await foreign.from('ai_live_turn_bindings').select('turn_id')).data?.length ?? 0, 0);
  assert.equal((await foreign.from('ai_talk_direction_transfers').select('id')).data?.length ?? 0, 0);
  console.log(
    'PASS: Talk receipt Auth/PostgREST denies browser observe/bind, invented spoken-1, wrong-turn and wrong-response binds, accepts only the intended trusted observation, and denies forged verified retain.',
  );
} finally {
  await owner.from('ai_conversations').delete().eq('id', conversation);
  await owner.auth.signOut();
  await foreign.auth.signOut();
}
