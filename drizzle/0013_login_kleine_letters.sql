-- Better Auth zoekt een gebruiker op met email.toLowerCase() en vergelijkt die uitkomst
-- exact met deelnemers.login. Staat er een hoofdletter in de kolom, dan vindt die opzoeking
-- nooit iets: de resetlink verstuurt geen mail en de magische inloglink valt bij het klikken
-- om met new_user_signup_disabled. Inloggen werkt wel, want de hook in auth.ts vergelijkt
-- zelf met LOWER(TRIM(login)). Alleen de kolom kan dit oplossen, want het kleine letters
-- maken gebeurt binnen Better Auth voordat de query wordt gesteld.
--
-- Van de 600 logins met een @ hebben er 89 een hoofdletter. Logins zonder @ blijven staan:
-- dat zijn oude gebruikersnamen als Jan en Annemieke, die geen e-mailadres zijn en dus geen
-- link kunnen aanvragen. Ze staan wel op het scherm bij Beheren deelnemers en in de
-- bevestiging bij verwijderen, waar de schrijfwijze uitmaakt.
--
-- Drie adressen staan twee keer in de tabel, een keer met en een keer zonder hoofdletters
-- (majorie.pieterse, sjef.vrencken en wim.flipse, alle drie @ggdzeeland.nl). Die blijven
-- ongemoeid. Zou je ze kleine letters geven, dan zijn beide rijen identiek en kiest de
-- opzoeking er willekeurig een. Nu wint altijd de rij die al in kleine letters staat, en dat
-- is tenminste voorspelbaar. Het dubbele account zelf is een vraag voor Bart, geen migratie.
UPDATE deelnemers
   SET login = lower(login)
 WHERE login LIKE '%@%'
   AND login <> lower(login)
   AND lower(login) NOT IN (
     SELECT lower(login)
       FROM deelnemers
      WHERE login LIKE '%@%'
      GROUP BY lower(login)
     HAVING count(DISTINCT login) > 1
   );
