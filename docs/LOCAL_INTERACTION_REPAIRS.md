# Local interaction repairs — October 13, 2026

Neil approved these three previously diagnosed inherited defects at 06:13:51 UTC. This is a separate functional step on preserved B+ Talk commit `c593defd2f7cc6b19fb12d8fa1aa944e510747b8`; the subsequent Work/Architect visual pass is separately reviewable. No remote publication, database/provider operation or production configuration is authorized.

- Latest message and the existing composer share a relative layout anchor. The jump button sits eight pixels above the actual composer height. The wrapper uses display:contents outside full Talk, retaining compact layout. No new viewport controller, observer, event handler, submit behavior or draft owner is introduced.
- TalkDrawer's queued close event restores focus only if focus has fallen to the body or remains inside the closing drawer. Native invoker restoration remains intact; a newer explicit outside focus target is respected.
- Architect's view-state effect writes only while the current pathname is `/app/architect` and the URL project matches the selected project. A native Back that has already moved to Work cannot receive stale Architect parameters. Session ownership, draft handoff, save receipts and domain services are unchanged.

Seven actual-route regression cases failed against the original optimized c593 build: three short/grown composer viewport cases, the native close/new-focus ordering, and early native Back during restored editor mount at 390/720/1440. The same seven pass against the repaired optimized build. Lint and strict typing pass; the initial new test's tuple typing error was corrected and its failure log retained. Direct webpack production compilation passes. Broader affected suites and full unit checks are recorded with the final combined visual candidate; this does not claim every release gate passed.

Original 69/70 material and 22/23 Architect runs remain historical evidence in Library diagnosis `libfile_294c621af8848191b5b69d2e77008064` and archive `libfile_eb2306593b9c8191b8d20dda86578e37`. Controlled reproductions, source comparisons and original failed traces are preserved. These fixes do not claim to repair every previously observed Architect loading/recovery status issue.

Real local Supabase Auth/PostgREST, hosted auth/storage/provider, physical Fold/iPhone/DeX/native keyboard and hardware performance remain separate acceptance gates. Normal build preflight's missing MediaPipe asset remains unresolved. No denied acquisition or reference-image access is retried. Sanctuary `28e1a04` remains separate, unverified and untouched.
