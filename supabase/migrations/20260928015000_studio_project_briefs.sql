-- Each project carries a small, owner-edited direction that can guide later images.
alter table public.ai_studio_projects
 add column creative_type text not null default 'open' check(creative_type in ('open','brand','campaign','product','personal')),
 add column brief jsonb not null default '{}'::jsonb check(jsonb_typeof(brief)='object');
