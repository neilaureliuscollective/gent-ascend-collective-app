# Grooming Concierge — reconstructed release candidate

On 2026-09-28, four completed Grooming commits existed only in an ephemeral checkout. A prior source push was blocked by automatic review; workspace maintenance subsequently removed that checkout before publication. This commit reconstructs the approved product scope on current canonical `main`, but it is a new implementation rather than byte-for-byte recovery of the lost work. Never describe the missing commits as published or deployed.

## Included

- Member-owned Grooming environment with confirmed profile, goals, versioned rituals, check-ins, products, target/service records, event planning, private progress photos and printable brief.
- Guided front/left/right capture with optional hair view, explicit consent, a qualitative OpenAI assessment, private image storage and deletable scan history. No diagnosis, fabricated score or calibrated change measurement. Server accepts compressed files under 1.2 MB/view; three required views keep the request under the Vercel Function request limit.
- My Look reference edits using the existing OpenAI image infrastructure through a shared transport, six bounded directions, a four-attempt rolling allowance, separate private generated storage, member-selected saved targets and a printable concept brief. Identity preservation is prompt guidance, not a guarantee.
- Aethelios receives only bounded text on relevant grooming questions when personal context is enabled: confirmed preferences, dated rituals/products/services, AI scan summaries and member-saved concept titles. Images and raw provider results are not memory; AI interpretations are not measurements.
- Professional handoff via a member-selected, frozen text snapshot and a one-time 128-bit code. The first signed-in account claiming it gets access for at most seven days; the member can revoke. A professional submits one service proposal; only member acceptance adds it to grooming history. No image access, Reserve staff role/booking integration or professional credential verification.
- Commerce is category discovery, subordinate to owned products and routine needs. It is not an efficacy claim.

## Release order and gates

1. Verify the single new migration (hosted ledger version `20260928152818`) against live schema and shared Supabase ledger. The Supabase project also contains Reserve-owned and more recent Studio migrations, so do not use a broad CLI `db push`.
2. Apply this exact reviewed migration through a controlled Supabase migration operation. Check RLS, private buckets, two real Auth identities, owner and recipient behavior, revocation, and deletion before pushing the application to production.
3. Push tested code onto canonical `main`, verify Vercel production build, route access, image request duration, and device behavior. If any hosted gate fails, leave app code undeployed and report it.
4. Run consented provider/device quality review for lighting, texture variation, identity drift, prompt refusal, cost and latency before a wider launch. PGlite and a build do not prove these qualities.

Current primary source guidance: https://supabase.com/docs/guides/database/postgres/row-level-security and https://supabase.com/docs/guides/storage/security/access-control . OpenAI image generation integration reuses the existing Studio transport. The release candidate preserves member consent and owner-only storage paths; supplier image terms and data controls should be reviewed with actual production traffic.
