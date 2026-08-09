// Shared between the self-profile form (client) and updateOwnProfile
// (a "use server" file, which may only export async functions - a plain
// constant has to live outside it) so both sides agree on one number,
// matching the DB check constraint in supabase/profile_fields_v2.sql.
export const BIO_MAX_LENGTH = 200;
