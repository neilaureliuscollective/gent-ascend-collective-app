-- Atomic save+freeze of the exact inserted revision, and freeze-by-expected-revision CAS.
-- Replaces latest-by-document freeze so another tab cannot change the exported revision.

drop function if exists public.ai_studio_design_save(uuid,uuid,text,jsonb,timestamptz,integer);
drop function if exists public.ai_studio_design_freeze(uuid);
drop function if exists public.ai_studio_composition_save(uuid,uuid,text,jsonb,timestamptz,integer);
drop function if exists public.ai_studio_composition_freeze(uuid);

create function public.ai_studio_design_save(p_id uuid,p_project uuid,p_title text,p_document jsonb,p_updated timestamptz,p_expected integer,p_freeze boolean default false)
returns table(id uuid,revision integer,updated_at timestamptz,revision_id uuid) language plpgsql security definer set search_path='' as $$
declare v_person uuid; v_now timestamptz := now(); v_revision integer; v_revision_id uuid;
begin
 select public.ai_studio_owner() into v_person;
 if v_person is null or not exists(select 1 from public.ai_studio_projects p where p.id=p_project and p.person_id=v_person and (to_jsonb(p)->>'company_id') is null) then raise exception 'Studio project unavailable'; end if;
 if p_document is null or p_document->>'schema' is distinct from 'studio-design/v1' or pg_column_size(p_document)>524288 then raise exception 'Invalid design document'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v_person::text || p_id::text,811));
 if p_updated is null then
  if (select count(*) from public.ai_studio_designs where person_id=v_person and project_id=p_project)>=20 then raise exception 'Design limit reached'; end if;
  insert into public.ai_studio_designs(id,person_id,project_id,title,document,updated_at) values(p_id,v_person,p_project,p_title,p_document,v_now);
  v_revision := 1;
 else
  update public.ai_studio_designs d set title=p_title,document=p_document,revision=p_expected+1,updated_at=v_now
   where d.id=p_id and d.person_id=v_person and d.project_id=p_project and d.updated_at=p_updated and d.revision=p_expected;
  if not found then raise exception 'DESIGN_CONFLICT'; end if;
  v_revision := p_expected+1;
 end if;
 insert into public.ai_studio_design_revisions(person_id,project_id,design_id,revision,kind,document)
  values(v_person,p_project,p_id,v_revision,case when p_freeze then 'explicit' else 'autosave' end,p_document)
  returning ai_studio_design_revisions.id into v_revision_id;
 return query select p_id,v_revision,v_now,v_revision_id;
end $$;

create function public.ai_studio_design_freeze(p_id uuid,p_expected integer)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_person uuid; v_rev public.ai_studio_design_revisions%rowtype;
begin
 select public.ai_studio_owner() into v_person;
 if v_person is null or p_expected is null or p_expected<1 then raise exception 'Design revision unavailable'; end if;
 update public.ai_studio_design_revisions r set kind='explicit'
  where r.design_id=p_id and r.person_id=v_person and r.revision=p_expected
  returning r.* into v_rev;
 if v_rev.id is null then raise exception 'STALE_DESIGN_REVISION'; end if;
 return v_rev.id;
end $$;

create function public.ai_studio_composition_save(p_id uuid,p_project uuid,p_title text,p_document jsonb,p_updated timestamptz,p_expected integer,p_freeze boolean default false)
returns table(id uuid,revision integer,updated_at timestamptz,revision_id uuid) language plpgsql security definer set search_path='' as $$
declare v_person uuid; v_now timestamptz := now(); v_revision integer; v_revision_id uuid;
begin
 select public.ai_studio_owner() into v_person;
 if v_person is null or not exists(select 1 from public.ai_studio_projects p where p.id=p_project and p.person_id=v_person and (to_jsonb(p)->>'company_id') is null) then raise exception 'Studio project unavailable'; end if;
 if p_document is null or p_document->>'schema' is distinct from 'studio-composition/v1' or pg_column_size(p_document)>262144 then raise exception 'Invalid composition document'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v_person::text || p_id::text,812));
 if p_updated is null then
  if (select count(*) from public.ai_studio_compositions where person_id=v_person and project_id=p_project)>=8 then raise exception 'Composition limit reached'; end if;
  insert into public.ai_studio_compositions(id,person_id,project_id,title,document,updated_at) values(p_id,v_person,p_project,p_title,p_document,v_now);
  v_revision := 1;
 else
  update public.ai_studio_compositions d set title=p_title,document=p_document,revision=p_expected+1,updated_at=v_now
   where d.id=p_id and d.person_id=v_person and d.project_id=p_project and d.updated_at=p_updated and d.revision=p_expected;
  if not found then raise exception 'COMPOSITION_CONFLICT'; end if;
  v_revision := p_expected+1;
 end if;
 insert into public.ai_studio_composition_revisions(person_id,project_id,composition_id,revision,kind,document)
  values(v_person,p_project,p_id,v_revision,case when p_freeze then 'explicit' else 'autosave' end,p_document)
  returning ai_studio_composition_revisions.id into v_revision_id;
 return query select p_id,v_revision,v_now,v_revision_id;
end $$;

create function public.ai_studio_composition_freeze(p_id uuid,p_expected integer)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_person uuid; v_rev public.ai_studio_composition_revisions%rowtype;
begin
 select public.ai_studio_owner() into v_person;
 if v_person is null or p_expected is null or p_expected<1 then raise exception 'Composition revision unavailable'; end if;
 update public.ai_studio_composition_revisions r set kind='explicit'
  where r.composition_id=p_id and r.person_id=v_person and r.revision=p_expected
  returning r.* into v_rev;
 if v_rev.id is null then raise exception 'STALE_COMPOSITION_REVISION'; end if;
 return v_rev.id;
end $$;

revoke all on function public.ai_studio_design_save(uuid,uuid,text,jsonb,timestamptz,integer,boolean),
 public.ai_studio_design_freeze(uuid,integer),public.ai_studio_composition_save(uuid,uuid,text,jsonb,timestamptz,integer,boolean),
 public.ai_studio_composition_freeze(uuid,integer) from public,anon;
grant execute on function public.ai_studio_design_save(uuid,uuid,text,jsonb,timestamptz,integer,boolean),
 public.ai_studio_design_freeze(uuid,integer),public.ai_studio_composition_save(uuid,uuid,text,jsonb,timestamptz,integer,boolean),
 public.ai_studio_composition_freeze(uuid,integer) to authenticated;
