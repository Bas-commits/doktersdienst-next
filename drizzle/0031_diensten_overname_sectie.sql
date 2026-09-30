-- Op welk vak van een dienst een overname slaat: 'top' (achterwacht) of 'bottom' (extra dokter).
-- NULL betekent het middelste vak, de gewone dienst. Dat is wat alle overnames tot nu toe waren,
-- dus bestaande rijen hoeven niet bijgewerkt te worden.
--
-- Nodig omdat een overname-rij (type 4/6 met status) verder niets over het vak zegt: dezelfde arts
-- kan in hetzelfde tijdvak zowel dienst als achterwacht hebben, en iddienstovern is in deze database
-- altijd 0 (diensten hebben geen id), dus via de originele rij is het vak niet af te leiden.
--
-- Nullable zonder default: in Postgres alleen een wijziging van de metadata, geen herschrijving van
-- de tabel. Queries die hun eigen kolommen noemen (Asterisk, de PHP-backend) merken er niets van.
ALTER TABLE "diensten"
  ADD COLUMN IF NOT EXISTS "overname_sectie" varchar(10);
