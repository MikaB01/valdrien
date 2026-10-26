// Supabase connection used by game and CMS:
// Supabase → Project Settings → API: "Project URL" → url, "anon" / "public" key → anonKey.
// The anon key is public and may be committed; editing requires sign-in plus an entry in "editors".
// Never put the service_role key here. With both values empty the CMS runs in preview mode.
window.VALDRIEN_CONNECTION = {
  url: "https://fzqaypnhbixtznzczqxl.supabase.co/rest/v1/",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6cWF5cG5oYml4dHpuemN6cXhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwMjM0NzAsImV4cCI6MjEwODU5OTQ3MH0.IJY8NDujoj1R2tcsoWjf-Y9FP2DcEXUs2Ln5Z7RNfJA"
};
