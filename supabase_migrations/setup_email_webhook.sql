-- Enable the pg_net extension to make HTTP requests
CREATE EXTENSION IF NOT EXISTS "pg_net";

-- Create the trigger function
CREATE OR REPLACE FUNCTION public.trigger_order_email()
RETURNS TRIGGER AS $$
DECLARE
  request_id BIGINT;
  payload JSONB;
BEGIN
  -- Construct the payload
  payload = jsonb_build_object(
    'type', TG_OP,
    'table', TG_TABLE_NAME,
    'schema', TG_TABLE_SCHEMA,
    'record', row_to_json(NEW),
    'old_record', CASE WHEN TG_OP = 'UPDATE' THEN row_to_json(OLD) ELSE NULL END
  );

  -- Send the HTTP request to the Edge Function
  -- URL derived from your deployment: https://zeqootmdlfpospbwwzuh.supabase.co/functions/v1/order-email
  SELECT net.http_post(
    url := 'https://zeqootmdlfpospbwwzuh.supabase.co/functions/v1/order-email',
    body := payload,
    headers := '{"Content-Type": "application/json"}'::jsonb
  ) INTO request_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger on online_orders
DROP TRIGGER IF EXISTS on_order_email_trigger ON online_orders;

CREATE TRIGGER on_order_email_trigger
  AFTER INSERT OR UPDATE ON online_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_order_email();

COMMENT ON TRIGGER on_order_email_trigger ON online_orders IS 'Triggers the order-email Edge Function on INSERT or UPDATE';
