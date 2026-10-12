// This is a public browser key. Authorization is enforced by the database policies.
window.SERVICE_CONFIG = Object.freeze({
  supabaseUrl: 'https://jbvrubypklsoepffbwoh.supabase.co',
  publishableKey: 'sb_publishable_BrO52zr72ttHhYlPoPh5OA_nQCQ8rfn',
  siteUrl: 'https://vasileveldar.github.io/schedule/',
  timeZone: 'Asia/Qyzylorda'
});
window.serviceClient = window.supabase.createClient(
  window.SERVICE_CONFIG.supabaseUrl,
  window.SERVICE_CONFIG.publishableKey,
  {auth: {persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce'}}
);
