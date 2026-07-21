/**
 * DEPRECATED SHIM — Supabase was removed in the ManyOrder consolidation.
 *
 * A few screens (Settings, Sidebar sign-out) still import this module; they
 * are migrated to lib/api.ts in Batches 2–4. Until then this shim keeps the
 * build green: reads resolve to an empty error result, writes fail loudly in
 * the console, and auth.signOut() delegates to the real JWT logout.
 */

type LogoutHandler = () => void;
let logoutHandler: LogoutHandler | null = null;

/** Called by AuthProvider so legacy `supabase.auth.signOut()` triggers the real logout. */
export function registerSupabaseSignOut(handler: LogoutHandler) {
  logoutHandler = handler;
}

const deprecatedResult = {
  data: null,
  error: { message: 'Supabase was removed — this screen is migrated to the REST API in a later batch.' },
};

function chain(table: string): any {
  const warn = () =>
    console.warn(`[manyorder] supabase.from('${table}') is deprecated — use lib/api.ts instead.`);
  const c: any = {
    select: () => c,
    insert: () => c,
    update: () => c,
    delete: () => c,
    eq: () => c,
    order: () => c,
    single: async () => (warn(), deprecatedResult),
    then: (resolve: (v: typeof deprecatedResult) => void) => {
      warn();
      resolve(deprecatedResult);
    },
  };
  return c;
}

export const supabase = {
  auth: {
    async signOut() {
      logoutHandler?.();
      return { error: null };
    },
    async getSession() {
      return { data: { session: null } };
    },
    onAuthStateChange() {
      return { data: { subscription: { unsubscribe() {} } } };
    },
  },
  from: (table: string) => chain(table),
};
