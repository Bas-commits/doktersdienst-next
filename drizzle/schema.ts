import { pgTable, integer, varchar, uuid, boolean, bigint, date, timestamp, text, index, doublePrecision } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



// export const waarneemgroepkentekens = pgTable("waarneemgroepkentekens", {
// 	id: integer(),
// 	idwaarneemgroep: integer(),
// 	idkenteken: integer(),
// });

// export const ziekten = pgTable("ziekten", {
// 	id: integer(),
// 	type: integer(),
// 	naam: varchar({ length: 50 }),
// });

// export const calCteams = pgTable("cal_cteams", {
// 	id: integer(),
// 	naam: varchar({ length: 50 }),
// 	idcalamiteit: integer(),
// 	idlocatie: integer(),
// 	tijd: integer(),
// 	meldenbij: varchar({ length: 255 }),
// });

// export const locatiesTemp = pgTable("locaties_temp", {
// 	id: integer(),
// 	idinstellingtype: integer(),
// 	idinstelling: integer(),
// 	idregio: integer(),
// 	naam: varchar({ length: 50 }),
// 	zoeknaam: varchar({ length: 50 }),
// 	naamlang: varchar({ length: 50 }),
// 	adres: varchar({ length: 50 }),
// 	postcode: varchar({ length: 10 }),
// 	plaats: varchar({ length: 50 }),
// 	telnr: varchar({ length: 50 }),
// 	faxnr: varchar({ length: 50 }),
// 	email: varchar({ length: 50 }),
// });

// export const omschrijvingtelnrs = pgTable("omschrijvingtelnrs", {
// 	id: integer(),
// 	omschrijving: varchar({ length: 30 }),
// 	rowguid: uuid(),
// });

// export const ritten = pgTable("ritten", {
// 	id: integer(),
// 	type: varchar({ length: 5 }),
// 	vertype: varchar({ length: 50 }),
// 	iddeelnemer: integer(),
// 	idwaarneemgroep: integer(),
// 	aanvraagtijd: integer(),
// 	idaanvrager: integer(),
// 	aanvragernaam: varchar({ length: 255 }),
// 	idaanvragerarts: integer(),
// 	idfactuur: integer(),
// 	idstartplaats: integer(),
// 	idvia: integer(),
// 	idplaats: integer(),
// 	idretour: integer(),
// 	postcodestart: varchar({ length: 10 }),
// 	postcodevia: varchar({ length: 10 }),
// 	postcodeplaats: varchar({ length: 10 }),
// 	postcoderetour: varchar({ length: 10 }),
// 	kilometers: integer(),
// 	kilometersafgesloten: boolean(),
// 	starttijd: integer(),
// 	eindtijd: integer(),
// 	reistijd: integer(),
// 	idinterneverrekening: integer(),
// 	idkenteken: integer(),
// });

// export const calScenarios = pgTable("cal_scenarios", {
// 	id: integer(),
// 	naam: varchar({ length: 50 }),
// 	idinstelling: integer(),
// 	verwijderd: boolean(),
// });

// export const dienstenOld = pgTable("diensten_old", {
// 	id: integer(),
// 	idwaarneemgroep: integer(),
// 	idpraktijk: integer(),
// 	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
// 	van: bigint({ mode: "number" }),
// 	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
// 	tot: bigint({ mode: "number" }),
// 	iddeelnemer: integer(),
// 	rol: integer(),
// 	iddienstherhalen: integer(),
// 	idaantekening: integer(),
// 	iddeelnovern: integer(),
// 	iddienstovern: integer(),
// 	type: integer(),
// 	idshift: integer(),
// 	idtarief: integer(),
// 	idkamer: integer(),
// 	idtelnr: integer(),
// 	idlocatie: integer(),
// 	iddeelnemer2: integer(),
// 	idtaaktype: integer(),
// 	currentDate: date("current_date"),
// 	nextDate: date("next_date"),
// 	senderId: integer("sender_id"),
// 	deleteRequest: integer("delete_request"),
// });

// export const newAbsence = pgTable("new_absence", {
// 	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
// 	id: bigint({ mode: "number" }),
// 	team: integer(),
// 	name: varchar({ length: 255 }),
// 	request: varchar({ length: 255 }),
// 	backgrndcolor: varchar({ length: 255 }),
// 	icon: varchar({ length: 255 }),
// 	createdAt: timestamp("created_at", { mode: 'string' }),
// 	updatedAt: timestamp("updated_at", { mode: 'string' }),
// });

// export const calCteamrollen = pgTable("cal_cteamrollen", {
// 	id: integer(),
// 	idcteam: integer(),
// 	idrol: integer(),
// 	idlocatie: integer(),
// 	tijd: integer(),
// 	meldenbij: varchar({ length: 255 }),
// });

// export const veldfilters = pgTable("veldfilters", {
// 	id: integer(),
// 	ritAanvraagtijd: boolean("rit_aanvraagtijd"),
// 	ritAanvragernaam: boolean("rit_aanvragernaam"),
// 	ritFactuur: boolean("rit_factuur"),
// 	ritStartplaats: boolean("rit_startplaats"),
// 	ritVia: boolean("rit_via"),
// 	ritRetour: boolean("rit_retour"),
// 	ritTraject: boolean("rit_traject"),
// 	ritKilometers: boolean("rit_kilometers"),
// 	ritKmafgesloten: boolean("rit_kmafgesloten"),
// 	ritGgdauto: boolean("rit_ggdauto"),
// 	ritEindtijd: boolean("rit_eindtijd"),
// 	ritTotaaltijd: boolean("rit_totaaltijd"),
// 	ritReistijd: boolean("rit_reistijd"),
// 	ritIdinterneverrekening: boolean("rit_idinterneverrekening"),
// 	perBps: boolean("per_bps"),
// 	arCelnummer: boolean("ar_celnummer"),
// 	arOverdracht: boolean("ar_overdracht"),
// 	afBehandelendarts1: boolean("af_behandelendarts1"),
// 	afInf1: boolean("af_inf1"),
// 	afInf2: boolean("af_inf2"),
// 	afFactureren: boolean("af_factureren"),
// 	afStatistiek: boolean("af_statistiek"),
// });

// export const cdr = pgTable("cdr", {
// 	id: integer(),
// 	clid: varchar({ length: 255 }),
// 	src: varchar({ length: 255 }),
// 	dst: varchar({ length: 255 }),
// 	dcontext: varchar({ length: 255 }),
// 	channel: varchar({ length: 255 }),
// 	dstchannel: varchar({ length: 255 }),
// 	lastapp: varchar({ length: 255 }),
// 	lastdata: varchar({ length: 255 }),
// 	starttime: varchar({ length: 255 }),
// 	answertime: varchar({ length: 255 }),
// 	endtime: varchar({ length: 255 }),
// 	duration: varchar({ length: 255 }),
// 	billsec: varchar({ length: 255 }),
// 	disposition: varchar({ length: 255 }),
// 	amaflags: varchar({ length: 255 }),
// 	accountcode: varchar({ length: 255 }),
// 	uniqueid: varchar({ length: 255 }),
// 	userfield: varchar({ length: 255 }),
// 	telsrvIp: varchar("telsrv_ip", { length: 50 }),
// });

// export const newFunctie = pgTable("new_functie", {
// 	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
// 	id: bigint({ mode: "number" }),
// 	functie: varchar({ length: 50 }),
// 	createdAt: timestamp("created_at", { mode: 'string' }),
// 	updatedAt: timestamp("updated_at", { mode: 'string' }),
// });

export const expertises = pgTable("expertises", {
	id: integer(),
	afkorting: varchar({ length: 10 }),
	omschrijving: varchar({ length: 50 }),
	idspecialisme: integer(),
	verwijderd: integer(),
});

// export const newUrentelling = pgTable("new_urentelling", {
// 	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
// 	id: bigint({ mode: "number" }),
// 	teamId: integer("team_id"),
// 	startDate: date("start_date"),
// 	endDate: date("end_date"),
// 	createdAt: timestamp("created_at", { mode: 'string' }),
// 	updatedAt: timestamp("updated_at", { mode: 'string' }),
// });

export const instellingtype = pgTable("instellingtype", {
	id: integer(),
	naam: varchar({ length: 50 }),
	type: integer(),
	rowguid: uuid(),
	plaatsoverlijdenorder: integer(),
	arrestantenorder: integer(),
	schouwingorder: integer(),
	forensischorder: integer(),
	euthanasieorder: integer(),
	uitstelbegravenorder: integer(),
	letselschadeorder: integer(),
	zedendelictorder: integer(),
	overigorder: integer(),
	arrestantenorderfactuur: integer(),
	schouwingorderfactuur: integer(),
	forensischorderfactuur: integer(),
	euthanasieorderfactuur: integer(),
	uitstelbegravenorderfactuur: integer(),
	letselschadeorderfactuur: integer(),
	zedendelictorderfactuur: integer(),
	arrestantenorderplaats: integer(),
	schouwingorderplaats: integer(),
	forensischorderplaats: integer(),
	euthanasieorderplaats: integer(),
	uitstelbegravenorderplaats: integer(),
	letselschadeorderplaats: integer(),
	zedendelictorderplaats: integer(),
});

// export const medicijnvorm = pgTable("medicijnvorm", {
// 	id: integer(),
// 	vorm: varchar({ length: 50 }),
// 	hoeveelheid: varchar({ length: 50 }),
// 	eenheid: varchar({ length: 10 }),
// 	concentratie: varchar({ length: 50 }),
// 	eenheidc: varchar({ length: 10 }),
// 	opmerking: varchar({ length: 255 }),
// 	idmedicijnmerk: integer(),
// });

export const waarneemgroeplocaties = pgTable("waarneemgroeplocaties", {
	id: integer(),
	idlocatie: integer(),
	idwaarneemgroep: integer(),
	rowguid: uuid(),
});

export const newActivity = pgTable("new_activity", {
	id: integer(),
	team: integer(),
	expertisecompetencesId: integer("expertisecompetences_id"),
	namelong: varchar({ length: 25 }),
	nameshort: varchar({ length: 14 }),
	backgrndcolor: varchar({ length: 255 }),
	icon: varchar({ length: 255 }),
	createdAt: timestamp("created_at", { mode: 'string' }),
	updatedAt: timestamp("updated_at", { mode: 'string' }),
});

export const migrations = pgTable("migrations", {
	id: integer(),
	migration: varchar({ length: 255 }),
	batch: integer(),
});

// export const cdrOld = pgTable("cdr_old", {
// 	id: integer(),
// 	callId: integer("call_id"),
// 	idwaarneemgroep: integer(),
// 	originationNumber: varchar("origination_number", { length: 50 }),
// 	originationName: varchar("origination_name", { length: 255 }),
// 	calledNumber: varchar("called_number", { length: 255 }),
// 	calledName: varchar("called_name", { length: 255 }),
// 	destinationNumber: varchar("destination_number", { length: 255 }),
// 	destinationName: varchar("destination_name", { length: 255 }),
// 	startDate: varchar("start_date", { length: 255 }),
// 	startTime: varchar("start_time", { length: 255 }),
// 	van: integer(),
// 	scriptConnectDate: varchar("script_connect_date", { length: 255 }),
// 	scriptConnectTime: varchar("script_connect_time", { length: 255 }),
// 	deliveredDate: varchar("delivered_date", { length: 255 }),
// 	deliveredTime: varchar("delivered_time", { length: 255 }),
// 	connectDate: varchar("connect_date", { length: 255 }),
// 	connectTime: varchar("connect_time", { length: 255 }),
// 	endDate: varchar("end_date", { length: 255 }),
// 	endTime: varchar("end_time", { length: 255 }),
// 	tot: integer(),
// 	currency: varchar({ length: 255 }),
// 	costs: varchar({ length: 255 }),
// 	state: varchar({ length: 255 }),
// 	publicAccessPrefix: varchar("public_access_prefix", { length: 255 }),
// 	lcrprovider: varchar({ length: 255 }),
// 	projectNumber: varchar("project_number", { length: 255 }),
// 	aoc: varchar({ length: 255 }),
// 	originationDevice: varchar("origination_device", { length: 255 }),
// 	destinationDevice: varchar("destination_device", { length: 255 }),
// 	transferredByNumber: varchar("transferred_by_number", { length: 255 }),
// 	transferredByName: varchar("transferred_by_name", { length: 255 }),
// 	transferredCallId1: varchar("transferred_call_id1", { length: 255 }),
// 	transferredCallId2: varchar("transferred_call_id2", { length: 255 }),
// 	transferredToCallId: varchar("transferred_to_call_id", { length: 255 }),
// 	transferDate: varchar("transfer_date", { length: 255 }),
// 	transferTime: varchar("transfer_time", { length: 255 }),
// 	disconnectReason: varchar("disconnect_reason", { length: 255 }),
// });

// export const calAfdelingen = pgTable("cal_afdelingen", {
// 	id: integer(),
// 	naam: varchar({ length: 255 }),
// 	idinstelling: integer(),
// 	verwijderd: boolean(),
// });

// export const plaatsregios = pgTable("plaatsregios", {
// 	id: integer(),
// 	idregio: integer(),
// 	plaats: varchar({ length: 255 }),
// 	gemeente: varchar({ length: 255 }),
// 	cbs: boolean(),
// });

// export const newExpertise = pgTable("new_expertise", {
// 	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
// 	id: bigint({ mode: "number" }),
// 	team: integer(),
// 	expertiseLong: varchar("expertise_long", { length: 255 }),
// 	expertiseShort: varchar("expertise_short", { length: 255 }),
// 	createdAt: timestamp("created_at", { mode: 'string' }),
// 	updatedAt: timestamp("updated_at", { mode: 'string' }),
// });

// export const newLocation = pgTable("new_location", {
// 	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
// 	id: bigint({ mode: "number" }),
// 	team: integer(),
// 	namelong: varchar({ length: 25 }),
// 	nameshort: varchar({ length: 14 }),
// 	backgrndcolor: varchar({ length: 255 }),
// 	createdAt: timestamp("created_at", { mode: 'string' }),
// 	updatedAt: timestamp("updated_at", { mode: 'string' }),
// });

// export const calTeams = pgTable("cal_teams", {
// 	id: integer(),
// 	naam: varchar({ length: 50 }),
// 	idinstelling: integer(),
// 	verwijderd: boolean(),
// });

// export const schouwing = pgTable("schouwing", {
// 	id: integer(),
// 	idverrichting: integer(),
// 	lijkvinding: boolean(),
// 	jongerdan28Dagen: boolean(),
// 	gebdatum: varchar({ length: 10 }),
// 	gebtijd: varchar({ length: 10 }),
// 	overlijdensdatum: varchar({ length: 10 }),
// 	overlijdenstijd: varchar({ length: 50 }),
// 	vindingdatum: varchar({ length: 10 }),
// 	duurzwangerschap: integer(),
// 	gebgewicht: integer(),
// 	geblengte: integer(),
// 	gebgeslacht: boolean(),
// 	doodsoorzaaktext: varchar({ length: 255 }),
// 	complicaties: varchar({ length: 300 }),
// 	idplaats: integer(),
// 	sectie: integer(),
// 	onderzoekingen: integer(),
// 	doodsoorzaaktype: integer(),
// 	ziekte1: varchar({ length: 255 }),
// 	ziekte1Duur: varchar({ length: 20 }),
// 	ziekte2: varchar({ length: 255 }),
// 	ziekte2Duur: varchar({ length: 20 }),
// 	ziekte3: varchar({ length: 255 }),
// 	ziekte3Duur: varchar({ length: 20 }),
// 	ziekte4: varchar({ length: 255 }),
// 	ziekte4Duur: varchar({ length: 20 }),
// 	doodsoorzaak: integer(),
// 	levensbeeindigendh: integer(),
// 	omstandigheden: varchar({ length: 1024 }),
// 	letsel: varchar({ length: 1024 }),
// 	plaatsgebeurtenis: varchar({ length: 255 }),
// });

// export const overig = pgTable("Overig", {
// 	id: integer(),
// 	idverrichting: integer(),
// 	aantekening: varchar({ length: 2048 }),
// });

// export const calCalamiteiten = pgTable("cal_calamiteiten", {
// 	id: integer(),
// 	datum: integer(),
// 	idscenario: integer(),
// 	idlocatie: integer(),
// 	tijd: integer(),
// 	meldenbij: varchar({ length: 255 }),
// 	afgemeld: boolean(),
// 	iddeelnemer: integer(),
// });

// export const waarneemgroepmedicijnvormen = pgTable("waarneemgroepmedicijnvormen", {
// 	id: integer(),
// 	idwaarneemgroep: integer(),
// 	idmedicijnvorm: integer(),
// });

// export const medicijngeneriek = pgTable("medicijngeneriek", {
// 	id: integer(),
// 	naam: varchar({ length: 50 }),
// 	opiaat: boolean(),
// });

export const diensten = pgTable("diensten", {
	id: integer(),
	idwaarneemgroep: integer(),
	idpraktijk: integer(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	van: bigint({ mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	tot: bigint({ mode: "number" }),
	iddeelnemer: integer(),
	rol: integer(),
	iddienstherhalen: integer(),
	idaantekening: integer(),
	iddeelnovern: integer(),
	iddienstovern: integer(),
	type: integer(),
	idshift: integer(),
	idtarief: integer(),
	idkamer: integer(),
	idtelnr: integer(),
	idlocatie: integer(),
	iddeelnemer2: integer(),
	idtaaktype: integer(),
	currentDate: date("current_date"),
	nextDate: date("next_date"),
	senderId: integer("sender_id"),
	deleteRequest: integer("delete_request"),
});

// export const teoBackup = pgTable("teo_backup", {
// 	firstName: varchar("first_name", { length: 50 }),
// 	firstMd5: varchar("first_md5", { length: 255 }),
// 	zoutje: varchar({ length: 32 }),
// });

// export const calScenarioafdelingteams = pgTable("cal_scenarioafdelingteams", {
// 	id: integer(),
// 	idscenarioafdeling: integer(),
// 	idteam: integer(),
// 	aantal: integer(),
// 	verwijderd: boolean(),
// });

// export const onderzoekingen = pgTable("onderzoekingen", {
// 	id: integer(),
// 	type: integer(),
// 	naam: varchar({ length: 50 }),
// });

// export const artsenTemp = pgTable("artsen_temp", {
// 	id: integer(),
// 	naam: varchar({ length: 50 }),
// 	voornaam: varchar({ length: 50 }),
// 	voorletters: varchar({ length: 10 }),
// 	titulatuur: varchar({ length: 20 }),
// 	geslacht: boolean(),
// 	idspecialisme: integer(),
// 	idlocatie: integer(),
// 	email: varchar({ length: 50 }),
// 	gecontrolleerd: boolean(),
// });

// export const verrekeningen = pgTable("verrekeningen", {
// 	id: integer(),
// 	idwaarneemgroep: integer(),
// 	verrekening: varchar({ length: 50 }),
// });

export const praktijkdeelnemers = pgTable("praktijkdeelnemers", {
	id: integer(),
	idpraktijk: integer(),
	iddeelnemer: integer(),
	rowguid: uuid(),
});

// export const medicijnmerk = pgTable("medicijnmerk", {
// 	id: integer(),
// 	naam: varchar({ length: 50 }),
// 	idfabrikant: integer(),
// 	idmedicijngeneriek: integer(),
// });

// export const verrichtingstatistieken = pgTable("verrichtingstatistieken", {
// 	id: integer(),
// 	idverrichting: integer(),
// 	idstatistiek: integer(),
// });

export const specialismen = pgTable("specialismen", {
	id: integer(),
	omschrijving: varchar({ length: 40 }),
	bigcode: varchar({ length: 20 }),
	type: integer(),
});

// export const role = pgTable("role", {
// 	id: integer(),
// 	name: varchar({ length: 30 }),
// 	absenceplanner: boolean(),
// 	spreekuren: boolean(),
// 	absenceplannerdoctor: boolean(),
// 	countdoctoractivity: boolean(),
// 	doctorabsence: boolean(),
// 	capacityplanner: boolean(),
// 	capacityoverview: boolean(),
// });

export const deelnemers = pgTable("deelnemers", {
	id: integer(),
	idgroep: integer(),
	achternaam: varchar({ length: 50 }),
	voorletterstussenvoegsel: varchar({ length: 50 }),
	voornaam: varchar({ length: 50 }),
	name: varchar({ length: 50 }),
	initialen: varchar({ length: 50 }),
	geslacht: boolean(),
	afwijkendefunctie: varchar({ length: 50 }),
	color: varchar({ length: 50 }),
	afgemeld: boolean(),
	idlocatie: integer(),
	idspecialisme: integer(),
	idpraktijk: integer(),
	idwaarneemgroep: integer(),
	idlocatienu: integer(),
	huisadrstraatnr: varchar({ length: 50 }),
	huisadrpostcode: varchar({ length: 50 }),
	huisadrplaats: varchar({ length: 50 }),
	huisadrtelnr: varchar({ length: 50 }),
	huisadrfax: varchar({ length: 50 }),
	huisemail: varchar({ length: 50 }),
	login: varchar({ length: 50 }),
	password1: varchar({ length: 50 }),
	smscode: varchar({ length: 10 }),
	smstime: integer(),
	ip: varchar({ length: 50 }),
	lastactiontime: integer(),
	idrol: integer(),
	abonnementdd: boolean(),
	aboforensys: boolean(),
	abocalamiteiten: boolean(),
	abooutsync: boolean(),
	idsettelnrdienst: integer(),
	followmetelnr: varchar({ length: 50 }),
	idovergenomendoor: integer(),
	overgenomenvanaf: integer(),
	overgenomentot: integer(),
	reminderpermin: integer(),
	dagbegin: integer(),
	dageind: integer(),
	tarief: integer(),
	roosterpersoonlijk: boolean(),
	dddienstzien: boolean(),
	ddzien: boolean(),
	bezzien: boolean(),
	shiftzien: boolean(),
	vkzien: boolean(),
	przien: boolean(),
	vakzien: boolean(),
	allewgzien: boolean(),
	uitgebreidzoeken: boolean(),
	echtedeelnemer: boolean(),
	printlijst: boolean(),
	printlijstae: boolean(),
	laatstevoorkeur: boolean(),
	outlook: boolean(),
	outlookemail: varchar({ length: 50 }),
	outlookdate: varchar({ length: 30 }),
	rowguid: uuid(),
	smsdienstbegin: boolean(),
	eigentelwelkomwav: boolean(),
	gespreksopname: boolean(),
	subtakenzien: boolean(),
	spreekurenzien: boolean(),
	fellow: boolean(),
	isVoicemailDoorschakeling: boolean("is_voicemail_doorschakeling"),
	encryptedPassword: varchar("encrypted_password", { length: 32 }),
	password: varchar({ length: 255 }),
	email: varchar({ length: 50 }),
	willBeScheduled: boolean("will_be_scheduled"),
	callRecording: boolean("call_recording"),
	ownObservationMessage: boolean("own_observation_message"),
	mijnExpertises: varchar("mijn_expertises", { length: 500 }),
	isForgotPassword: varchar("is_forgot_password", { length: 500 }),
	// Better Auth default user columns (nullable for existing rows)
	emailVerified: boolean("email_verified"),
	image: varchar("image", { length: 255 }),
	createdAt: timestamp("created_at", { mode: 'string' }),
	updatedAt: timestamp("updated_at", { mode: 'string' }),
	role: varchar("role", { length: 50 }),
});

export const groepen = pgTable("groepen", {
	id: integer(),
	naam: varchar({ length: 30 }),
	deelnemertoev: boolean(),
	deelnemerwijz: boolean(),
	deelnemerverw: boolean(),
	deelnemerlocatienuwijz: boolean(),
	waarneemgroeptoev: boolean(),
	waarneemgroepwijz: boolean(),
	waarneemgroepverw: boolean(),
	specialismen: boolean(),
	regios: boolean(),
	artsen: boolean(),
	instellingen: boolean(),
	locaties: boolean(),
	omschrijvingtelnrstoev: boolean(),
	omschrijvingtelnrswijz: boolean(),
	omschrijvingtelnrsverw: boolean(),
	settelnrstoev: boolean(),
	settelnrswijz: boolean(),
	settelnrsverw: boolean(),
	dienst: boolean(),
	diensttoev: boolean(),
	dienstwijz: boolean(),
	dienstverw: boolean(),
	dienstruil: boolean(),
	dienstalleeneigen: boolean(),
	dienstbinnenwg: boolean(),
	shift: boolean(),
	voorkeur: boolean(),
	groeptoev: boolean(),
	groepwijz: boolean(),
	groepverw: boolean(),
	telefoonovernemen: boolean(),
	tarieven: boolean(),
	facturering: boolean(),
	vakanties: boolean(),
	calamiteiten: boolean(),
	maatschapplanner: boolean(),
});

export const newDagdelen = pgTable("new_dagdelen", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }),
	daypartWithDate: varchar("daypart_with_date", { length: 255 }),
	doctor: integer(),
	team: integer(),
	maandag: varchar({ length: 50 }),
	dinsdag: varchar({ length: 50 }),
	woensdag: varchar({ length: 50 }),
	donderdag: varchar({ length: 50 }),
	vrijdag: varchar({ length: 50 }),
	zaterdag: varchar({ length: 50 }),
	zondag: varchar({ length: 50 }),
	createdAt: timestamp("created_at", { mode: 'string' }),
	updatedAt: timestamp("updated_at", { mode: 'string' }),
});

// export const formmails = pgTable("formmails", {
// 	id: integer(),
// 	idverrichting: integer(),
// 	formname: varchar({ length: 50 }),
// 	aan: varchar({ length: 255 }),
// 	onderwerp: varchar({ length: 255 }),
// 	tekst: text(),
// 	datum: integer(),
// });

// export const forensisch = pgTable("forensisch", {
// 	id: integer(),
// 	idverrichting: integer(),
// 	dnaWang: boolean("dna_wang"),
// 	dnaBloed: boolean("dna_bloed"),
// 	urine: boolean(),
// 	bloed: boolean(),
// 	zedenonderzoek: boolean(),
// 	letselbeschrijving: boolean(),
// 	fittofly: boolean(),
// 	overig: boolean(),
// 	kindermishandeling: boolean(),
// 	inwinnen: boolean(),
// 	opmerkingen: varchar({ length: 2048 }),
// });

// export const kamers = pgTable("kamers", {
// 	id: integer(),
// 	iddeelnemer: integer(),
// 	idaantekening: integer(),
// 	idpraktijk: integer(),
// 	kamer: varchar({ length: 50 }),
// });

// export const protocolblokken = pgTable("protocolblokken", {
// 	id: integer(),
// 	idprotocol: integer(),
// 	naam: varchar({ length: 255 }),
// 	filename: varchar({ length: 255 }),
// 	type: varchar({ length: 20 }),
// });

// export const sessionHashes = pgTable("sessionHashes", {
// 	userId: integer("user_id"),
// 	hash: integer(),
// 	aanmaakdatum: date(),
// });

// export const personen = pgTable("personen", {
// 	id: integer(),
// 	naam: varchar({ length: 50 }),
// 	voornaam: varchar({ length: 50 }),
// 	geslacht: boolean(),
// 	gebplaats: varchar({ length: 50 }),
// 	gebdatum: varchar({ length: 50 }),
// 	nationaliteit: varchar({ length: 50 }),
// 	notitie: text(),
// });

// export const oauthClients = pgTable("oauth_clients", {
// 	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
// 	id: bigint({ mode: "number" }),
// 	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
// 	userId: bigint("user_id", { mode: "number" }),
// 	name: varchar({ length: 255 }),
// 	secret: varchar({ length: 100 }),
// 	provider: varchar({ length: 255 }),
// 	redirect: text(),
// 	personalAccessClient: boolean("personal_access_client"),
// 	passwordClient: boolean("password_client"),
// 	revoked: boolean(),
// 	createdAt: timestamp("created_at", { mode: 'string' }),
// 	updatedAt: timestamp("updated_at", { mode: 'string' }),
// });

// export const deelnemersBackup = pgTable("deelnemers_backup", {
// 	id: integer(),
// 	idgroep: integer(),
// 	achternaam: varchar({ length: 50 }),
// 	voorletterstussenvoegsel: varchar({ length: 50 }),
// 	voornaam: varchar({ length: 50 }),
// 	initialen: varchar({ length: 50 }),
// 	geslacht: boolean(),
// 	afwijkendefunctie: varchar({ length: 50 }),
// 	color: varchar({ length: 50 }),
// 	afgemeld: boolean(),
// 	idlocatie: integer(),
// 	idspecialisme: integer(),
// 	idpraktijk: integer(),
// 	idwaarneemgroep: integer(),
// 	idlocatienu: integer(),
// 	huisadrstraatnr: varchar({ length: 50 }),
// 	huisadrpostcode: varchar({ length: 50 }),
// 	huisadrplaats: varchar({ length: 50 }),
// 	huisadrtelnr: varchar({ length: 50 }),
// 	huisadrfax: varchar({ length: 50 }),
// 	huisemail: varchar({ length: 50 }),
// 	login: varchar({ length: 50 }),
// 	password: varchar({ length: 50 }),
// 	smscode: varchar({ length: 10 }),
// 	smstime: integer(),
// 	ip: varchar({ length: 50 }),
// 	lastactiontime: integer(),
// 	idrol: integer(),
// 	abonnementdd: boolean(),
// 	aboforensys: boolean(),
// 	abocalamiteiten: boolean(),
// 	abooutsync: boolean(),
// 	idsettelnrdienst: integer(),
// 	followmetelnr: varchar({ length: 50 }),
// 	idovergenomendoor: integer(),
// 	overgenomenvanaf: integer(),
// 	overgenomentot: integer(),
// 	reminderpermin: integer(),
// 	dagbegin: integer(),
// 	dageind: integer(),
// 	tarief: integer(),
// 	roosterpersoonlijk: boolean(),
// 	dddienstzien: boolean(),
// 	ddzien: boolean(),
// 	bezzien: boolean(),
// 	shiftzien: boolean(),
// 	vkzien: boolean(),
// 	przien: boolean(),
// 	vakzien: boolean(),
// 	allewgzien: boolean(),
// 	uitgebreidzoeken: boolean(),
// 	echtedeelnemer: boolean(),
// 	printlijst: boolean(),
// 	printlijstae: boolean(),
// 	laatstevoorkeur: boolean(),
// 	outlook: boolean(),
// 	outlookemail: varchar({ length: 50 }),
// 	outlookdate: varchar({ length: 30 }),
// 	rowguid: uuid(),
// 	smsdienstbegin: boolean(),
// 	eigentelwelkomwav: boolean(),
// 	gespreksopname: boolean(),
// 	subtakenzien: boolean(),
// 	spreekurenzien: boolean(),
// 	fellow: boolean(),
// 	isVoicemailDoorschakeling: boolean("is_voicemail_doorschakeling"),
// 	encryptedPassword: varchar("encrypted_password", { length: 32 }),
// });

// export const visitor = pgTable("visitor", {
// 	id: integer(),
// 	datetime: integer(),
// 	userAgent: varchar("user_agent", { length: 255 }),
// 	remoteAddr: varchar("remote_addr", { length: 255 }),
// 	forwardedFor: varchar("forwarded_for", { length: 255 }),
// 	layout: varchar({ length: 10 }),
// });

// export const verification = pgTable("verification", {
// 	id: text().primaryKey().notNull(),
// 	identifier: text().notNull(),
// 	value: text().notNull(),
// 	expiresAt: timestamp({ withTimezone: true, mode: 'string' }).notNull(),
// 	createdAt: timestamp({ withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
// 	updatedAt: timestamp({ withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
// }, (table) => [
// 	index("verification_identifier_idx").using("btree", table.identifier.asc().nullsLast().op("text_ops")),
// ]);

// export const arrestanten = pgTable("arrestanten", {
// 	id: integer(),
// 	idverrichting: integer(),
// 	naamverzorger: varchar({ length: 255 }),
// 	celnummer: varchar({ length: 10 }),
// 	vragenverzorger: varchar({ length: 255 }),
// 	instructiesverzorger: varchar({ length: 255 }),
// 	subjectief: text(),
// 	objectief: text(),
// 	evaluatie: text(),
// 	plan: text(),
// 	medicatie: text(),
// 	recept: text(),
// 	insluiting: boolean(),
// 	wekadvies: boolean(),
// 	overdracht: boolean(),
// 	camera: boolean(),
// 	wekadviesuur: doublePrecision(),
// });

export const dienstenNewOld = pgTable("diensten_new_old", {
	id: integer(),
	idwaarneemgroep: integer(),
	idpraktijk: integer(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	van: bigint({ mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	tot: bigint({ mode: "number" }),
	iddeelnemer: integer(),
	rol: integer(),
	iddienstherhalen: integer(),
	idaantekening: integer(),
	iddeelnovern: integer(),
	iddienstovern: integer(),
	type: integer(),
	idshift: integer(),
	idtarief: integer(),
	idkamer: integer(),
	idtelnr: integer(),
	idlocatie: integer(),
	iddeelnemer2: integer(),
	idtaaktype: integer(),
	currentDate: date("current_date"),
	nextDate: date("next_date"),
	senderId: integer("sender_id"),
	deleteRequest: integer("delete_request"),
});

export const dienstherhalen = pgTable("dienstherhalen", {
	id: integer(),
	weken: integer(),
	startdatum: integer(),
	einddatum: integer(),
});

// export const kentekens = pgTable("kentekens", {
// 	id: integer(),
// 	kenteken: varchar({ length: 10 }),
// 	iddeelnemer: integer(),
// });

export const dienstaantekening = pgTable("dienstaantekening", {
	id: integer(),
	tekst: varchar({ length: 25 }),
	afwezig: boolean(),
	iddeelnemer: integer(),
	idwaarneemgroep: integer(),
	verwijderd: boolean(),
	prio: integer(),
	idtariefDefault: integer("idtarief_default"),
});

export const gesprekken = pgTable("gesprekken", {
	id: integer(),
	vannummer: varchar({ length: 20 }),
	onsnummer: varchar({ length: 20 }),
	naarnummer: varchar({ length: 20 }),
	idwaarneemgroep: integer(),
	iddeelnemer: integer(),
	van: integer(),
	tot: integer(),
	recordingFilename: varchar("recording_filename", { length: 255 }),
	telsrv: varchar({ length: 50 }),
	recordingShow: integer("recording_show"),
});

export const deelnemerexpertises = pgTable("deelnemerexpertises", {
	id: integer(),
	iddeelnemer: integer(),
	idexpertise: integer(),
});

// export const kamertelnrs = pgTable("kamertelnrs", {
// 	id: integer(),
// 	idpraktijk: integer(),
// 	idkamer: integer(),
// 	telnr: varchar({ length: 50 }),
// });

export const praktijken = pgTable("praktijken", {
	id: integer(),
	naam: varchar({ length: 50 }),
	idspecialisme: integer(),
	email: varchar({ length: 50 }),
	password: varchar({ length: 16 }),
	straatnr: varchar({ length: 30 }),
	postcode: varchar({ length: 7 }),
	plaats: varchar({ length: 50 }),
	telnr: varchar({ length: 20 }),
	dagbegin: integer(),
	dageind: integer(),
	eigenrooster: boolean(),
	idsecretaris: integer(),
	rowguid: uuid(),
});

export const pagehit = pgTable("pagehit", {
	id: integer(),
	datetime: integer(),
	visitor: integer(),
	useraccount: integer(),
	requestMethod: varchar("request_method", { length: 5 }),
	queryString: varchar("query_string", { length: 255 }),
	pageid: integer(),
	pagename: varchar({ length: 50 }),
	refererid: integer(),
	referername: varchar({ length: 50 }),
});

export const locaties = pgTable("locaties", {
	id: integer(),
	idinstellingtype: integer(),
	idinstelling: integer(),
	idregio: integer(),
	naam: varchar({ length: 255 }),
	zoeknaam: varchar({ length: 255 }),
	naamlang: varchar({ length: 255 }),
	adres: varchar({ length: 255 }),
	postcode: varchar({ length: 10 }),
	plaats: varchar({ length: 255 }),
	telnr: varchar({ length: 50 }),
	faxnr: varchar({ length: 50 }),
	email: varchar({ length: 255 }),
	verwijderd: integer(),
	rowguid: uuid(),
	kleur: varchar({ length: 50 }),
	afkorting: varchar({ length: 50 }),
});

// export const newFte = pgTable("new_fte", {
// 	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
// 	id: bigint({ mode: "number" }),
// 	teamId: integer("team_id"),
// 	doctorId: integer("doctor_id"),
// 	fteDd: doublePrecision("fte_dd"),
// 	fteDdDate: date("fte_dd_date"),
// 	createdAt: timestamp("created_at", { mode: 'string' }),
// 	updatedAt: timestamp("updated_at", { mode: 'string' }),
// });

// export const cbspg = pgTable("cbspg", {
// 	plaats: varchar({ length: 255 }),
// 	gemeente: varchar({ length: 255 }),
// });

// export const oauthPersonalAccessClients = pgTable("oauth_personal_access_clients", {
// 	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
// 	id: bigint({ mode: "number" }),
// 	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
// 	clientId: bigint("client_id", { mode: "number" }),
// 	createdAt: timestamp("created_at", { mode: 'string' }),
// 	updatedAt: timestamp("updated_at", { mode: 'string' }),
// });

export const vakantieregios = pgTable("vakantieregios", {
	id: integer(),
	naam: varchar({ length: 50 }),
});

// export const calTeamrollen = pgTable("cal_teamrollen", {
// 	id: integer(),
// 	idteam: integer(),
// 	idrol: integer(),
// 	aantal: integer(),
// 	verwijderd: boolean(),
// });

// export const instellingen = pgTable("instellingen", {
// 	id: integer(),
// 	idinstellingtype: integer(),
// 	naam: varchar({ length: 50 }),
// 	naamlang: varchar({ length: 255 }),
// 	url: varchar({ length: 40 }),
// 	telnr: varchar({ length: 20 }),
// 	idhoofdlocatie: integer(),
// 	rowguid: uuid(),
// });

// export const artsen = pgTable("artsen", {
// 	id: integer(),
// 	naam: varchar({ length: 50 }),
// 	voornaam: varchar({ length: 50 }),
// 	voorletters: varchar({ length: 10 }),
// 	titulatuur: varchar({ length: 20 }),
// 	geslacht: boolean(),
// 	idspecialisme: integer(),
// 	idlocatie: integer(),
// 	gecontrolleerd: boolean(),
// 	email: varchar({ length: 50 }),
// 	rowguid: uuid(),
// });

// export const persoonadressen = pgTable("persoonadressen", {
// 	id: integer(),
// 	adres: varchar({ length: 50 }),
// 	postcode: varchar({ length: 50 }),
// 	plaats: varchar({ length: 50 }),
// 	telnr: varchar({ length: 20 }),
// 	idverzekeraar: integer(),
// 	polisnummer: varchar({ length: 50 }),
// });

// export const icdgroepen = pgTable("icdgroepen", {
// 	id: integer(),
// 	code: varchar({ length: 50 }),
// 	naam: varchar({ length: 255 }),
// });

// export const regios = pgTable("regios", {
// 	id: integer(),
// 	naam: varchar({ length: 40 }),
// 	rowguid: uuid(),
// });

// export const deviceTokens = pgTable("deviceTokens", {
// 	userId: integer("user_id"),
// 	deviceToken: varchar("device_token", { length: 255 }),
// });

// export const statistieken = pgTable("statistieken", {
// 	id: integer(),
// 	type: varchar({ length: 50 }),
// 	naam: varchar({ length: 255 }),
// });

export const tarieven = pgTable("tarieven", {
	id: integer(),
	idtariefregel: integer(),
	euros: doublePrecision(),
	vantijd: integer(),
	vandag: integer(),
	tottijd: integer(),
	totdag: integer(),
	pm: boolean(),
});

export const waarneemgroepvakantieregios = pgTable("waarneemgroepvakantieregios", {
	id: integer(),
	idwaarneemgroep: integer(),
	idvakantieregio: integer(),
});

// export const protocollen = pgTable("protocollen", {
// 	id: integer(),
// 	iddeelnemer: integer(),
// 	versie: integer(),
// 	naam: varchar({ length: 255 }),
// 	datum: integer(),
// });

export const taaktypen = pgTable("taaktypen", {
	id: integer(),
	idwaarneemgroep: integer(),
	afkorting: varchar({ length: 10 }),
	omschrijving: varchar({ length: 50 }),
	minDagdelenPerWeek: integer("min_dagdelen_per_week"),
	belasting: integer(),
	idexpertise: integer(),
	iddefaultlocatie: integer(),
	idgekoppeldetaaktype: integer(),
	deelnemer2Mogelijk: boolean(),
	defaultplanningseenheid: integer(),
	verwijderd: integer(),
	kleur: varchar({ length: 50 }),
	volgorde: integer(),
	type: integer(),
	nietLocatieGebonden: boolean("niet_locatie_gebonden"),
});

// export const uitvaartLimburg = pgTable("uitvaart_limburg", {
// 	naam: varchar({ length: 255 }),
// 	type: varchar({ length: 255 }),
// 	adres: varchar({ length: 255 }),
// 	postcode: varchar({ length: 255 }),
// 	plaats: varchar({ length: 255 }),
// 	f6: varchar({ length: 255 }),
// });

// export const waarneemgroepprotocollen = pgTable("waarneemgroepprotocollen", {
// 	id: integer(),
// 	idwaarneemgroep: integer(),
// 	idprotocol: integer(),
// 	rowguid: uuid(),
// });

// export const syncqueries = pgTable("syncqueries", {
// 	id: integer(),
// 	type: varchar({ length: 50 }),
// 	target: varchar({ length: 50 }),
// 	author: varchar({ length: 50 }),
// 	query: text(),
// 	status: integer(),
// 	utime: integer(),
// 	iddeelnemer: integer(),
// 	qid: integer(),
// 	oid: integer(),
// });

export const waarneemgroepdeelnemers = pgTable("waarneemgroepdeelnemers", {
	id: integer(),
	iddeelnemer: integer(),
	idwaarneemgroep: integer(),
	idgroep: integer(),
	aangemeld: boolean(),
	fteDd: varchar("fte_dd", { length: 50 }),
	perDd: varchar("per_dd", { length: 50 }),
	ftePp: varchar("fte_pp", { length: 50 }),
	perPp: varchar("per_pp", { length: 50 }),
	dokterdienst: varchar({ length: 50 }),
	dokterdienstEntryDate: varchar("dokterdienst_entry_date", { length: 50 }),
	dokterdienstStopDate: varchar("dokterdienst_stop_date", { length: 50 }),
	practiceScheduler: varchar("practice_scheduler", { length: 50 }),
	practiceSchedulerEntryDate: varchar("practice_scheduler_entry_date", { length: 50 }),
	practiceSchedulerStopDate: varchar("practice_scheduler_stop_date", { length: 50 }),
	idfunctie: integer(),
});

// export const calOproepen = pgTable("cal_oproepen", {
// 	id: integer(),
// 	idcalamiteit: integer(),
// 	idafdeling: integer(),
// 	idteam: integer(),
// 	teamvolgnr: varchar({ length: 2 }),
// 	idrol: integer(),
// 	rolvolgnr: varchar({ length: 2 }),
// 	iddeelnemer: integer(),
// 	smsstatus: integer(),
// 	smstijdverzonden: integer(),
// 	smstijdontvangen: integer(),
// 	telstatus: integer(),
// 	teltijd: integer(),
// 	vervangen: boolean(),
// 	afgezegdtijd: integer(),
// 	idmeldenbijafdeling: integer(),
// 	idmeldenbijteam: integer(),
// 	idmeldenbijrol: integer(),
// });

// export const tariefregels = pgTable("tariefregels", {
// 	id: integer(),
// 	factuur: integer(),
// 	idwaarneemgroep: integer(),
// 	iddeelnemer: integer(),
// 	idlocatie: integer(),
// 	type1: varchar({ length: 50 }),
// 	type2: varchar({ length: 50 }),
// 	tijdtariefbepaling: varchar({ length: 50 }),
// 	idactiviteit: integer(),
// 	km1: integer(),
// 	km2: integer(),
// 	bonus: boolean(),
// 	specificiteit: integer(),
// });

// export const verrichtingactiviteiten = pgTable("verrichtingactiviteiten", {
// 	id: integer(),
// 	idverrichting: integer(),
// 	idactiviteit: integer(),
// });

export const vakanties = pgTable("vakanties", {
	id: integer(),
	idvakantieregio: integer(),
	naam: varchar({ length: 255 }),
	van: integer(),
	tot: integer(),
	type: integer(),
});

// export const newExpertisecompetenie = pgTable("new_expertisecompetenie", {
// 	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
// 	id: bigint({ mode: "number" }),
// 	team: integer(),
// 	expertise: varchar({ length: 50 }),
// 	afkorting: varchar({ length: 50 }),
// 	createdAt: timestamp("created_at", { mode: 'string' }),
// 	updatedAt: timestamp("updated_at", { mode: 'string' }),
// });

export const waarneemgroepen = pgTable("waarneemgroepen", {
	id: integer(),
	naam: varchar({ length: 50 }),
	idspecialisme: integer(),
	idregio: integer(),
	idinstelling: integer(),
	idlocatie: integer(),
	telnringaand: varchar({ length: 50 }),
	telnrnietopgenomen: varchar({ length: 50 }),
	telnronzecentrale: varchar({ length: 50 }),
	telnronzecentrale2: varchar({ length: 50 }),
	telnrconference: varchar({ length: 50 }),
	idfacturering: integer(),
	iddeelnemersecr: integer(),
	urentellingvan: integer(),
	urentellingtot: integer(),
	idinvoegendewaarneemgroep: integer(),
	regiobeschrijving: varchar({ length: 1024 }),
	veldfilters: integer(),
	veldfilterssecr: integer(),
	afgemeld: boolean(),
	recordabo: boolean(),
	ccemail: varchar({ length: 50 }),
	email: varchar({ length: 50 }),
	smsdienstbegin: boolean(),
	idliason1: integer(),
	idliason2: integer(),
	idliason3: integer(),
	idliason4: integer(),
	idcoordinatorwaarneemgroep: integer(),
	crisispinliason: varchar({ length: 50 }),
	crisispindeelnemer: varchar({ length: 50 }),
	crisispintime: integer(),
	eigentelwelkomwav: boolean(),
	abomaatschapplanner: boolean(),
	gebruiktVoicemail: boolean("gebruikt_voicemail"),
	gespreksopname: integer(),
});

// export const verrichtingmedicijnen = pgTable("verrichtingmedicijnen", {
// 	id: integer(),
// 	idmedicijnvorm: integer(),
// 	idverrichting: integer(),
// 	naarrecept: varchar({ length: 50 }),
// 	tijd1: integer(),
// 	tijd2: integer(),
// 	tijd3: integer(),
// 	tijd4: integer(),
// 	dosering1: varchar({ length: 10 }),
// 	dosering2: varchar({ length: 10 }),
// 	dosering3: varchar({ length: 10 }),
// 	dosering4: varchar({ length: 10 }),
// 	van: integer(),
// 	tot: integer(),
// 	opmerking: varchar({ length: 2048 }),
// });

// export const calScenarioafdelingen = pgTable("cal_scenarioafdelingen", {
// 	id: integer(),
// 	idscenario: integer(),
// 	idafdeling: integer(),
// 	verwijderd: boolean(),
// });

export const sms = pgTable("sms", {
	id: integer(),
	iddeelnemer: integer(),
	idwaarneemgroep: integer(),
	nummer: varchar({ length: 20 }),
	van: integer(),
	newid: integer(),
});

export const newChipsdaypart = pgTable("new_chipsdaypart", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }),
	date: timestamp({ mode: 'string' }),
	daypartWithDate: varchar("daypart_with_date", { length: 255 }),
	doctor: integer(),
	team: integer(),
	createdAt: timestamp("created_at", { mode: 'string' }),
	updatedAt: timestamp("updated_at", { mode: 'string' }),
	grabsence: integer(),
	grlocation: integer(),
	gractivity: integer(),
	grspec: integer(),
	grtask1: integer(),
	grtask2: integer(),
	grtask3: integer(),
	repetition: integer(),
	fte: integer(),
	lastUpdatedUserid: integer("last_updated_userid"),
	tplocation: integer(),
	tpactivity: integer(),
	tpspec: integer(),
	tptask1: integer(),
	tptask2: integer(),
	tptask3: integer(),
	tpabsence: integer(),
	tplastedited: timestamp({ mode: 'string' }),
	tplastdateedited: integer(),
});

// export const gemeentearrondissement = pgTable("gemeentearrondissement", {
// 	id: integer(),
// 	gemeente: varchar({ length: 255 }),
// 	arrondissement: varchar({ length: 255 }),
// });

// export const nhnplaatsgemeente = pgTable("nhnplaatsgemeente", {
// 	id: integer(),
// 	gemeente: varchar({ length: 255 }),
// 	plaats: varchar({ length: 255 }),
// });

export const settelnrs = pgTable("settelnrs", {
	id: integer(),
	telnr1: varchar({ length: 20 }),
	idlocatietelnr1: integer(),
	idomschrtelnr1: integer(),
	smsontvanger1: boolean(),
	telnr2: varchar({ length: 20 }),
	idlocatietelnr2: integer(),
	idomschrtelnr2: integer(),
	smsontvanger2: boolean(),
	telnr3: varchar({ length: 20 }),
	idlocatietelnr3: integer(),
	idomschrtelnr3: integer(),
	smsontvanger3: boolean(),
	telnr4: varchar({ length: 20 }),
	idlocatietelnr4: integer(),
	idomschrtelnr4: integer(),
	smsontvanger4: boolean(),
	telnr5: varchar({ length: 20 }),
	idlocatietelnr5: integer(),
	idomschrtelnr5: integer(),
	smsontvanger5: boolean(),
	rowguid: uuid(),
	laatstopgenomen: integer(),
});

// export const verzekeraars = pgTable("verzekeraars", {
// 	id: integer(),
// 	naam: varchar({ length: 255 }),
// });

// export const nhnlocaties = pgTable("nhnlocaties", {
// 	id: integer(),
// 	naam: varchar({ length: 255 }),
// 	adres: varchar({ length: 255 }),
// 	postcode: varchar({ length: 255 }),
// 	plaats: varchar({ length: 255 }),
// 	type: varchar({ length: 255 }),
// });

// export const verrichtingicdsubgroepen = pgTable("verrichtingicdsubgroepen", {
// 	id: integer(),
// 	idverrichting: integer(),
// 	idicdsubgroep: integer(),
// 	type: varchar({ length: 50 }),
// });

export const rollen = pgTable("rollen", {
	id: integer(),
	idspecialisme: integer(),
	naam: varchar({ length: 255 }),
	rowguid: uuid(),
});

// export const teo = pgTable("teo", {
// 	firstName: varchar("first_name", { length: 51 }),
// 	firstMd5: varchar("first_md5", { length: 255 }),
// 	zoutje: varchar({ length: 32 }),
// });

// export const verrichtingen = pgTable("verrichtingen", {
// 	id: integer(),
// 	idrit: integer(),
// 	idpersoon: integer(),
// 	idpersoonadres: integer(),
// 	doorgehaald: boolean(),
// 	adrestype: boolean(),
// 	type: varchar({ length: 20 }),
// 	clienttype: integer(),
// 	bps: varchar({ length: 20 }),
// 	opgemaaktals: integer(),
// 	idinf1: integer(),
// 	idinf2: integer(),
// 	idbehandelendarts: integer(),
// 	mapnaam: varchar({ length: 50 }),
// 	dokterklaar: boolean(),
// 	secklaar: boolean(),
// 	nummer: varchar({ length: 20 }),
// 	factuurklaar: boolean(),
// 	factuurklaardate: integer(),
// 	declaratieklaar: boolean(),
// 	declaratieklaardate: integer(),
// 	duur: integer(),
// 	duurauto: boolean(),
// 	printletter: varchar({ length: 5 }),
// });

// export const activiteiten = pgTable("activiteiten", {
// 	id: integer(),
// 	type: varchar({ length: 20 }),
// 	naam: varchar({ length: 255 }),
// });

// export const icdsubgroepen = pgTable("icdsubgroepen", {
// 	id: integer(),
// 	idgroep: integer(),
// 	code: varchar({ length: 50 }),
// 	naam: varchar({ length: 255 }),
// });

// export const newUsers = pgTable("new_users", {
// 	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
// 	id: bigint({ mode: "number" }),
// 	name: varchar({ length: 255 }),
// 	email: varchar({ length: 255 }),
// 	emailVerifiedAt: timestamp("email_verified_at", { mode: 'string' }),
// 	password: varchar({ length: 255 }),
// 	isDayNight: varchar("is_day_night", { length: 100 }),
// 	rememberToken: varchar("remember_token", { length: 100 }),
// 	createdAt: timestamp("created_at", { mode: 'string' }),
// 	updatedAt: timestamp("updated_at", { mode: 'string' }),
// });

// export const oauthAccessTokens = pgTable("oauth_access_tokens", {
// 	id: varchar({ length: 100 }),
// 	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
// 	userId: bigint("user_id", { mode: "number" }),
// 	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
// 	clientId: bigint("client_id", { mode: "number" }),
// 	name: varchar({ length: 255 }),
// 	scopes: text(),
// 	revoked: boolean(),
// 	createdAt: timestamp("created_at", { mode: 'string' }),
// 	updatedAt: timestamp("updated_at", { mode: 'string' }),
// 	expiresAt: timestamp("expires_at", { mode: 'string' }),
// });

// export const calMeldenbij = pgTable("cal_meldenbij", {
// 	id: integer(),
// 	idlocatie: integer(),
// 	tijd: integer(),
// 	meldenbij: varchar({ length: 255 }),
// });

// export const newTask = pgTable("new_task", {
// 	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
// 	id: bigint({ mode: "number" }),
// 	team: integer(),
// 	expertisecompetencesId: integer("expertisecompetences_id"),
// 	tasklong: varchar({ length: 25 }),
// 	taskshort: varchar({ length: 14 }),
// 	backgrndcolor: varchar({ length: 255 }),
// 	createdAt: timestamp("created_at", { mode: 'string' }),
// 	updatedAt: timestamp("updated_at", { mode: 'string' }),
// });

// export const newSpecificationActivity = pgTable("new_specification_activity", {
// 	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
// 	id: bigint({ mode: "number" }),
// 	team: integer(),
// 	activity: integer(),
// 	speclong: varchar({ length: 25 }),
// 	specshort: varchar({ length: 5 }),
// 	createdAt: timestamp("created_at", { mode: 'string' }),
// 	updatedAt: timestamp("updated_at", { mode: 'string' }),
// });

// export const voicemails = pgTable("voicemails", {
// 	id: integer(),
// 	idwaarneemgroep: integer(),
// 	datetime: varchar({ length: 50 }),
// 	status: varchar({ length: 50 }),
// 	ontvangenTimestamp: integer("ontvangen_timestamp"),
// 	afgeluisterdTimestamp: integer("afgeluisterd_timestamp"),
// 	afgehandeldTimestamp: integer("afgehandeld_timestamp"),
// });

// export const cbsga = pgTable("cbsga", {
// 	gemeente: varchar({ length: 255 }),
// 	arrondissement: varchar({ length: 255 }),
// });

// export const ddtarieven = pgTable("ddtarieven", {
// 	id: integer(),
// 	idwaarneemgroep: integer(),
// 	omschrijving: varchar({ length: 50 }),
// 	inteuros: integer(),
// 	intpercentage: integer(),
// });
