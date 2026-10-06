-- A public Mission is direction attached to an existing private conversation.
-- It grants no AI tools, memory permissions, or execution authority.
create table public.intelligence_missions (
 id uuid primary key,
 person_id uuid not null references public.persons(id) on delete cascade,
 conversation_id uuid not null,
 title text not null check(length(trim(title)) between 1 and 120),
 objective text not null check(length(trim(objective)) between 3 and 2000),
 status text not null default 'draft' check(status in ('draft','active','waiting','needs_review','completed','archived')),
 decisions text not null default '' check(length(decisions)<=4000),
 open_questions text not null default '' check(length(open_questions)<=2000),
 next_actions text not null default '' check(length(next_actions)<=2000),
 revision integer not null default 1 check(revision>0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(person_id,conversation_id),
 foreign key(person_id,conversation_id) references public.ai_conversations(person_id,id) on delete cascade
);
create index intelligence_missions_owner on public.intelligence_missions(person_id,updated_at desc,id desc);
alter table public.intelligence_missions enable row level security;
revoke all on public.intelligence_missions from public, anon, authenticated;
grant select,delete on public.intelligence_missions to authenticated;
grant insert(id,person_id,conversation_id,title,objective,status,decisions,open_questions,next_actions) on public.intelligence_missions to authenticated;
grant update(title,objective,status,decisions,open_questions,next_actions,revision,updated_at) on public.intelligence_missions to authenticated;
create policy intelligence_missions_read on public.intelligence_missions for select to authenticated
 using(person_id in (select id from public.persons where auth_user_id=(select auth.uid())));
create policy intelligence_missions_create on public.intelligence_missions for insert to authenticated
 with check(person_id in (select id from public.persons where auth_user_id=(select auth.uid())) and
 exists(select 1 from public.ai_conversations c where c.person_id=intelligence_missions.person_id and c.id=intelligence_missions.conversation_id and c.company_id is null));
create policy intelligence_missions_update on public.intelligence_missions for update to authenticated
 using(person_id in (select id from public.persons where auth_user_id=(select auth.uid())))
 with check(person_id in (select id from public.persons where auth_user_id=(select auth.uid())));
create policy intelligence_missions_delete on public.intelligence_missions for delete to authenticated
 using(person_id in (select id from public.persons where auth_user_id=(select auth.uid())));
