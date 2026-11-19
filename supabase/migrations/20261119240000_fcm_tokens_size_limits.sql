-- fcm_tokens: size limits (19/nov/2026, Supabase Free plan, 500 MB).
--
-- /api/fcm-token/save is anonymous and stored token, user_agent and
-- device_info with no size limit. The endpoint now refuses bigger values
-- with 400; the table gets the same limits, so no other path can store
-- them either. Today's maximums: token 36 (a OneSignal subscription id),
-- user_agent 137, device_info 6 ('Mobile' or 'Desktop'), user_email 30.
-- The limits leave room for an FCM token (150 to 200 chars) and long user
-- agents; 254 is the longest valid email address.
set local lock_timeout = '3s';

alter table public.fcm_tokens drop constraint if exists fcm_tokens_tamanhos;
alter table public.fcm_tokens
  add constraint fcm_tokens_tamanhos check (
    length(token) <= 256
    and (user_agent is null or length(user_agent) <= 512)
    and (device_info is null or length(device_info) <= 64)
    and (user_email is null or length(user_email) <= 254)
  ) not valid;
alter table public.fcm_tokens validate constraint fcm_tokens_tamanhos;
