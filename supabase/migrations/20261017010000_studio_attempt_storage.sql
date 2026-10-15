-- Attempt-specific render object keys. Finish remains lease/token/expiry fenced.
-- Losing attempts cannot publish or delete a winning attempt's objects.
create or replace function public.ai_studio_render_finish(p_id uuid,p_token uuid,p_film text,p_cover text,p_captions text,p_width integer,p_height integer,p_duration integer)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_uid uuid;
declare v_job public.ai_studio_render_jobs%rowtype;
declare v_prefix text;
begin
 select j.* into v_job from public.ai_studio_render_jobs j
  where j.id=p_id and j.lease_token=p_token and j.status='running' and j.lease_until is not null and j.lease_until>now();
 if not found then raise exception 'Render lease lost'; end if;
 select p.auth_user_id into v_uid from public.persons p where p.id=v_job.person_id;
 v_prefix := v_uid::text || '/' || v_job.project_id::text || '/' || p_id::text || '/' || p_token::text;
 if v_uid is null or
   p_film is distinct from v_prefix || '/film.mp4' or
   p_cover is distinct from v_prefix || '/cover.png' or
   p_captions is distinct from v_prefix || '/captions.vtt'
 then raise exception 'Invalid render storage key'; end if;
 update public.ai_studio_render_jobs j set status='complete',storage_film=p_film,storage_cover=p_cover,storage_captions=p_captions,
  width=p_width,height=p_height,duration_ms=p_duration,lease_token=null,lease_until=null,updated_at=now()
  where j.id=p_id and j.lease_token=p_token and j.status='running' and j.lease_until>now();
 return found;
end $$;
