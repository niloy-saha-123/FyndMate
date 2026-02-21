-- Ensure push notification trigger works when Message is inserted from any source
-- (e.g. Prisma does not set app.settings.service_role_key).
-- The edge function send-message-push uses its own SUPABASE_SERVICE_ROLE_KEY and does not require the request Authorization.

CREATE EXTENSION IF NOT EXISTS pg_net;

DROP TRIGGER IF EXISTS message_push_trigger ON public."Message";
DROP FUNCTION IF EXISTS public.notify_message_push();

CREATE OR REPLACE FUNCTION public.notify_message_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM
    net.http_post(
      url := 'https://roiekavirwvgxhnzuoqa.supabase.co/functions/v1/send-message-push',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := jsonb_build_object('record', row_to_json(NEW))
    );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Push notification failed: %', SQLERRM;
    RETURN NEW;
END;
$$;

CREATE TRIGGER message_push_trigger
AFTER INSERT ON public."Message"
FOR EACH ROW
EXECUTE FUNCTION public.notify_message_push();
