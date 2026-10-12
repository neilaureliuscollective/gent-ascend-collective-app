-- Read-only catalog verification. No member rows, objects, RPC calls or provider requests.
-- Run on the existing Gent Ascend database. Passing is not live provider or two-account acceptance.
with tables(name) as (values
 ('ai_studio_narrations'), ('ai_studio_narration_usage'),
 ('ai_studio_footage'), ('ai_studio_footage_usage')
), functions(signature) as (values
 ('public.ai_studio_narration_begin(uuid,uuid,text,text,text,text)'),
 ('public.ai_studio_narration_finish(uuid,text,text,double precision)'),
 ('public.ai_studio_footage_quote(uuid,uuid,text,text,integer,text,timestamp with time zone,text)'),
 ('public.ai_studio_footage_begin(uuid)'),
 ('public.ai_studio_footage_receipt(uuid,uuid,text)'),
 ('public.ai_studio_footage_check(uuid)'),
 ('public.ai_studio_footage_finish(uuid,text,text,numeric)')
), owners(table_name,policy_name) as (values
 ('ai_studio_narrations','studio_narrations_owner'),
 ('ai_studio_narration_usage','studio_narration_usage_owner'),
 ('ai_studio_footage','studio_footage_owner'),
 ('ai_studio_footage_usage','studio_footage_usage_owner')
), buckets(id,size,mime,policy_name) as (values
 ('aethelios-studio-audio',3000000::bigint,'audio/wav','studio_audio_objects_owner'),
 ('aethelios-studio-video',30000000::bigint,'video/mp4','studio_video_objects_owner')
), checks as (
 select 'table:' || t.name as name, coalesce(c.relrowsecurity
   and has_table_privilege('authenticated',c.oid,'SELECT')
   and not has_table_privilege('anon',c.oid,'SELECT')
   and not has_table_privilege('authenticated',c.oid,'INSERT')
   and not has_table_privilege('authenticated',c.oid,'UPDATE')
   and not has_table_privilege('authenticated',c.oid,'DELETE'),false) as passed
 from tables t left join pg_class c on c.oid=to_regclass('public.' || t.name)
 union all
 select 'owner-policy:' || o.table_name, coalesce(p.cmd='SELECT'
   and p.roles=array['authenticated']::name[] and p.qual like '%persons.auth_user_id%'
   and p.qual like '%auth.uid()%'
   and p.qual like '%person_id%',false)
 from owners o left join pg_policies p on p.schemaname='public'
   and p.tablename=o.table_name and p.policyname=o.policy_name
 union all
 select 'rpc:' || f.signature, coalesce(p.prosecdef
   and 'search_path=""'=any(p.proconfig)
   and has_function_privilege('authenticated',p.oid,'EXECUTE')
   and not has_function_privilege('anon',p.oid,'EXECUTE'),false)
 from functions f left join pg_proc p on p.oid=to_regprocedure(f.signature)
 union all
 select 'bucket:' || expected.id, coalesce(not b.public
   and b.file_size_limit=expected.size
   and b.allowed_mime_types=array[expected.mime],false)
 from buckets expected left join storage.buckets b on b.id=expected.id
 union all
 select 'storage-policy:' || b.id, coalesce(p.cmd='ALL'
   and p.roles=array['authenticated']::name[]
   and p.qual like '%' || b.id || '%'
   and p.qual like '%storage.foldername(name)%' and p.qual like '%auth.uid()%'
   and p.with_check=p.qual,false)
 from buckets b left join pg_policies p on p.schemaname='storage'
   and p.tablename='objects' and p.policyname=b.policy_name
 union all
 select 'storage-objects-rls',coalesce(c.relrowsecurity,false)
 from (values (1)) singleton(n) left join pg_class c on c.oid=to_regclass('storage.objects')
)
select name,passed from checks order by name;
