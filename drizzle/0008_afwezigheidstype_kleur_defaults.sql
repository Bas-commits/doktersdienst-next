UPDATE "afwezigheidstypen"
SET "kleur" = CASE "code"
	WHEN 'vakantie' THEN '#cd1745'
	WHEN 'nascholing' THEN '#4f1b99'
	WHEN 'fte' THEN '#d0bb48'
	WHEN 'compensatie' THEN '#c24613'
	ELSE "kleur"
END
WHERE "code" IN ('vakantie', 'nascholing', 'fte', 'compensatie')
	AND (
		"kleur" IS NULL
		OR "kleur" IN ('#1d4ed8', '#7c3aed', '#047857', '#b45309')
	);
