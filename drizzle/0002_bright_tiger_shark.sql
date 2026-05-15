CREATE SEQUENCE IF NOT EXISTS gesprekken_id_seq;
ALTER SEQUENCE gesprekken_id_seq OWNED BY gesprekken.id;

SELECT setval(
  'gesprekken_id_seq',
  COALESCE((SELECT MAX(id) FROM gesprekken), 0) + 1,
  false
);

ALTER TABLE gesprekken
  ALTER COLUMN id SET DEFAULT nextval('gesprekken_id_seq'::regclass);