/**
 * Public settings built into the site.
 *
 * The Supabase publishable key is designed to be public: it only lets the site
 * talk to the project. Your stories are protected by your login and the
 * row-level-security rules in supabase/setup.sql. Never put a *secret* or
 * service_role key here.
 */
export const BUILT_IN_SUPABASE = {
  url: 'https://fwihggegyqtksjwivbrd.supabase.co',
  key: 'sb_publishable_Ha_jYuqbcxekHswusDg-Kw_VFqF224F',
};
