-- =====================================================================
--  One-time migration: German schema → English schema.
--  1. Run this file in Supabase → SQL Editor.
--  2. Then run setup.sql (creates the new functions, policies and seats).
--  3. Push the new code. The CMS converts the content JSON to format 2
--     the first time an editor signs in; until then the game converts it on the fly.
--  Content, editors and history are kept. Running player pages (QR links) end.
--  Safe to run more than once.
-- =====================================================================

do $$
begin
  -- tables
  if to_regclass('public.inhalt') is not null and to_regclass('public.content') is null then
    alter table public.inhalt rename to content;
  end if;
  if to_regclass('public.redaktion') is not null and to_regclass('public.editors') is null then
    alter table public.redaktion rename to editors;
  end if;
  if to_regclass('public.verlauf') is not null and to_regclass('public.history') is null then
    alter table public.verlauf rename to history;
  end if;

  -- columns
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'content' and column_name = 'daten') then
    alter table public.content rename column daten to data;
    alter table public.content rename column geaendert_am to updated_at;
    alter table public.content rename column geaendert_von to updated_by;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'editors' and column_name = 'hinzugefuegt_am') then
    alter table public.editors rename column hinzugefuegt_am to added_at;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'history' and column_name = 'wann') then
    alter table public.history rename column wann to at;
    alter table public.history rename column wer to who;
    alter table public.history rename column pfad to path;
    alter table public.history rename column art to kind;
    update public.history set kind = case kind
      when 'geaendert' then 'changed' when 'geloescht' then 'deleted' when 'importiert' then 'imported'
      when 'hinzugefuegt' then 'added' when 'entfernt' then 'removed' else kind end;
  end if;
end $$;

-- old policies (they moved with the renamed tables)
drop policy if exists "Inhalt ist oeffentlich lesbar" on public.content;
drop policy if exists "Redaktion sieht das Team" on public.editors;
drop policy if exists "Redaktion sieht den Verlauf" on public.history;

-- old functions, whatever their exact signatures were
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'ist_redaktion', 'redaktion_pruefen', 'verlauf_notieren', 'inhalt_setzen', 'inhalt_loeschen', 'inhalt_ersetzen',
      'redaktion_hinzufuegen', 'redaktion_entfernen', 'tisch_setzen', 'tisch_lesen', 'tisch_status', 'partie_loeschen')
  loop
    execute 'drop function ' || f.sig || ' cascade';
  end loop;
end $$;

-- old player seats: only short-lived game data, recreated by setup.sql
drop table if exists public.tische cascade;
drop table if exists public.partien cascade;
