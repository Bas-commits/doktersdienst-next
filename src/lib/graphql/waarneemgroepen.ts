/**
 * GraphQL operations and types for waarneemgroepen.
 * Keeps queries and response types in one place for reuse and easier codegen later.
 */

export const WAARNEMGROEPEN_QUERY = `
  query WaarneemgroepenList {
    waarneemgroepen {
      id
      naam
      email
      gespreksopname
    }
  }
`;

export type Waarneemgroep = {
  id: string;
  naam: string | null;
  email: string | null;
  gespreksopname: boolean | null;
};

export type WaarneemgroepenResponse = {
  waarneemgroepen: Waarneemgroep[];
};
