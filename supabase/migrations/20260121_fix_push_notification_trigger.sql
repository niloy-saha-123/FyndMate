-- Fix the push notification trigger to include proper authorization header
-- Run this in your Supabase SQL Editor

-- First, enable the pg_net extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Drop the existing trigger and function
DROP TRIGGER IF EXISTS message_push_trigger ON public."Message";
DROP FUNCTION IF EXISTS public.notify_message_push();

-- Create the updated function with authorization header
CREATE OR REPLACE FUNCTION public.notify_message_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  service_role_key text;
BEGIN
  -- Get the service role key from vault or use environment variable
  -- Note: You should store this in Supabase Vault for production
  -- For now, we're using a direct reference
  
  PERFORM
    net.http_post(
      url := 'https://roiekavirwvgxhnzuoqa.supabase.co/functions/v1/send-message-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := jsonb_build_object('record', row_to_json(NEW))
    );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the insert
    RAISE WARNING 'Push notification failed: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Create the trigger
CREATE TRIGGER message_push_trigger
AFTER INSERT ON public."Message"
FOR EACH ROW
EXECUTE FUNCTION public.notify_message_push();

-- ALTERNATIVE: If you don't want to use app.settings, use this simpler version:
-- This version doesn't require the service role key since the edge function
-- creates its own client with service role

/*
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
*/
