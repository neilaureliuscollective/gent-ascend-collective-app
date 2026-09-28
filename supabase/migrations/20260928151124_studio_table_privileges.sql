-- Supabase's default privileges may grant all table operations to anon and authenticated.
-- Restrict the two new Studio tables after creation; ownership remains enforced by RLS.
revoke all on public.ai_studio_scenes, public.ai_studio_finishes from anon, authenticated;

grant select, delete on public.ai_studio_scenes to authenticated;
grant update(title,message,visual_direction,motion_note,channel,asset_version_id,updated_at)
 on public.ai_studio_scenes to authenticated;

grant select, insert, delete on public.ai_studio_finishes to authenticated;
grant update(format,treatment,brand,headline,supporting,footer,focal_x,focal_y,updated_at)
 on public.ai_studio_finishes to authenticated;
