import { pgTable, integer, varchar, uuid, doublePrecision, boolean, index, bigint, date, text, timestamp, serial, smallint, primaryKey, unique, check } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



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

export const gesprekken = pgTable("gesprekken", {
	id: integer().primaryKey().notNull().default(sql`nextval('gesprekken_id_seq'::regclass)`),
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
	wasBridged: boolean("was_bridged").default(false),
	talkDurationSec: integer("talk_duration_sec").default(0),
	dialstatus: varchar({ length: 50 })
});

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

export const sms = pgTable("sms", {
	id: integer(),
	iddeelnemer: integer(),
	idwaarneemgroep: integer(),
	nummer: varchar({ length: 20 }),
	van: integer(),
	newid: integer(),
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
	idwaarneemgroep: integer(),
});

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
	currDate: date("curr_date"),
	nextDate: date("next_date"),
	senderId: integer("sender_id"),
	deleteRequest: integer("delete_request"),
	status: varchar({ length: 20 }),
}, (table) => [
	index("diensten_list_idx").using("btree", table.idwaarneemgroep.asc().nullsLast().op("int4_ops"), table.van.asc().nullsLast().op("int4_ops"), table.tot.asc().nullsLast().op("int4_ops")),
]);

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
	defaultplanningseenheid: integer(),
	verwijderd: integer(),
	kleur: varchar({ length: 50 }),
	volgorde: integer(),
	type: integer(),
	nietLocatieGebonden: boolean("niet_locatie_gebonden"),
	deelnemer2Mogelijk: boolean(),
	inbelbaar: boolean(),
	/** Het nummer waarop deze taak bereikbaar is. Mag leeg zijn terwijl inbelbaar aanstaat. */
	inbelnummer: varchar({ length: 30 }),
	isDienst: boolean("is_dienst"),
});

export const specialismen = pgTable("specialismen", {
	id: integer(),
	omschrijving: varchar({ length: 40 }),
	bigcode: varchar({ length: 20 }),
	type: integer(),
});

export const vakantieregios = pgTable("vakantieregios", {
	id: integer(),
	naam: varchar({ length: 50 }),
});

export const rollen = pgTable("rollen", {
	id: integer(),
	idspecialisme: integer(),
	naam: varchar({ length: 255 }),
	rowguid: uuid(),
});

export const waarneemgroepdeelnemers = pgTable("waarneemgroepdeelnemers", {
	id: integer(),
	iddeelnemer: integer(),
	idwaarneemgroep: integer(),
	idgroep: integer(),
	aangemeld: boolean(),
	fte: doublePrecision(),
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

export const instellingen = pgTable("instellingen", {
	id: integer(),
	idinstellingtype: integer(),
	naam: varchar({ length: 50 }),
	naamlang: varchar({ length: 255 }),
	url: varchar({ length: 40 }),
	telnr: varchar({ length: 20 }),
	idhoofdlocatie: integer(),
	rowguid: uuid(),
});

export const vakanties = pgTable("vakanties", {
	id: integer(),
	idvakantieregio: integer(),
	naam: varchar({ length: 255 }),
	van: integer(),
	tot: integer(),
	type: integer(),
});

export const account = pgTable("account", {
	id: text().primaryKey().notNull(),
	accountId: text().notNull(),
	providerId: text().notNull(),
	userId: text().notNull(),
	accessToken: text(),
	refreshToken: text(),
	idToken: text(),
	accessTokenExpiresAt: timestamp({ withTimezone: true, mode: 'string' }),
	refreshTokenExpiresAt: timestamp({ withTimezone: true, mode: 'string' }),
	scope: text(),
	password: text(),
	createdAt: timestamp({ withTimezone: true, mode: 'string' }).notNull(),
	updatedAt: timestamp({ withTimezone: true, mode: 'string' }).notNull(),
});

export const authVerification = pgTable("auth_verification", {
	id: text().notNull(),
	identifier: text().notNull(),
	value: text().notNull(),
	expiresAt: timestamp({ withTimezone: true, mode: 'string' }).notNull(),
	createdAt: timestamp({ withTimezone: true, mode: 'string' }).notNull(),
	updatedAt: timestamp({ withTimezone: true, mode: 'string' }).notNull(),
});

export const session = pgTable("session", {
	id: text().notNull(),
	expiresAt: timestamp({ withTimezone: true, mode: 'string' }).notNull(),
	token: text().notNull(),
	createdAt: timestamp({ withTimezone: true, mode: 'string' }).notNull(),
	updatedAt: timestamp({ withTimezone: true, mode: 'string' }).notNull(),
	ipAddress: text(),
	userAgent: text(),
	userId: text().notNull(),
});

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
	emailVerified: boolean("email_verified"),
	image: varchar({ length: 255 }),
	createdAt: timestamp("created_at", { mode: 'string' }),
	updatedAt: timestamp("updated_at", { mode: 'string' }),
	role: varchar({ length: 50 }),
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

export const dienstherhalen = pgTable("dienstherhalen", {
	id: integer(),
	weken: integer(),
	startdatum: integer(),
	einddatum: integer(),
});

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

export const regios = pgTable("regios", {
	id: integer(),
	naam: varchar({ length: 40 }),
	rowguid: uuid(),
});

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
	eigentelwelkomlocatie: varchar({ length: 512 }),
	abbonementDoktersdienst: boolean("abbonement_doktersdienst"),
	laatstAangemeldDoktersdienst: timestamp("laatst_aangemeld_doktersdienst", { mode: 'string' }),
	laastsAfgemeldDoktersidenst: timestamp("laasts_afgemeld_doktersidenst", { mode: 'string' }),
});

export const expertises = pgTable("expertises", {
	id: serial().primaryKey().notNull(),
	naam: varchar({ length: 255 }).notNull(),
	afkorting: varchar({ length: 50 }),
	idwaarneemgroep: integer().notNull().references(() => waarneemgroepen.id),
	actief: boolean().notNull().default(true),
}, (table) => [
	index("expertises_idwaarneemgroep_idx").on(table.idwaarneemgroep),
]);

export const activiteiten = pgTable("activiteiten", {
	id: serial().primaryKey().notNull(),
	naam: varchar({ length: 255 }).notNull(),
	afkorting: varchar({ length: 50 }),
	kleur: varchar({ length: 50 }),
	icon: varchar({ length: 100 }),
	idexpertise: integer().references(() => expertises.id),
	idwaarneemgroep: integer().notNull().references(() => waarneemgroepen.id),
	actief: boolean().notNull().default(true),
}, (table) => [
	index("activiteiten_idexpertise_idx").on(table.idexpertise),
	index("activiteiten_idwaarneemgroep_idx").on(table.idwaarneemgroep),
]);

export const dagdelen = pgTable("dagdelen", {
	id: serial().primaryKey().notNull(),
	naam: varchar({ length: 50 }).notNull(),
	volgorde: integer().notNull(),
});

/**
 * A planner location belongs to one waarneemgroep. It may optionally point at the
 * legacy global `locaties` record, but it deliberately owns its planner labels and
 * visual properties so Doktersdienst location data remains untouched.
 */
export const praktijkplannerlocaties = pgTable("praktijkplannerlocaties", {
	id: serial().primaryKey().notNull(),
	idwaarneemgroep: integer().notNull().references(() => waarneemgroepen.id),
	idlocatie: integer().references(() => locaties.id),
	naam: varchar({ length: 255 }).notNull(),
	afkorting: varchar({ length: 50 }),
	kleur: varchar({ length: 50 }),
	actief: boolean().notNull().default(true),
	createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
	updatedAt: timestamp("updated_at", { mode: "string" }).notNull().defaultNow(),
}, (table) => [
	unique("praktijkplannerlocaties_group_naam_unique").on(table.idwaarneemgroep, table.naam),
	index("praktijkplannerlocaties_group_idx").on(table.idwaarneemgroep),
]);

export const activiteitSpecificaties = pgTable("activiteitspecificaties", {
	id: serial().primaryKey().notNull(),
	idactiviteit: integer().notNull().references(() => activiteiten.id, { onDelete: "cascade" }),
	naam: varchar({ length: 255 }).notNull(),
	afkorting: varchar({ length: 50 }),
	kleur: varchar({ length: 50 }),
	actief: boolean().notNull().default(true),
	createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
	updatedAt: timestamp("updated_at", { mode: "string" }).notNull().defaultNow(),
}, (table) => [
	unique("activiteitspecificaties_activity_naam_unique").on(table.idactiviteit, table.naam),
	index("activiteitspecificaties_activity_idx").on(table.idactiviteit),
]);

export const planning = pgTable("planning", {
	id: serial().primaryKey().notNull(),
	idwaarneemgroep: integer().notNull().references(() => waarneemgroepen.id),
	iddeelnemer: integer().notNull().references(() => deelnemers.id),
	datum: date().notNull(),
	iddagdeel: integer().notNull().references(() => dagdelen.id),
	idactiviteit: integer().references(() => activiteiten.id),
	idactiviteitspecificatie: integer().references(() => activiteitSpecificaties.id),
	idlocatie: integer().references(() => locaties.id),
	idplannerlocatie: integer().references(() => praktijkplannerlocaties.id),
	/**
	 * Vrije tekst van de planner bij deze ene fiche. Null als er niets bij staat; een lege
	 * opmerking bestaat niet. Gaat mee met de regel: dagdeel leeg is opmerking weg.
	 */
	opmerking: text(),
	createdBy: integer("created_by").references(() => deelnemers.id),
	updatedBy: integer("updated_by").references(() => deelnemers.id),
	createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
	updatedAt: timestamp("updated_at", { mode: "string" }).notNull().defaultNow(),
	version: integer().notNull().default(1),
}, (table) => [
	unique("planning_group_participant_date_daypart_unique").on(
		table.idwaarneemgroep,
		table.iddeelnemer,
		table.datum,
		table.iddagdeel
	),
	index("planning_group_date_daypart_idx").on(table.idwaarneemgroep, table.datum, table.iddagdeel),
]);

export const planningtaak = pgTable("planningtaak", {
	idplanning: integer().notNull().references(() => planning.id, { onDelete: "cascade" }),
	idtaaktype: integer().notNull().references(() => taaktypen.id, { onDelete: "restrict" }),
	positie: smallint().notNull(),
}, (table) => [
	primaryKey({ columns: [table.idplanning, table.idtaaktype] }),
	unique("planningtaak_idplanning_positie_unique").on(table.idplanning, table.positie),
	check("planningtaak_positie_check", sql`${table.positie} >= 1 AND ${table.positie} <= 3`),
]);

export const deelnemerexpertises = pgTable("deelnemerexpertises", {
	iddeelnemer: integer().notNull().references(() => deelnemers.id),
	idexpertise: integer().notNull().references(() => expertises.id),
}, (table) => [
	primaryKey({ columns: [table.iddeelnemer, table.idexpertise] }),
]);

export const beschikbaarheidstypen = pgTable("beschikbaarheidstypen", {
	id: serial().primaryKey().notNull(),
	idwaarneemgroep: integer().notNull().references(() => waarneemgroepen.id),
	naam: varchar({ length: 100 }).notNull(),
	code: varchar({ length: 50 }).notNull(),
	kleur: varchar({ length: 50 }),
	icon: varchar({ length: 100 }),
	type: varchar({ length: 30 }).notNull().default("fte"),
	actief: boolean().notNull().default(true),
}, (table) => [
	unique("beschikbaarheidstypen_group_code_unique").on(table.idwaarneemgroep, table.code),
	index("beschikbaarheidstypen_group_idx").on(table.idwaarneemgroep),
]);

/** Optional FTE/availability marker layered on top of one activity planning slot. */
export const planningbeschikbaarheid = pgTable("planningbeschikbaarheid", {
	idplanning: integer().primaryKey().notNull().references(() => planning.id, { onDelete: "cascade" }),
	idbeschikbaarheidstype: integer().notNull().references(() => beschikbaarheidstypen.id, { onDelete: "restrict" }),
	updatedBy: integer("updated_by").references(() => deelnemers.id),
	updatedAt: timestamp("updated_at", { mode: "string" }).notNull().defaultNow(),
});

export const afwezigheidstypen = pgTable("afwezigheidstypen", {
	id: serial().primaryKey().notNull(),
	idwaarneemgroep: integer().notNull().references(() => waarneemgroepen.id),
	naam: varchar({ length: 100 }).notNull(),
	code: varchar({ length: 50 }).notNull(),
	kleur: varchar({ length: 50 }),
	icon: varchar({ length: 100 }),
	actief: boolean().notNull().default(true),
}, (table) => [
	unique("afwezigheidstypen_group_code_unique").on(table.idwaarneemgroep, table.code),
	index("afwezigheidstypen_group_idx").on(table.idwaarneemgroep),
]);

/**
 * Absences are a dedicated overlay rather than an activity-planning field. This
 * allows an absence to coexist with a read-only activity history and makes annual
 * balances derivable from confirmed absence slots.
 */
export const planningafwezigheden = pgTable("planningafwezigheden", {
	id: serial().primaryKey().notNull(),
	idwaarneemgroep: integer().notNull().references(() => waarneemgroepen.id),
	iddeelnemer: integer().notNull().references(() => deelnemers.id),
	datum: date().notNull(),
	iddagdeel: integer().notNull().references(() => dagdelen.id),
	idafwezigheidstype: integer().notNull().references(() => afwezigheidstypen.id, { onDelete: "restrict" }),
	isVoorlopig: boolean("is_voorlopig").notNull().default(false),
	createdBy: integer("created_by").references(() => deelnemers.id),
	updatedBy: integer("updated_by").references(() => deelnemers.id),
	createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
	updatedAt: timestamp("updated_at", { mode: "string" }).notNull().defaultNow(),
	version: integer().notNull().default(1),
}, (table) => [
	unique("planningafwezigheden_group_participant_date_daypart_unique").on(
		table.idwaarneemgroep,
		table.iddeelnemer,
		table.datum,
		table.iddagdeel
	),
	index("planningafwezigheden_group_date_daypart_idx").on(table.idwaarneemgroep, table.datum, table.iddagdeel),
]);

export const praktijkplannerdienstvoorkeuren = pgTable("praktijkplannerdienstvoorkeuren", {
	id: serial().primaryKey().notNull(),
	idwaarneemgroep: integer().notNull().references(() => waarneemgroepen.id),
	iddeelnemer: integer().notNull().references(() => deelnemers.id),
	datum: date().notNull(),
	iddagdeel: integer().notNull().references(() => dagdelen.id),
	/** 'graag' of 'liever_niet'; de database bewaakt dat met een check. */
	voorkeur: varchar({ length: 20 }).notNull(),
	/** Waar is aangevraagd door de arts, onwaar is vastgelegd door de planner. */
	isVoorlopig: boolean("is_voorlopig").notNull().default(true),
	createdBy: integer("created_by").references(() => deelnemers.id),
	updatedBy: integer("updated_by").references(() => deelnemers.id),
	createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
	updatedAt: timestamp("updated_at", { mode: "string" }).notNull().defaultNow(),
	version: integer().notNull().default(1),
}, (table) => [
	unique("dienstvoorkeuren_deelnemer_datum_dagdeel_unique").on(
		table.idwaarneemgroep,
		table.iddeelnemer,
		table.datum,
		table.iddagdeel
	),
	index("dienstvoorkeuren_groep_datum_idx").on(table.idwaarneemgroep, table.datum, table.iddagdeel),
]);

export const afwezigheidsjaarbudgetten = pgTable("afwezigheidsjaarbudgetten", {
	id: serial().primaryKey().notNull(),
	idwaarneemgroep: integer().notNull().references(() => waarneemgroepen.id),
	iddeelnemer: integer().notNull().references(() => deelnemers.id),
	idafwezigheidstype: integer().notNull().references(() => afwezigheidstypen.id, { onDelete: "restrict" }),
	jaar: integer().notNull(),
	beginsaldo: integer().notNull().default(0),
	budget: integer().notNull().default(0),
	correctie: integer().notNull().default(0),
	updatedBy: integer("updated_by").references(() => deelnemers.id),
	updatedAt: timestamp("updated_at", { mode: "string" }).notNull().defaultNow(),
}, (table) => [
	unique("afwezigheidsjaarbudgetten_unique").on(
		table.idwaarneemgroep,
		table.iddeelnemer,
		table.idafwezigheidstype,
		table.jaar
	),
	index("afwezigheidsjaarbudgetten_group_participant_year_idx").on(
		table.idwaarneemgroep,
		table.iddeelnemer,
		table.jaar
	),
]);

export const afwezigheidsjaarnotities = pgTable("afwezigheidsjaarnotities", {
	idwaarneemgroep: integer().notNull().references(() => waarneemgroepen.id),
	iddeelnemer: integer().notNull().references(() => deelnemers.id),
	jaar: integer().notNull(),
	notitie: text().notNull().default(""),
	updatedBy: integer("updated_by").references(() => deelnemers.id),
	updatedAt: timestamp("updated_at", { mode: "string" }).notNull().defaultNow(),
}, (table) => [
	primaryKey({ columns: [table.idwaarneemgroep, table.iddeelnemer, table.jaar] }),
]);

export const planningherhalingen = pgTable("planningherhalingen", {
	id: serial().primaryKey().notNull(),
	idwaarneemgroep: integer().notNull().references(() => waarneemgroepen.id),
	iddeelnemer: integer().notNull().references(() => deelnemers.id),
	startdatum: date().notNull(),
	einddatum: date().notNull(),
	frequentieWeken: smallint("frequentie_weken").notNull(),
	/**
	 * Monday of the week the planner repeated. Null on series created before this column
	 * existed: the source week cannot be derived afterwards, and guessing "the week before
	 * startdatum" is wrong for anyone who left a gap, so those series simply have no week
	 * to show.
	 */
	bronstartdatum: date(),
	/**
	 * A one-off week copy, not a recurrence. Copying borrows this table because
	 * planningherhalingslots.idherhaling is NOT NULL and part of the primary key, so a
	 * copied slot cannot be linked without a parent row here. Without this flag those
	 * rows are indistinguishable from a real series: a copy stores
	 * startdatum = einddatum with frequentie 1, and the repeat modal allows exactly that
	 * shape for a genuine one-week series too.
	 */
	isKopie: boolean("is_kopie").notNull().default(false),
	createdBy: integer("created_by").references(() => deelnemers.id),
	createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
	updatedBy: integer("updated_by").references(() => deelnemers.id),
	updatedAt: timestamp("updated_at", { mode: "string" }).notNull().defaultNow(),
}, (table) => [
	check("planningherhalingen_frequency_check", sql`${table.frequentieWeken} >= 1 AND ${table.frequentieWeken} <= 3`),
	check("planningherhalingen_range_check", sql`${table.einddatum} >= ${table.startdatum}`),
	index("planningherhalingen_group_participant_idx").on(table.idwaarneemgroep, table.iddeelnemer),
]);

/** Links every materialized recurring slot to its recurrence series. */
export const planningherhalingslots = pgTable("planningherhalingslots", {
	idherhaling: integer().notNull().references(() => planningherhalingen.id, { onDelete: "cascade" }),
	idplanning: integer().notNull().references(() => planning.id, { onDelete: "cascade" }),
	reeksdatum: date().notNull(),
	isBronslot: boolean("is_bronslot").notNull().default(false),
	isUitzondering: boolean("is_uitzondering").notNull().default(false),
	uitzonderingAt: timestamp("uitzondering_at", { mode: "string" }),
}, (table) => [
	primaryKey({ columns: [table.idherhaling, table.idplanning] }),
	unique("planningherhalingslots_planning_unique").on(table.idplanning),
]);

/** Tombstones for cleared/skipped occurrences of a recurrence series. */
export const planningherhalinguitzonderingen = pgTable("planningherhalinguitzonderingen", {
	id: serial().primaryKey().notNull(),
	idherhaling: integer().notNull().references(() => planningherhalingen.id, { onDelete: "cascade" }),
	reeksdatum: date().notNull(),
	iddagdeel: integer().notNull().references(() => dagdelen.id),
	type: varchar({ length: 30 }).notNull(),
	createdBy: integer("created_by").references(() => deelnemers.id),
	createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
}, (table) => [
	unique("planningherhalinguitzonderingen_series_date_daypart_unique").on(
		table.idherhaling,
		table.reeksdatum,
		table.iddagdeel
	),
]);

export const capaciteitsregimes = pgTable("capaciteitsregimes", {
	id: serial().primaryKey().notNull(),
	idwaarneemgroep: integer().notNull().references(() => waarneemgroepen.id, { onDelete: "cascade" }),
	naam: varchar({ length: 60 }).notNull(),
	updatedBy: integer("updated_by").references(() => deelnemers.id),
	updatedAt: timestamp("updated_at", { mode: "string" }).notNull().defaultNow(),
}, (table) => [
	unique("capaciteitsregimes_group_naam_unique").on(table.idwaarneemgroep, table.naam),
	index("capaciteitsregimes_group_idx").on(table.idwaarneemgroep),
]);

export const capaciteitsregimeweken = pgTable("capaciteitsregimeweken", {
	idwaarneemgroep: integer().notNull().references(() => waarneemgroepen.id, { onDelete: "cascade" }),
	idregime: integer().notNull().references(() => capaciteitsregimes.id, { onDelete: "cascade" }),
	maandag: date().notNull(),
	updatedBy: integer("updated_by").references(() => deelnemers.id),
	updatedAt: timestamp("updated_at", { mode: "string" }).notNull().defaultNow(),
}, (table) => [
	// De sleutel op de week, niet op het regime: zo kan een week nooit aan twee regimes hangen.
	primaryKey({ name: "capaciteitsregimeweken_group_maandag_pk", columns: [table.idwaarneemgroep, table.maandag] }),
	check("capaciteitsregimeweken_maandag_check", sql`EXTRACT(ISODOW FROM ${table.maandag}) = 1`),
	index("capaciteitsregimeweken_regime_idx").on(table.idregime),
]);

export const capaciteitsjablonen = pgTable("capaciteitsjablonen", {
	id: serial().primaryKey().notNull(),
	idwaarneemgroep: integer().notNull().references(() => waarneemgroepen.id),
	// Leeg geldt voor de hele waarneemgroep, voor taken die op elke locatie mogen gebeuren.
	idplannerlocatie: integer().references(() => praktijkplannerlocaties.id, { onDelete: "cascade" }),
	weekdag: smallint().notNull(),
	iddagdeel: integer().notNull().references(() => dagdelen.id),
	// Leeg is de normale week. Een regime vervangt die week voor de weken die eraan hangen.
	idregime: integer().references(() => capaciteitsregimes.id, { onDelete: "cascade" }),
	aantalDeelnemers: integer("aantal_deelnemers").notNull().default(0),
	updatedBy: integer("updated_by").references(() => deelnemers.id),
	updatedAt: timestamp("updated_at", { mode: "string" }).notNull().defaultNow(),
}, (table) => [
	// Postgres kapt een naam boven 63 tekens af, dus die past hier niet voluit.
	unique("capaciteitsjablonen_group_location_weekday_daypart_regime_uq")
		.on(
			table.idwaarneemgroep,
			table.idplannerlocatie,
			table.weekdag,
			table.iddagdeel,
			table.idregime
		)
		// Zonder dit telt Postgres twee normale weken als verschillend, want hun idregime is NULL.
		.nullsNotDistinct(),
	check("capaciteitsjablonen_weekdag_check", sql`${table.weekdag} >= 1 AND ${table.weekdag} <= 7`),
	check("capaciteitsjablonen_participants_check", sql`${table.aantalDeelnemers} >= 0`),
	index("capaciteitsjablonen_group_location_idx").on(table.idwaarneemgroep, table.idplannerlocatie),
	index("capaciteitsjablonen_regime_idx").on(table.idregime),
]);

export const capaciteitsjabloonexpertises = pgTable("capaciteitsjabloonexpertises", {
	idcapaciteitsjabloon: integer().notNull().references(() => capaciteitsjablonen.id, { onDelete: "cascade" }),
	idexpertise: integer().notNull().references(() => expertises.id, { onDelete: "restrict" }),
	aantal: integer().notNull().default(0),
}, (table) => [
	primaryKey({ columns: [table.idcapaciteitsjabloon, table.idexpertise] }),
	check("capaciteitsjabloonexpertises_count_check", sql`${table.aantal} >= 0`),
]);

export const capaciteitsjabloontaken = pgTable("capaciteitsjabloontaken", {
	idcapaciteitsjabloon: integer().notNull().references(() => capaciteitsjablonen.id, { onDelete: "cascade" }),
	idtaaktype: integer().notNull().references(() => taaktypen.id, { onDelete: "restrict" }),
	aantal: integer().notNull().default(0),
}, (table) => [
	primaryKey({ columns: [table.idcapaciteitsjabloon, table.idtaaktype] }),
	check("capaciteitsjabloontaken_count_check", sql`${table.aantal} >= 0`),
]);

export const capaciteitsjabloonactiviteiten = pgTable("capaciteitsjabloonactiviteiten", {
	idcapaciteitsjabloon: integer().notNull().references(() => capaciteitsjablonen.id, { onDelete: "cascade" }),
	idactiviteit: integer().notNull().references(() => activiteiten.id, { onDelete: "restrict" }),
	aantal: integer().notNull().default(0),
}, (table) => [
	primaryKey({ columns: [table.idcapaciteitsjabloon, table.idactiviteit] }),
	check("capaciteitsjabloonactiviteiten_count_check", sql`${table.aantal} >= 0`),
]);

export const capaciteitsjabloonspecificaties = pgTable("capaciteitsjabloonspecificaties", {
	idcapaciteitsjabloon: integer().notNull().references(() => capaciteitsjablonen.id, { onDelete: "cascade" }),
	idactiviteitspecificatie: integer().notNull().references(() => activiteitSpecificaties.id, { onDelete: "restrict" }),
	aantal: integer().notNull().default(0),
}, (table) => [
	primaryKey({ columns: [table.idcapaciteitsjabloon, table.idactiviteitspecificatie] }),
	check("capaciteitsjabloonspecificaties_count_check", sql`${table.aantal} >= 0`),
]);

/**
 * Per-waarneemgroep weekday × daypart matrix: which slots are schedulable.
 * Empty set for a group means all combinations are schedulable (backward compatible).
 */
export const praktijkplannerdagdelen = pgTable("praktijkplannerdagdelen", {
	id: serial().primaryKey().notNull(),
	idwaarneemgroep: integer().notNull().references(() => waarneemgroepen.id, { onDelete: "cascade" }),
	weekdag: smallint().notNull(),
	iddagdeel: integer().notNull().references(() => dagdelen.id),
	actief: boolean().notNull().default(true),
	updatedBy: integer("updated_by").references(() => deelnemers.id),
	updatedAt: timestamp("updated_at", { mode: "string" }).notNull().defaultNow(),
}, (table) => [
	unique("praktijkplannerdagdelen_group_weekday_daypart_unique").on(
		table.idwaarneemgroep,
		table.weekdag,
		table.iddagdeel
	),
	check("praktijkplannerdagdelen_weekdag_check", sql`${table.weekdag} >= 1 AND ${table.weekdag} <= 7`),
	index("praktijkplannerdagdelen_group_idx").on(table.idwaarneemgroep),
]);

/**
 * Optional per-deelnemer weekday × daypart availability, constrained by the group matrix.
 * Empty set for a deelnemer means they inherit the waarneemgroep schedule.
 */
export const praktijkplannerdeelnemerdagdelen = pgTable("praktijkplannerdeelnemerdagdelen", {
	id: serial().primaryKey().notNull(),
	idwaarneemgroep: integer().notNull().references(() => waarneemgroepen.id, { onDelete: "cascade" }),
	iddeelnemer: integer().notNull().references(() => deelnemers.id, { onDelete: "cascade" }),
	weekdag: smallint().notNull(),
	iddagdeel: integer().notNull().references(() => dagdelen.id),
	actief: boolean().notNull().default(true),
	updatedBy: integer("updated_by").references(() => deelnemers.id),
	updatedAt: timestamp("updated_at", { mode: "string" }).notNull().defaultNow(),
}, (table) => [
	unique("praktijkplannerdeelnemerdagdelen_unique").on(
		table.idwaarneemgroep,
		table.iddeelnemer,
		table.weekdag,
		table.iddagdeel
	),
	check("praktijkplannerdeelnemerdagdelen_weekdag_check", sql`${table.weekdag} >= 1 AND ${table.weekdag} <= 7`),
	index("praktijkplannerdeelnemerdagdelen_group_participant_idx").on(
		table.idwaarneemgroep,
		table.iddeelnemer
	),
]);

export const praktijkplannerweergavevoorkeuren = pgTable("praktijkplannerweergavevoorkeuren", {
	iddeelnemer: integer().notNull().references(() => deelnemers.id, { onDelete: "cascade" }),
	idwaarneemgroep: integer().notNull().references(() => waarneemgroepen.id, { onDelete: "cascade" }),
	toonDag: boolean("toon_dag").notNull().default(true),
	toonNacht: boolean("toon_nacht").notNull().default(false),
	updatedAt: timestamp("updated_at", { mode: "string" }).notNull().defaultNow(),
}, (table) => [
	primaryKey({ columns: [table.iddeelnemer, table.idwaarneemgroep] }),
]);

export const praktijkplanneremaillog = pgTable("praktijkplanneremaillog", {
	id: serial().primaryKey().notNull(),
	idwaarneemgroep: integer().notNull().references(() => waarneemgroepen.id),
	iddeelnemer: integer().references(() => deelnemers.id),
	type: varchar({ length: 30 }).notNull(),
	ontvanger: varchar({ length: 255 }).notNull(),
	onderwerp: varchar({ length: 255 }).notNull(),
	resendId: varchar("resend_id", { length: 255 }),
	verstuurdDoor: integer("verstuurd_door").references(() => deelnemers.id),
	verstuurdOp: timestamp("verstuurd_op", { mode: "string" }).notNull().defaultNow(),
});
