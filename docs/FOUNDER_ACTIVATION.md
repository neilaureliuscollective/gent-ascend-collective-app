# Gent Ascend founder activation

## Current state

The Gent Ascend Supabase project is `volpzkfsnmtztrovexcw`. It is separate
from the private Aethelios project. On 2026-09-24 it had no Auth users, persons,
memberships, or founder grants. The private Aethelios owner account exists in
its own project; signing in there does not create an account here.

This release reads the person-bound `public.founder_access` grant under the
signed-in user's RLS policy. It unlocks implemented Aethelios, progress and
informational health navigation without a payment or beta flag. It never
authorizes clinical care, access to other people's records, or `/dev` on Vercel.
No browser input, email match, user metadata or tier can assert founder status.

## Hosted migration reconciliation

The two previously hosted schema migrations are recovered in source with their
**exact SQL and hosted version numbers**:

- `20260924150814_202609240005_grooming_foundation.sql`
- `20260924150815_20260924144912_founder_access.sql`

The four earlier hosted migrations also have ledger version numbers that differ
from the original repository filenames. Do not run `supabase db push`, reset,
reapply these files, or repair the production ledger as part of account
activation. Local reset/CI applies the source files in order. Reconcile the
older history in a separate reviewed migration maintenance change before the
next hosted schema update. This release requires no production DDL.

## One-time Auth user step

A trusted Auth administrator creates **one** confirmed email/password user
for `neil.gent.ascend.co@gmail.com` in the Gent Ascend Supabase project. Check
Authentication → Users first. The password is entered in the secure Auth
administration form by its owner and never shared in chat, GitHub, SQL or
Vercel. Do not create a second user if one already exists. Hosted public
signup remains closed. The existing `on_auth_user_created` trigger creates
exactly one `persons` row and free `membership_accounts` row.

The connected database tool can verify and grant access after this step, but
it does not provide an Auth Admin create-user method. Do not synthesize an
Auth user by inserting into `auth.users` with SQL.

## Grant after verifying the account

Run on the **Gent Ascend** project only after Auth creation and email
confirmation. The transaction aborts unless exactly one matching, confirmed
Auth user has the trigger-provisioned person and membership. The trusted
operator grants the founder record; the membership is left at its normal
free tier because founder capabilities are independent of billing.

```sql
begin;
do $$
declare target_person uuid;
declare matching_users integer;
begin
  select count(*), (array_agg(p.id))[1] into matching_users, target_person
  from auth.users u
  join public.persons p on p.auth_user_id = u.id
  join public.membership_accounts m on m.person_id = p.id
  where lower(u.email) = 'neil.gent.ascend.co@gmail.com'
    and u.email_confirmed_at is not null;
  if matching_users <> 1 or target_person is null then
    raise exception 'Expected exactly one confirmed founder account with person and membership';
  end if;
  insert into public.founder_access (person_id, grant_reason)
  values (target_person, 'Verified founder account activation')
  on conflict (person_id) do nothing;
end $$;
commit;
```

This grant is idempotent. Verify one record joins the confirmed Auth user and
founder access. Then sign in at `/you` using the owner's password and confirm
**Founder access verified** appears. Save/reload a profile and goal, use
Aethelios, save/correct one harmless test memory, sign out and test again on
the Fold. A live model reply requires the server's OpenAI key/model access;
successful sign-in alone does not prove it.

## Separate work

The local `/dev` scenario console is intentionally unavailable on hosted
Vercel. A future owner console can offer safe member-journey previews, but it
must never grant clinical care or expose another person's records. Shared
sign-in between Aethelios and Gent Ascend can follow after both independent
accounts and sessions have been tested.
