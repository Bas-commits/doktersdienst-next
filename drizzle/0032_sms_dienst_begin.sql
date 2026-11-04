-- Log of "SMS begin dienst" sends so a scheduled caller does not text the same duty start twice.
-- iddienst is the assigned shift (type 0/5/11) or a later partial accepted overname (type 6).
CREATE TABLE IF NOT EXISTS "sms_dienst_begin" (
  "iddienst" integer PRIMARY KEY NOT NULL,
  "iddeelnemer" integer NOT NULL,
  "nummer" varchar(20) NOT NULL,
  "verstuurd_op" timestamp DEFAULT now() NOT NULL
);
