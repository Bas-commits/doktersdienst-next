import { relations } from "drizzle-orm/relations";
import { waarneemgroepen, waarneemgroepdeelnemers } from "./schema";

export const waarneemgroepenRelations = relations(waarneemgroepen, ({ many }) => ({
  waarneemgroepdeelnemers: many(waarneemgroepdeelnemers),
}));

export const waarneemgroepdeelnemersRelations = relations(waarneemgroepdeelnemers, ({ one }) => ({
  waarneemgroep: one(waarneemgroepen, {
    fields: [waarneemgroepdeelnemers.idwaarneemgroep],
    references: [waarneemgroepen.id],
  }),
}));

