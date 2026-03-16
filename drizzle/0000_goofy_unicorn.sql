-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE "waarneemgroepkentekens" (
	"id" integer,
	"idwaarneemgroep" integer,
	"idkenteken" integer
);
CREATE TABLE "ziekten" (
	"id" integer,
	"type" integer,
	"naam" varchar(50)
);
CREATE TABLE "cal_cteams" (
	"id" integer,
	"naam" varchar(50),
	"idcalamiteit" integer,
	"idlocatie" integer,
	"tijd" integer,
	"meldenbij" varchar(255)
);
CREATE TABLE "locaties_temp" (
	"id" integer,
	"idinstellingtype" integer,
	"idinstelling" integer,
	"idregio" integer,
	"naam" varchar(50),
	"zoeknaam" varchar(50),
	"naamlang" varchar(50),
	"adres" varchar(50),
	"postcode" varchar(10),
	"plaats" varchar(50),
	"telnr" varchar(50),
	"faxnr" varchar(50),
	"email" varchar(50)
);
CREATE TABLE "omschrijvingtelnrs" (
	"id" integer,
	"omschrijving" varchar(30),
	"rowguid" uuid
);
CREATE TABLE "ritten" (
	"id" integer,
	"type" varchar(5),
	"vertype" varchar(50),
	"iddeelnemer" integer,
	"idwaarneemgroep" integer,
	"aanvraagtijd" integer,
	"idaanvrager" integer,
	"aanvragernaam" varchar(255),
	"idaanvragerarts" integer,
	"idfactuur" integer,
	"idstartplaats" integer,
	"idvia" integer,
	"idplaats" integer,
	"idretour" integer,
	"postcodestart" varchar(10),
	"postcodevia" varchar(10),
	"postcodeplaats" varchar(10),
	"postcoderetour" varchar(10),
	"kilometers" integer,
	"kilometersafgesloten" boolean,
	"starttijd" integer,
	"eindtijd" integer,
	"reistijd" integer,
	"idinterneverrekening" integer,
	"idkenteken" integer
);
CREATE TABLE "cal_scenarios" (
	"id" integer,
	"naam" varchar(50),
	"idinstelling" integer,
	"verwijderd" boolean
);
CREATE TABLE "diensten_old" (
	"id" integer,
	"idwaarneemgroep" integer,
	"idpraktijk" integer,
	"van" bigint,
	"tot" bigint,
	"iddeelnemer" integer,
	"rol" integer,
	"iddienstherhalen" integer,
	"idaantekening" integer,
	"iddeelnovern" integer,
	"iddienstovern" integer,
	"type" integer,
	"idshift" integer,
	"idtarief" integer,
	"idkamer" integer,
	"idtelnr" integer,
	"idlocatie" integer,
	"iddeelnemer2" integer,
	"idtaaktype" integer,
	"current_date" date,
	"next_date" date,
	"sender_id" integer,
	"delete_request" integer
);
CREATE TABLE "new_absence" (
	"id" bigint,
	"team" integer,
	"name" varchar(255),
	"request" varchar(255),
	"backgrndcolor" varchar(255),
	"icon" varchar(255),
	"created_at" timestamp,
	"updated_at" timestamp
);
CREATE TABLE "cal_cteamrollen" (
	"id" integer,
	"idcteam" integer,
	"idrol" integer,
	"idlocatie" integer,
	"tijd" integer,
	"meldenbij" varchar(255)
);
CREATE TABLE "veldfilters" (
	"id" integer,
	"rit_aanvraagtijd" boolean,
	"rit_aanvragernaam" boolean,
	"rit_factuur" boolean,
	"rit_startplaats" boolean,
	"rit_via" boolean,
	"rit_retour" boolean,
	"rit_traject" boolean,
	"rit_kilometers" boolean,
	"rit_kmafgesloten" boolean,
	"rit_ggdauto" boolean,
	"rit_eindtijd" boolean,
	"rit_totaaltijd" boolean,
	"rit_reistijd" boolean,
	"rit_idinterneverrekening" boolean,
	"per_bps" boolean,
	"ar_celnummer" boolean,
	"ar_overdracht" boolean,
	"af_behandelendarts1" boolean,
	"af_inf1" boolean,
	"af_inf2" boolean,
	"af_factureren" boolean,
	"af_statistiek" boolean
);
CREATE TABLE "cdr" (
	"id" integer,
	"clid" varchar(255),
	"src" varchar(255),
	"dst" varchar(255),
	"dcontext" varchar(255),
	"channel" varchar(255),
	"dstchannel" varchar(255),
	"lastapp" varchar(255),
	"lastdata" varchar(255),
	"starttime" varchar(255),
	"answertime" varchar(255),
	"endtime" varchar(255),
	"duration" varchar(255),
	"billsec" varchar(255),
	"disposition" varchar(255),
	"amaflags" varchar(255),
	"accountcode" varchar(255),
	"uniqueid" varchar(255),
	"userfield" varchar(255),
	"telsrv_ip" varchar(50)
);
CREATE TABLE "new_functie" (
	"id" bigint,
	"functie" varchar(50),
	"created_at" timestamp,
	"updated_at" timestamp
);
CREATE TABLE "expertises" (
	"id" integer,
	"afkorting" varchar(10),
	"omschrijving" varchar(50),
	"idspecialisme" integer,
	"verwijderd" integer
);
CREATE TABLE "new_urentelling" (
	"id" bigint,
	"team_id" integer,
	"start_date" date,
	"end_date" date,
	"created_at" timestamp,
	"updated_at" timestamp
);
CREATE TABLE "instellingtype" (
	"id" integer,
	"naam" varchar(50),
	"type" integer,
	"rowguid" uuid,
	"plaatsoverlijdenorder" integer,
	"arrestantenorder" integer,
	"schouwingorder" integer,
	"forensischorder" integer,
	"euthanasieorder" integer,
	"uitstelbegravenorder" integer,
	"letselschadeorder" integer,
	"zedendelictorder" integer,
	"overigorder" integer,
	"arrestantenorderfactuur" integer,
	"schouwingorderfactuur" integer,
	"forensischorderfactuur" integer,
	"euthanasieorderfactuur" integer,
	"uitstelbegravenorderfactuur" integer,
	"letselschadeorderfactuur" integer,
	"zedendelictorderfactuur" integer,
	"arrestantenorderplaats" integer,
	"schouwingorderplaats" integer,
	"forensischorderplaats" integer,
	"euthanasieorderplaats" integer,
	"uitstelbegravenorderplaats" integer,
	"letselschadeorderplaats" integer,
	"zedendelictorderplaats" integer
);
CREATE TABLE "medicijnvorm" (
	"id" integer,
	"vorm" varchar(50),
	"hoeveelheid" varchar(50),
	"eenheid" varchar(10),
	"concentratie" varchar(50),
	"eenheidc" varchar(10),
	"opmerking" varchar(255),
	"idmedicijnmerk" integer
);
CREATE TABLE "waarneemgroeplocaties" (
	"id" integer,
	"idlocatie" integer,
	"idwaarneemgroep" integer,
	"rowguid" uuid
);
CREATE TABLE "new_activity" (
	"id" integer,
	"team" integer,
	"expertisecompetences_id" integer,
	"namelong" varchar(25),
	"nameshort" varchar(14),
	"backgrndcolor" varchar(255),
	"icon" varchar(255),
	"created_at" timestamp,
	"updated_at" timestamp
);
CREATE TABLE "migrations" (
	"id" integer,
	"migration" varchar(255),
	"batch" integer
);
CREATE TABLE "cdr_old" (
	"id" integer,
	"call_id" integer,
	"idwaarneemgroep" integer,
	"origination_number" varchar(50),
	"origination_name" varchar(255),
	"called_number" varchar(255),
	"called_name" varchar(255),
	"destination_number" varchar(255),
	"destination_name" varchar(255),
	"start_date" varchar(255),
	"start_time" varchar(255),
	"van" integer,
	"script_connect_date" varchar(255),
	"script_connect_time" varchar(255),
	"delivered_date" varchar(255),
	"delivered_time" varchar(255),
	"connect_date" varchar(255),
	"connect_time" varchar(255),
	"end_date" varchar(255),
	"end_time" varchar(255),
	"tot" integer,
	"currency" varchar(255),
	"costs" varchar(255),
	"state" varchar(255),
	"public_access_prefix" varchar(255),
	"lcrprovider" varchar(255),
	"project_number" varchar(255),
	"aoc" varchar(255),
	"origination_device" varchar(255),
	"destination_device" varchar(255),
	"transferred_by_number" varchar(255),
	"transferred_by_name" varchar(255),
	"transferred_call_id1" varchar(255),
	"transferred_call_id2" varchar(255),
	"transferred_to_call_id" varchar(255),
	"transfer_date" varchar(255),
	"transfer_time" varchar(255),
	"disconnect_reason" varchar(255)
);
CREATE TABLE "cal_afdelingen" (
	"id" integer,
	"naam" varchar(255),
	"idinstelling" integer,
	"verwijderd" boolean
);
CREATE TABLE "plaatsregios" (
	"id" integer,
	"idregio" integer,
	"plaats" varchar(255),
	"gemeente" varchar(255),
	"cbs" boolean
);
CREATE TABLE "new_expertise" (
	"id" bigint,
	"team" integer,
	"expertise_long" varchar(255),
	"expertise_short" varchar(255),
	"created_at" timestamp,
	"updated_at" timestamp
);
CREATE TABLE "new_location" (
	"id" bigint,
	"team" integer,
	"namelong" varchar(25),
	"nameshort" varchar(14),
	"backgrndcolor" varchar(255),
	"created_at" timestamp,
	"updated_at" timestamp
);
CREATE TABLE "cal_teams" (
	"id" integer,
	"naam" varchar(50),
	"idinstelling" integer,
	"verwijderd" boolean
);
CREATE TABLE "schouwing" (
	"id" integer,
	"idverrichting" integer,
	"lijkvinding" boolean,
	"jongerdan28dagen" boolean,
	"gebdatum" varchar(10),
	"gebtijd" varchar(10),
	"overlijdensdatum" varchar(10),
	"overlijdenstijd" varchar(50),
	"vindingdatum" varchar(10),
	"duurzwangerschap" integer,
	"gebgewicht" integer,
	"geblengte" integer,
	"gebgeslacht" boolean,
	"doodsoorzaaktext" varchar(255),
	"complicaties" varchar(300),
	"idplaats" integer,
	"sectie" integer,
	"onderzoekingen" integer,
	"doodsoorzaaktype" integer,
	"ziekte1" varchar(255),
	"ziekte1duur" varchar(20),
	"ziekte2" varchar(255),
	"ziekte2duur" varchar(20),
	"ziekte3" varchar(255),
	"ziekte3duur" varchar(20),
	"ziekte4" varchar(255),
	"ziekte4duur" varchar(20),
	"doodsoorzaak" integer,
	"levensbeeindigendh" integer,
	"omstandigheden" varchar(1024),
	"letsel" varchar(1024),
	"plaatsgebeurtenis" varchar(255)
);
CREATE TABLE "Overig" (
	"id" integer,
	"idverrichting" integer,
	"aantekening" varchar(2048)
);
CREATE TABLE "cal_calamiteiten" (
	"id" integer,
	"datum" integer,
	"idscenario" integer,
	"idlocatie" integer,
	"tijd" integer,
	"meldenbij" varchar(255),
	"afgemeld" boolean,
	"iddeelnemer" integer
);
CREATE TABLE "waarneemgroepmedicijnvormen" (
	"id" integer,
	"idwaarneemgroep" integer,
	"idmedicijnvorm" integer
);
CREATE TABLE "medicijngeneriek" (
	"id" integer,
	"naam" varchar(50),
	"opiaat" boolean
);
CREATE TABLE "diensten" (
	"id" integer,
	"idwaarneemgroep" integer,
	"idpraktijk" integer,
	"van" bigint,
	"tot" bigint,
	"iddeelnemer" integer,
	"rol" integer,
	"iddienstherhalen" integer,
	"idaantekening" integer,
	"iddeelnovern" integer,
	"iddienstovern" integer,
	"type" integer,
	"idshift" integer,
	"idtarief" integer,
	"idkamer" integer,
	"idtelnr" integer,
	"idlocatie" integer,
	"iddeelnemer2" integer,
	"idtaaktype" integer,
	"current_date" date,
	"next_date" date,
	"sender_id" integer,
	"delete_request" integer
);
CREATE TABLE "teo_backup" (
	"first_name" varchar(50),
	"first_md5" varchar(255),
	"zoutje" varchar(32)
);
CREATE TABLE "cal_scenarioafdelingteams" (
	"id" integer,
	"idscenarioafdeling" integer,
	"idteam" integer,
	"aantal" integer,
	"verwijderd" boolean
);
CREATE TABLE "onderzoekingen" (
	"id" integer,
	"type" integer,
	"naam" varchar(50)
);
CREATE TABLE "artsen_temp" (
	"id" integer,
	"naam" varchar(50),
	"voornaam" varchar(50),
	"voorletters" varchar(10),
	"titulatuur" varchar(20),
	"geslacht" boolean,
	"idspecialisme" integer,
	"idlocatie" integer,
	"email" varchar(50),
	"gecontrolleerd" boolean
);
CREATE TABLE "verrekeningen" (
	"id" integer,
	"idwaarneemgroep" integer,
	"verrekening" varchar(50)
);
CREATE TABLE "praktijkdeelnemers" (
	"id" integer,
	"idpraktijk" integer,
	"iddeelnemer" integer,
	"rowguid" uuid
);
CREATE TABLE "medicijnmerk" (
	"id" integer,
	"naam" varchar(50),
	"idfabrikant" integer,
	"idmedicijngeneriek" integer
);
CREATE TABLE "verrichtingstatistieken" (
	"id" integer,
	"idverrichting" integer,
	"idstatistiek" integer
);
CREATE TABLE "specialismen" (
	"id" integer,
	"omschrijving" varchar(40),
	"bigcode" varchar(20),
	"type" integer
);
CREATE TABLE "role" (
	"id" integer,
	"name" varchar(30),
	"absenceplanner" boolean,
	"spreekuren" boolean,
	"absenceplannerdoctor" boolean,
	"countdoctoractivity" boolean,
	"doctorabsence" boolean,
	"capacityplanner" boolean,
	"capacityoverview" boolean
);
CREATE TABLE "deelnemers" (
	"id" integer,
	"idgroep" integer,
	"achternaam" varchar(50),
	"voorletterstussenvoegsel" varchar(50),
	"voornaam" varchar(50),
	"name" varchar(50),
	"initialen" varchar(50),
	"geslacht" boolean,
	"afwijkendefunctie" varchar(50),
	"color" varchar(50),
	"afgemeld" boolean,
	"idlocatie" integer,
	"idspecialisme" integer,
	"idpraktijk" integer,
	"idwaarneemgroep" integer,
	"idlocatienu" integer,
	"huisadrstraatnr" varchar(50),
	"huisadrpostcode" varchar(50),
	"huisadrplaats" varchar(50),
	"huisadrtelnr" varchar(50),
	"huisadrfax" varchar(50),
	"huisemail" varchar(50),
	"login" varchar(50),
	"password1" varchar(50),
	"smscode" varchar(10),
	"smstime" integer,
	"ip" varchar(50),
	"lastactiontime" integer,
	"idrol" integer,
	"abonnementdd" boolean,
	"aboforensys" boolean,
	"abocalamiteiten" boolean,
	"abooutsync" boolean,
	"idsettelnrdienst" integer,
	"followmetelnr" varchar(50),
	"idovergenomendoor" integer,
	"overgenomenvanaf" integer,
	"overgenomentot" integer,
	"reminderpermin" integer,
	"dagbegin" integer,
	"dageind" integer,
	"tarief" integer,
	"roosterpersoonlijk" boolean,
	"dddienstzien" boolean,
	"ddzien" boolean,
	"bezzien" boolean,
	"shiftzien" boolean,
	"vkzien" boolean,
	"przien" boolean,
	"vakzien" boolean,
	"allewgzien" boolean,
	"uitgebreidzoeken" boolean,
	"echtedeelnemer" boolean,
	"printlijst" boolean,
	"printlijstae" boolean,
	"laatstevoorkeur" boolean,
	"outlook" boolean,
	"outlookemail" varchar(50),
	"outlookdate" varchar(30),
	"rowguid" uuid,
	"smsdienstbegin" boolean,
	"eigentelwelkomwav" boolean,
	"gespreksopname" boolean,
	"subtakenzien" boolean,
	"spreekurenzien" boolean,
	"fellow" boolean,
	"is_voicemail_doorschakeling" boolean,
	"encrypted_password" varchar(32),
	"password" varchar(255),
	"email" varchar(50),
	"will_be_scheduled" boolean,
	"call_recording" boolean,
	"own_observation_message" boolean,
	"mijn_expertises" varchar(500),
	"is_forgot_password" varchar(500)
);
CREATE TABLE "groepen" (
	"id" integer,
	"naam" varchar(30),
	"deelnemertoev" boolean,
	"deelnemerwijz" boolean,
	"deelnemerverw" boolean,
	"deelnemerlocatienuwijz" boolean,
	"waarneemgroeptoev" boolean,
	"waarneemgroepwijz" boolean,
	"waarneemgroepverw" boolean,
	"specialismen" boolean,
	"regios" boolean,
	"artsen" boolean,
	"instellingen" boolean,
	"locaties" boolean,
	"omschrijvingtelnrstoev" boolean,
	"omschrijvingtelnrswijz" boolean,
	"omschrijvingtelnrsverw" boolean,
	"settelnrstoev" boolean,
	"settelnrswijz" boolean,
	"settelnrsverw" boolean,
	"dienst" boolean,
	"diensttoev" boolean,
	"dienstwijz" boolean,
	"dienstverw" boolean,
	"dienstruil" boolean,
	"dienstalleeneigen" boolean,
	"dienstbinnenwg" boolean,
	"shift" boolean,
	"voorkeur" boolean,
	"groeptoev" boolean,
	"groepwijz" boolean,
	"groepverw" boolean,
	"telefoonovernemen" boolean,
	"tarieven" boolean,
	"facturering" boolean,
	"vakanties" boolean,
	"calamiteiten" boolean,
	"maatschapplanner" boolean
);
CREATE TABLE "new_dagdelen" (
	"id" bigint,
	"daypart_with_date" varchar(255),
	"doctor" integer,
	"team" integer,
	"maandag" varchar(50),
	"dinsdag" varchar(50),
	"woensdag" varchar(50),
	"donderdag" varchar(50),
	"vrijdag" varchar(50),
	"zaterdag" varchar(50),
	"zondag" varchar(50),
	"created_at" timestamp,
	"updated_at" timestamp
);
CREATE TABLE "formmails" (
	"id" integer,
	"idverrichting" integer,
	"formname" varchar(50),
	"aan" varchar(255),
	"onderwerp" varchar(255),
	"tekst" text,
	"datum" integer
);
CREATE TABLE "forensisch" (
	"id" integer,
	"idverrichting" integer,
	"dna_wang" boolean,
	"dna_bloed" boolean,
	"urine" boolean,
	"bloed" boolean,
	"zedenonderzoek" boolean,
	"letselbeschrijving" boolean,
	"fittofly" boolean,
	"overig" boolean,
	"kindermishandeling" boolean,
	"inwinnen" boolean,
	"opmerkingen" varchar(2048)
);
CREATE TABLE "kamers" (
	"id" integer,
	"iddeelnemer" integer,
	"idaantekening" integer,
	"idpraktijk" integer,
	"kamer" varchar(50)
);
CREATE TABLE "protocolblokken" (
	"id" integer,
	"idprotocol" integer,
	"naam" varchar(255),
	"filename" varchar(255),
	"type" varchar(20)
);
CREATE TABLE "sessionHashes" (
	"user_id" integer,
	"hash" integer,
	"aanmaakdatum" date
);
CREATE TABLE "personen" (
	"id" integer,
	"naam" varchar(50),
	"voornaam" varchar(50),
	"geslacht" boolean,
	"gebplaats" varchar(50),
	"gebdatum" varchar(50),
	"nationaliteit" varchar(50),
	"notitie" text
);
CREATE TABLE "oauth_clients" (
	"id" bigint,
	"user_id" bigint,
	"name" varchar(255),
	"secret" varchar(100),
	"provider" varchar(255),
	"redirect" text,
	"personal_access_client" boolean,
	"password_client" boolean,
	"revoked" boolean,
	"created_at" timestamp,
	"updated_at" timestamp
);
CREATE TABLE "deelnemers_backup" (
	"id" integer,
	"idgroep" integer,
	"achternaam" varchar(50),
	"voorletterstussenvoegsel" varchar(50),
	"voornaam" varchar(50),
	"initialen" varchar(50),
	"geslacht" boolean,
	"afwijkendefunctie" varchar(50),
	"color" varchar(50),
	"afgemeld" boolean,
	"idlocatie" integer,
	"idspecialisme" integer,
	"idpraktijk" integer,
	"idwaarneemgroep" integer,
	"idlocatienu" integer,
	"huisadrstraatnr" varchar(50),
	"huisadrpostcode" varchar(50),
	"huisadrplaats" varchar(50),
	"huisadrtelnr" varchar(50),
	"huisadrfax" varchar(50),
	"huisemail" varchar(50),
	"login" varchar(50),
	"password" varchar(50),
	"smscode" varchar(10),
	"smstime" integer,
	"ip" varchar(50),
	"lastactiontime" integer,
	"idrol" integer,
	"abonnementdd" boolean,
	"aboforensys" boolean,
	"abocalamiteiten" boolean,
	"abooutsync" boolean,
	"idsettelnrdienst" integer,
	"followmetelnr" varchar(50),
	"idovergenomendoor" integer,
	"overgenomenvanaf" integer,
	"overgenomentot" integer,
	"reminderpermin" integer,
	"dagbegin" integer,
	"dageind" integer,
	"tarief" integer,
	"roosterpersoonlijk" boolean,
	"dddienstzien" boolean,
	"ddzien" boolean,
	"bezzien" boolean,
	"shiftzien" boolean,
	"vkzien" boolean,
	"przien" boolean,
	"vakzien" boolean,
	"allewgzien" boolean,
	"uitgebreidzoeken" boolean,
	"echtedeelnemer" boolean,
	"printlijst" boolean,
	"printlijstae" boolean,
	"laatstevoorkeur" boolean,
	"outlook" boolean,
	"outlookemail" varchar(50),
	"outlookdate" varchar(30),
	"rowguid" uuid,
	"smsdienstbegin" boolean,
	"eigentelwelkomwav" boolean,
	"gespreksopname" boolean,
	"subtakenzien" boolean,
	"spreekurenzien" boolean,
	"fellow" boolean,
	"is_voicemail_doorschakeling" boolean,
	"encrypted_password" varchar(32)
);
CREATE TABLE "visitor" (
	"id" integer,
	"datetime" integer,
	"user_agent" varchar(255),
	"remote_addr" varchar(255),
	"forwarded_for" varchar(255),
	"layout" varchar(10)
);
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE "arrestanten" (
	"id" integer,
	"idverrichting" integer,
	"naamverzorger" varchar(255),
	"celnummer" varchar(10),
	"vragenverzorger" varchar(255),
	"instructiesverzorger" varchar(255),
	"subjectief" text,
	"objectief" text,
	"evaluatie" text,
	"plan" text,
	"medicatie" text,
	"recept" text,
	"insluiting" boolean,
	"wekadvies" boolean,
	"overdracht" boolean,
	"camera" boolean,
	"wekadviesuur" double precision
);
CREATE TABLE "diensten_new_old" (
	"id" integer,
	"idwaarneemgroep" integer,
	"idpraktijk" integer,
	"van" bigint,
	"tot" bigint,
	"iddeelnemer" integer,
	"rol" integer,
	"iddienstherhalen" integer,
	"idaantekening" integer,
	"iddeelnovern" integer,
	"iddienstovern" integer,
	"type" integer,
	"idshift" integer,
	"idtarief" integer,
	"idkamer" integer,
	"idtelnr" integer,
	"idlocatie" integer,
	"iddeelnemer2" integer,
	"idtaaktype" integer,
	"current_date" date,
	"next_date" date,
	"sender_id" integer,
	"delete_request" integer
);
CREATE TABLE "dienstherhalen" (
	"id" integer,
	"weken" integer,
	"startdatum" integer,
	"einddatum" integer
);
CREATE TABLE "kentekens" (
	"id" integer,
	"kenteken" varchar(10),
	"iddeelnemer" integer
);
CREATE TABLE "dienstaantekening" (
	"id" integer,
	"tekst" varchar(25),
	"afwezig" boolean,
	"iddeelnemer" integer,
	"idwaarneemgroep" integer,
	"verwijderd" boolean,
	"prio" integer,
	"idtarief_default" integer
);
CREATE TABLE "gesprekken" (
	"id" integer,
	"vannummer" varchar(20),
	"onsnummer" varchar(20),
	"naarnummer" varchar(20),
	"idwaarneemgroep" integer,
	"iddeelnemer" integer,
	"van" integer,
	"tot" integer,
	"recording_filename" varchar(255),
	"telsrv" varchar(50),
	"recording_show" integer
);
CREATE TABLE "deelnemerexpertises" (
	"id" integer,
	"iddeelnemer" integer,
	"idexpertise" integer
);
CREATE TABLE "kamertelnrs" (
	"id" integer,
	"idpraktijk" integer,
	"idkamer" integer,
	"telnr" varchar(50)
);
CREATE TABLE "praktijken" (
	"id" integer,
	"naam" varchar(50),
	"idspecialisme" integer,
	"email" varchar(50),
	"password" varchar(16),
	"straatnr" varchar(30),
	"postcode" varchar(7),
	"plaats" varchar(50),
	"telnr" varchar(20),
	"dagbegin" integer,
	"dageind" integer,
	"eigenrooster" boolean,
	"idsecretaris" integer,
	"rowguid" uuid
);
CREATE TABLE "pagehit" (
	"id" integer,
	"datetime" integer,
	"visitor" integer,
	"useraccount" integer,
	"request_method" varchar(5),
	"query_string" varchar(255),
	"pageid" integer,
	"pagename" varchar(50),
	"refererid" integer,
	"referername" varchar(50)
);
CREATE TABLE "locaties" (
	"id" integer,
	"idinstellingtype" integer,
	"idinstelling" integer,
	"idregio" integer,
	"naam" varchar(255),
	"zoeknaam" varchar(255),
	"naamlang" varchar(255),
	"adres" varchar(255),
	"postcode" varchar(10),
	"plaats" varchar(255),
	"telnr" varchar(50),
	"faxnr" varchar(50),
	"email" varchar(255),
	"verwijderd" integer,
	"rowguid" uuid,
	"kleur" varchar(50),
	"afkorting" varchar(50)
);
CREATE TABLE "new_fte" (
	"id" bigint,
	"team_id" integer,
	"doctor_id" integer,
	"fte_dd" double precision,
	"fte_dd_date" date,
	"created_at" timestamp,
	"updated_at" timestamp
);
CREATE TABLE "cbspg" (
	"plaats" varchar(255),
	"gemeente" varchar(255)
);
CREATE TABLE "oauth_personal_access_clients" (
	"id" bigint,
	"client_id" bigint,
	"created_at" timestamp,
	"updated_at" timestamp
);
CREATE TABLE "vakantieregios" (
	"id" integer,
	"naam" varchar(50)
);
CREATE TABLE "cal_teamrollen" (
	"id" integer,
	"idteam" integer,
	"idrol" integer,
	"aantal" integer,
	"verwijderd" boolean
);
CREATE TABLE "instellingen" (
	"id" integer,
	"idinstellingtype" integer,
	"naam" varchar(50),
	"naamlang" varchar(255),
	"url" varchar(40),
	"telnr" varchar(20),
	"idhoofdlocatie" integer,
	"rowguid" uuid
);
CREATE TABLE "artsen" (
	"id" integer,
	"naam" varchar(50),
	"voornaam" varchar(50),
	"voorletters" varchar(10),
	"titulatuur" varchar(20),
	"geslacht" boolean,
	"idspecialisme" integer,
	"idlocatie" integer,
	"gecontrolleerd" boolean,
	"email" varchar(50),
	"rowguid" uuid
);
CREATE TABLE "persoonadressen" (
	"id" integer,
	"adres" varchar(50),
	"postcode" varchar(50),
	"plaats" varchar(50),
	"telnr" varchar(20),
	"idverzekeraar" integer,
	"polisnummer" varchar(50)
);
CREATE TABLE "icdgroepen" (
	"id" integer,
	"code" varchar(50),
	"naam" varchar(255)
);
CREATE TABLE "regios" (
	"id" integer,
	"naam" varchar(40),
	"rowguid" uuid
);
CREATE TABLE "deviceTokens" (
	"user_id" integer,
	"device_token" varchar(255)
);
CREATE TABLE "statistieken" (
	"id" integer,
	"type" varchar(50),
	"naam" varchar(255)
);
CREATE TABLE "tarieven" (
	"id" integer,
	"idtariefregel" integer,
	"euros" double precision,
	"vantijd" integer,
	"vandag" integer,
	"tottijd" integer,
	"totdag" integer,
	"pm" boolean
);
CREATE TABLE "waarneemgroepvakantieregios" (
	"id" integer,
	"idwaarneemgroep" integer,
	"idvakantieregio" integer
);
CREATE TABLE "protocollen" (
	"id" integer,
	"iddeelnemer" integer,
	"versie" integer,
	"naam" varchar(255),
	"datum" integer
);
CREATE TABLE "taaktypen" (
	"id" integer,
	"idwaarneemgroep" integer,
	"afkorting" varchar(10),
	"omschrijving" varchar(50),
	"min_dagdelen_per_week" integer,
	"belasting" integer,
	"idexpertise" integer,
	"iddefaultlocatie" integer,
	"idgekoppeldetaaktype" integer,
	"deelnemer2mogelijk" boolean,
	"defaultplanningseenheid" integer,
	"verwijderd" integer,
	"kleur" varchar(50),
	"volgorde" integer,
	"type" integer,
	"niet_locatie_gebonden" boolean
);
CREATE TABLE "uitvaart_limburg" (
	"naam" varchar(255),
	"type" varchar(255),
	"adres" varchar(255),
	"postcode" varchar(255),
	"plaats" varchar(255),
	"f6" varchar(255)
);
CREATE TABLE "waarneemgroepprotocollen" (
	"id" integer,
	"idwaarneemgroep" integer,
	"idprotocol" integer,
	"rowguid" uuid
);
CREATE TABLE "syncqueries" (
	"id" integer,
	"type" varchar(50),
	"target" varchar(50),
	"author" varchar(50),
	"query" text,
	"status" integer,
	"utime" integer,
	"iddeelnemer" integer,
	"qid" integer,
	"oid" integer
);
CREATE TABLE "waarneemgroepdeelnemers" (
	"id" integer,
	"iddeelnemer" integer,
	"idwaarneemgroep" integer,
	"idgroep" integer,
	"aangemeld" boolean,
	"fte_dd" varchar(50),
	"per_dd" varchar(50),
	"fte_pp" varchar(50),
	"per_pp" varchar(50),
	"dokterdienst" varchar(50),
	"dokterdienst_entry_date" varchar(50),
	"dokterdienst_stop_date" varchar(50),
	"practice_scheduler" varchar(50),
	"practice_scheduler_entry_date" varchar(50),
	"practice_scheduler_stop_date" varchar(50),
	"idfunctie" integer
);
CREATE TABLE "cal_oproepen" (
	"id" integer,
	"idcalamiteit" integer,
	"idafdeling" integer,
	"idteam" integer,
	"teamvolgnr" varchar(2),
	"idrol" integer,
	"rolvolgnr" varchar(2),
	"iddeelnemer" integer,
	"smsstatus" integer,
	"smstijdverzonden" integer,
	"smstijdontvangen" integer,
	"telstatus" integer,
	"teltijd" integer,
	"vervangen" boolean,
	"afgezegdtijd" integer,
	"idmeldenbijafdeling" integer,
	"idmeldenbijteam" integer,
	"idmeldenbijrol" integer
);
CREATE TABLE "tariefregels" (
	"id" integer,
	"factuur" integer,
	"idwaarneemgroep" integer,
	"iddeelnemer" integer,
	"idlocatie" integer,
	"type1" varchar(50),
	"type2" varchar(50),
	"tijdtariefbepaling" varchar(50),
	"idactiviteit" integer,
	"km1" integer,
	"km2" integer,
	"bonus" boolean,
	"specificiteit" integer
);
CREATE TABLE "verrichtingactiviteiten" (
	"id" integer,
	"idverrichting" integer,
	"idactiviteit" integer
);
CREATE TABLE "vakanties" (
	"id" integer,
	"idvakantieregio" integer,
	"naam" varchar(255),
	"van" integer,
	"tot" integer,
	"type" integer
);
CREATE TABLE "new_expertisecompetenie" (
	"id" bigint,
	"team" integer,
	"expertise" varchar(50),
	"afkorting" varchar(50),
	"created_at" timestamp,
	"updated_at" timestamp
);
CREATE TABLE "waarneemgroepen" (
	"id" integer,
	"naam" varchar(50),
	"idspecialisme" integer,
	"idregio" integer,
	"idinstelling" integer,
	"idlocatie" integer,
	"telnringaand" varchar(50),
	"telnrnietopgenomen" varchar(50),
	"telnronzecentrale" varchar(50),
	"telnronzecentrale2" varchar(50),
	"telnrconference" varchar(50),
	"idfacturering" integer,
	"iddeelnemersecr" integer,
	"urentellingvan" integer,
	"urentellingtot" integer,
	"idinvoegendewaarneemgroep" integer,
	"regiobeschrijving" varchar(1024),
	"veldfilters" integer,
	"veldfilterssecr" integer,
	"afgemeld" boolean,
	"recordabo" boolean,
	"ccemail" varchar(50),
	"email" varchar(50),
	"smsdienstbegin" boolean,
	"idliason1" integer,
	"idliason2" integer,
	"idliason3" integer,
	"idliason4" integer,
	"idcoordinatorwaarneemgroep" integer,
	"crisispinliason" varchar(50),
	"crisispindeelnemer" varchar(50),
	"crisispintime" integer,
	"eigentelwelkomwav" boolean,
	"abomaatschapplanner" boolean,
	"gebruikt_voicemail" boolean,
	"gespreksopname" integer
);
CREATE TABLE "verrichtingmedicijnen" (
	"id" integer,
	"idmedicijnvorm" integer,
	"idverrichting" integer,
	"naarrecept" varchar(50),
	"tijd1" integer,
	"tijd2" integer,
	"tijd3" integer,
	"tijd4" integer,
	"dosering1" varchar(10),
	"dosering2" varchar(10),
	"dosering3" varchar(10),
	"dosering4" varchar(10),
	"van" integer,
	"tot" integer,
	"opmerking" varchar(2048)
);
CREATE TABLE "cal_scenarioafdelingen" (
	"id" integer,
	"idscenario" integer,
	"idafdeling" integer,
	"verwijderd" boolean
);
CREATE TABLE "sms" (
	"id" integer,
	"iddeelnemer" integer,
	"idwaarneemgroep" integer,
	"nummer" varchar(20),
	"van" integer,
	"newid" integer
);
CREATE TABLE "new_chipsdaypart" (
	"id" bigint,
	"date" timestamp,
	"daypart_with_date" varchar(255),
	"doctor" integer,
	"team" integer,
	"created_at" timestamp,
	"updated_at" timestamp,
	"grabsence" integer,
	"grlocation" integer,
	"gractivity" integer,
	"grspec" integer,
	"grtask1" integer,
	"grtask2" integer,
	"grtask3" integer,
	"repetition" integer,
	"fte" integer,
	"last_updated_userid" integer,
	"tplocation" integer,
	"tpactivity" integer,
	"tpspec" integer,
	"tptask1" integer,
	"tptask2" integer,
	"tptask3" integer,
	"tpabsence" integer,
	"tplastedited" timestamp,
	"tplastdateedited" integer
);
CREATE TABLE "gemeentearrondissement" (
	"id" integer,
	"gemeente" varchar(255),
	"arrondissement" varchar(255)
);
CREATE TABLE "nhnplaatsgemeente" (
	"id" integer,
	"gemeente" varchar(255),
	"plaats" varchar(255)
);
CREATE TABLE "settelnrs" (
	"id" integer,
	"telnr1" varchar(20),
	"idlocatietelnr1" integer,
	"idomschrtelnr1" integer,
	"smsontvanger1" boolean,
	"telnr2" varchar(20),
	"idlocatietelnr2" integer,
	"idomschrtelnr2" integer,
	"smsontvanger2" boolean,
	"telnr3" varchar(20),
	"idlocatietelnr3" integer,
	"idomschrtelnr3" integer,
	"smsontvanger3" boolean,
	"telnr4" varchar(20),
	"idlocatietelnr4" integer,
	"idomschrtelnr4" integer,
	"smsontvanger4" boolean,
	"telnr5" varchar(20),
	"idlocatietelnr5" integer,
	"idomschrtelnr5" integer,
	"smsontvanger5" boolean,
	"rowguid" uuid,
	"laatstopgenomen" integer
);
CREATE TABLE "verzekeraars" (
	"id" integer,
	"naam" varchar(255)
);
CREATE TABLE "nhnlocaties" (
	"id" integer,
	"naam" varchar(255),
	"adres" varchar(255),
	"postcode" varchar(255),
	"plaats" varchar(255),
	"type" varchar(255)
);
CREATE TABLE "verrichtingicdsubgroepen" (
	"id" integer,
	"idverrichting" integer,
	"idicdsubgroep" integer,
	"type" varchar(50)
);
CREATE TABLE "rollen" (
	"id" integer,
	"idspecialisme" integer,
	"naam" varchar(255),
	"rowguid" uuid
);
CREATE TABLE "teo" (
	"first_name" varchar(51),
	"first_md5" varchar(255),
	"zoutje" varchar(32)
);
CREATE TABLE "verrichtingen" (
	"id" integer,
	"idrit" integer,
	"idpersoon" integer,
	"idpersoonadres" integer,
	"doorgehaald" boolean,
	"adrestype" boolean,
	"type" varchar(20),
	"clienttype" integer,
	"bps" varchar(20),
	"opgemaaktals" integer,
	"idinf1" integer,
	"idinf2" integer,
	"idbehandelendarts" integer,
	"mapnaam" varchar(50),
	"dokterklaar" boolean,
	"secklaar" boolean,
	"nummer" varchar(20),
	"factuurklaar" boolean,
	"factuurklaardate" integer,
	"declaratieklaar" boolean,
	"declaratieklaardate" integer,
	"duur" integer,
	"duurauto" boolean,
	"printletter" varchar(5)
);
CREATE TABLE "activiteiten" (
	"id" integer,
	"type" varchar(20),
	"naam" varchar(255)
);
CREATE TABLE "icdsubgroepen" (
	"id" integer,
	"idgroep" integer,
	"code" varchar(50),
	"naam" varchar(255)
);
CREATE TABLE "new_users" (
	"id" bigint,
	"name" varchar(255),
	"email" varchar(255),
	"email_verified_at" timestamp,
	"password" varchar(255),
	"is_day_night" varchar(100),
	"remember_token" varchar(100),
	"created_at" timestamp,
	"updated_at" timestamp
);
CREATE TABLE "oauth_access_tokens" (
	"id" varchar(100),
	"user_id" bigint,
	"client_id" bigint,
	"name" varchar(255),
	"scopes" text,
	"revoked" boolean,
	"created_at" timestamp,
	"updated_at" timestamp,
	"expires_at" timestamp
);
CREATE TABLE "cal_meldenbij" (
	"id" integer,
	"idlocatie" integer,
	"tijd" integer,
	"meldenbij" varchar(255)
);
CREATE TABLE "new_task" (
	"id" bigint,
	"team" integer,
	"expertisecompetences_id" integer,
	"tasklong" varchar(25),
	"taskshort" varchar(14),
	"backgrndcolor" varchar(255),
	"created_at" timestamp,
	"updated_at" timestamp
);
CREATE TABLE "new_specification_activity" (
	"id" bigint,
	"team" integer,
	"activity" integer,
	"speclong" varchar(25),
	"specshort" varchar(5),
	"created_at" timestamp,
	"updated_at" timestamp
);
CREATE TABLE "voicemails" (
	"id" integer,
	"idwaarneemgroep" integer,
	"datetime" varchar(50),
	"status" varchar(50),
	"ontvangen_timestamp" integer,
	"afgeluisterd_timestamp" integer,
	"afgehandeld_timestamp" integer
);
CREATE TABLE "cbsga" (
	"gemeente" varchar(255),
	"arrondissement" varchar(255)
);
CREATE TABLE "ddtarieven" (
	"id" integer,
	"idwaarneemgroep" integer,
	"omschrijving" varchar(50),
	"inteuros" integer,
	"intpercentage" integer
);
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier" text_ops);
*/