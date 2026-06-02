CREATE OR REPLACE FUNCTION notify_recent_dienst_insert()
RETURNS trigger AS $$
DECLARE
  today_start timestamp := date_trunc('day', now());
  tomorrow_start timestamp := date_trunc('day', now()) + interval '1 day';
BEGIN
  IF TG_OP = 'INSERT'
     AND NEW.type IN (0, 5, 11, 6)
     AND NEW.van IS NOT NULL
     AND NEW.tot IS NOT NULL
     AND to_timestamp(NEW.van) < tomorrow_start
     AND to_timestamp(NEW.tot) > today_start THEN
    PERFORM pg_notify(
      'hono_task_channel',
      json_build_object(
        'table', TG_TABLE_NAME,
        'action', TG_OP,
        'data', row_to_json(NEW)
      )::text
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER diensten_recent_insert_trigger
AFTER INSERT ON diensten
FOR EACH ROW
EXECUTE FUNCTION notify_recent_dienst_insert();