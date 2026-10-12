# Health migration reconciliation — release gate

Read-only audit on October 12, 2026 of `volpzkfsnmtztrovexcw` (Gent Ascend App). Production code was Vercel READY at main `c0a7f35`. This document is a mapping and unresolved-gate record, not proof of complete deployed SQL equivalence.

| Source migration | Hosted version/name observed |
|---|---|
| 20260927210000_aethelios_chat_foundation | 20260927213724_aethelios_chat_foundation |
| 20260927220000_aethelios_studio_v1 | 20260927213731_aethelios_studio_v1 |
| 20260928015000_studio_project_briefs | 20260928151010_studio_project_briefs_20260928 |
| 20260928020000_studio_storyboard | 20260928151013_studio_storyboard_20260928 |
| 20260928023000_studio_finishes | 20260928151015_studio_finishes_20260928 |
| 20260928151124_studio_table_privileges | 20260928151234_studio_table_privileges_20260928 |
| 20260926031906_daily_action_completion | 20261002123240_daily_action_completion |
| 20260928021459_ascend_performance_phase_1 | 20261002123252_ascend_performance_phase_1 |
| 20260928145533_ascend_performance_programs | 20261002123253_ascend_performance_programs |
| 20260928151743_ascend_performance_progression | 20261002123255_ascend_performance_progression |
| 20260928203910_ascend_performance_outcomes | 20261002123256_ascend_performance_outcomes |
| 20260928215620_ascend_performance_fuel_body | 20261002123258_ascend_performance_fuel_body |
| 20260928223531_ascend_performance_recovery | 20261002123259_ascend_performance_recovery |
| 20260929083302_ascend_performance_movement | 20261002123306_ascend_performance_movement |
| 20261002123344_restrict_chat_trigger_execution | 20261002123420_restrict_chat_trigger_execution |
| 20261002105745_founding_membership_billing | 20261002124316_founding_membership_billing |
| 20261002141618_ascend_daily_command | 20261004081328_ascend_daily_command |
| 20261004180000_member_product_cabinet | 20261004183555_member_product_cabinet |
| 20261002165518_account_claim | 20261004223608_account_claim |
| 20261004222000_grooming_daily_intelligence | 20261004233827_grooming_daily_intelligence |
| 20261006034533_company_workspaces | 20261006045110_company_workspaces |
| 20261006042134_connected_company_work | 20261006045134_connected_company_work |
| 20261006103930_public_intelligence_missions | 20261006104817_public_intelligence_missions |

Unresolved: hosted `20261004193042_founding_beta_member_entry` and `20261009063400_mission_continuity` need source/statement reconciliation. Source `20261005122500_proactive_signal_receipts` exists but its hosted migration/table were absent from the inspected history/catalog. Do not silently apply these older files or repair history from names alone.

The historical 28-file hash checker remains intact. Existing applied files were not edited. Five Reserve-owned migrations remain untouched. Selected hosted Performance tables had RLS enabled and owner SELECT predicates through `persons.auth_user_id`. No hosted `health_*` tables or Health bucket were found at audit. No personal rows were read.

The new additive Health migration creates only `health_private`, scoped public wrappers and its separate bucket/policies; activation defaults off. Apply on clean local and reconciled protected staging first, with real roles/Auth/Storage. Verify function signatures, pinned search paths, direct-write denial, anonymous/service-role denial, duplicate versions, Storage immutability and recent-auth behavior. Generate Database types from the accepted schema. Before production, resolve the above mismatches and audit shared administrative credentials. Application rollback leaves the private tables intact, disables activation and server flags, and preserves deletion jobs/tombstones; never restore deleted content without replaying tombstones.
