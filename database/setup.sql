-- =====================================================================
--  Valdrien: Supabase database setup
--  Run the whole file in Supabase → SQL Editor → New query → Run.
--  Safe to run repeatedly; existing content is never overwritten.
--  Upgrading a database from the old German schema? Run migrate-to-english.sql first.
-- =====================================================================


-- 1) Editors: who may edit content in the CMS
create table if not exists public.editors (
  email text primary key,
  added_at timestamptz not null default now()
);

insert into public.editors (email)
values (lower('mikabessel@googlemail.com'))
on conflict do nothing;


-- 2) Content: one JSON document with all adventures, publicly readable
create table if not exists public.content (
  id text primary key,
  data jsonb not null,
  version bigint not null default 1,
  updated_at timestamptz not null default now(),
  updated_by text
);


-- 3) History: who changed what (editors only)
create table if not exists public.history (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  who text,
  path text[],
  kind text not null
);


-- 4) Access rules: everyone reads content, nobody writes directly
alter table public.content enable row level security;
alter table public.editors enable row level security;
alter table public.history enable row level security;

create or replace function public.is_editor()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.editors
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

drop policy if exists "content is public" on public.content;
create policy "content is public" on public.content
  for select to anon, authenticated using (true);

drop policy if exists "editors see the team" on public.editors;
create policy "editors see the team" on public.editors
  for select to authenticated using (public.is_editor());

drop policy if exists "editors see the history" on public.history;
create policy "editors see the history" on public.history
  for select to authenticated using (public.is_editor());

revoke insert, update, delete on public.content, public.editors, public.history from anon, authenticated;


-- 5) CMS write functions. Each change touches a single field, so several
--    editors can work at the same time without overwriting each other.
--    Error messages are shown in the (German) CMS.

create or replace function public.require_editor()
returns text
language plpgsql stable security definer
set search_path = public
as $$
declare
  me text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if not public.is_editor() then
    raise exception 'Du bist nicht in der Redaktion. Bitte lass dich im CMS unter "Team" hinzufügen.'
      using errcode = '42501';
  end if;
  return me;
end;
$$;

-- same person + same field within 2 minutes = one history entry; keeps the last 1000 entries
create or replace function public.log_history(p_who text, p_path text[], p_kind text)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  last_id bigint;
begin
  select id into last_id from public.history h
    where h.who = p_who and h.path = p_path and h.kind = p_kind
      and h.at > now() - interval '2 minutes'
    order by id desc limit 1;
  if last_id is not null then
    update public.history set at = now() where id = last_id;
  else
    insert into public.history (who, path, kind) values (p_who, p_path, p_kind);
  end if;
  delete from public.history where id < (select coalesce(max(id), 0) - 1000 from public.history);
end;
$$;

-- set one field or a whole entry, e.g. path = {adventures,forest,roles,magnus,name}
create or replace function public.content_set(path text[], value jsonb)
returns bigint
language plpgsql security definer
set search_path = public
as $$
declare
  me text := public.require_editor();
  new_version bigint;
begin
  if path is null or coalesce(array_length(path, 1), 0) = 0 then
    raise exception 'Kein Feld angegeben.' using errcode = '22023';
  end if;
  if array_length(path, 1) > 1
     and (select c.data #> path[1:array_length(path, 1) - 1] from public.content c where c.id = 'valdrien') is null then
    raise exception 'Diesen Eintrag gibt es nicht mehr. Vielleicht hat ihn gerade jemand gelöscht.' using errcode = 'P0002';
  end if;
  update public.content c
     set data = jsonb_set(c.data, path, value, true),
         version = c.version + 1, updated_at = now(), updated_by = me
   where c.id = 'valdrien'
   returning c.version into new_version;
  perform public.log_history(me, path, 'changed');
  return new_version;
end;
$$;

create or replace function public.content_delete(path text[])
returns bigint
language plpgsql security definer
set search_path = public
as $$
declare
  me text := public.require_editor();
  new_version bigint;
begin
  if path is null or coalesce(array_length(path, 1), 0) < 2 then
    raise exception 'Das lässt sich so nicht löschen.' using errcode = '22023';
  end if;
  update public.content c
     set data = c.data #- path,
         version = c.version + 1, updated_at = now(), updated_by = me
   where c.id = 'valdrien'
   returning c.version into new_version;
  perform public.log_history(me, path, 'deleted');
  return new_version;
end;
$$;

-- replace everything (JSON import, format upgrade)
create or replace function public.content_replace(data jsonb)
returns bigint
language plpgsql security definer
set search_path = public
as $$
declare
  me text := public.require_editor();
  new_version bigint;
begin
  if coalesce(jsonb_typeof(content_replace.data), '') <> 'object'
     or coalesce(jsonb_typeof(content_replace.data -> 'adventures'), '') <> 'object' then
    raise exception 'Das ist keine gültige Valdrien-Inhaltsdatei.' using errcode = '22023';
  end if;
  insert into public.content (id, data, updated_by) values ('valdrien', content_replace.data, me)
  on conflict (id) do update
     set data = excluded.data, version = public.content.version + 1,
         updated_at = now(), updated_by = me
  returning version into new_version;
  perform public.log_history(me, array[]::text[], 'imported');
  return new_version;
end;
$$;

create or replace function public.editor_add(new_email text)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  me text := public.require_editor();
begin
  if new_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Das sieht nicht wie eine E-Mail-Adresse aus.' using errcode = '22023';
  end if;
  insert into public.editors (email) values (lower(trim(new_email))) on conflict do nothing;
  perform public.log_history(me, array['team', lower(trim(new_email))], 'added');
end;
$$;

create or replace function public.editor_remove(old_email text)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  me text := public.require_editor();
begin
  if (select count(*) from public.editors) <= 1 then
    raise exception 'Die letzte Person im Team kann nicht entfernt werden.' using errcode = '22023';
  end if;
  delete from public.editors where email = lower(trim(old_email));
  perform public.log_history(me, array['team', lower(trim(old_email))], 'removed');
end;
$$;

revoke execute on function public.content_set(text[], jsonb), public.content_delete(text[]),
  public.content_replace(jsonb), public.editor_add(text), public.editor_remove(text),
  public.log_history(text, text[], text), public.require_editor()
  from public, anon;
grant execute on function public.content_set(text[], jsonb), public.content_delete(text[]),
  public.content_replace(jsonb), public.editor_add(text), public.editor_remove(text)
  to authenticated;
revoke execute on function public.log_history(text, text[], text), public.require_editor() from authenticated;
grant execute on function public.is_editor() to anon, authenticated;


-- 6) Live updates: content changes are pushed to open CMS windows and games
do $$
begin
  alter publication supabase_realtime add table public.content;
exception when duplicate_object then null;
end $$;


-- 7) Player seats (no account needed). The game master phone writes one seat per
--    player; a player phone reads only its own seat via the access code in its QR link.
--    Sessions are protected by a secret only the game master phone knows.
--    Sessions older than 3 days are removed on the next write.
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.sessions (
  id text primary key,
  secret_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.seats (
  access_code text primary key,
  session_id text not null references public.sessions (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  seen_at timestamptz
);

alter table public.sessions enable row level security;
alter table public.seats enable row level security;
revoke all on public.sessions, public.seats from anon, authenticated;

create or replace function public.session_check(p_session text, p_secret text, p_create boolean)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  hash text := encode(extensions.digest(coalesce(p_secret, ''), 'sha256'), 'hex');
  stored text;
begin
  if p_session !~ '^[a-z0-9]{12,48}$' or length(coalesce(p_secret, '')) < 12 then
    raise exception 'invalid session' using errcode = '22023';
  end if;
  select secret_hash into stored from public.sessions where id = p_session;
  if stored is null and p_create then
    delete from public.sessions where created_at < now() - interval '3 days';
    insert into public.sessions (id, secret_hash) values (p_session, hash);
  elsif stored is null then
    return; -- unknown session: nothing to read or delete
  elsif stored <> hash then
    raise exception 'wrong session secret' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.seat_write(p_session text, p_secret text, p_access text, p_data jsonb)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  perform public.session_check(p_session, p_secret, true);
  if p_access !~ '^[a-z0-9]{6,24}$' or length(p_data::text) > 20000 then
    raise exception 'invalid seat' using errcode = '22023';
  end if;
  insert into public.seats (access_code, session_id, data) values (p_access, p_session, p_data)
  on conflict (access_code) do update
     set data = excluded.data, updated_at = now()
   where public.seats.session_id = excluded.session_id;
end;
$$;

create or replace function public.seat_read(p_access text)
returns jsonb
language sql security definer
set search_path = public
as $$
  update public.seats set seen_at = now() where access_code = p_access returning data;
$$;

create or replace function public.seat_status(p_session text, p_secret text)
returns table (access_code text, seen_at timestamptz)
language plpgsql security definer
set search_path = public
as $$
begin
  perform public.session_check(p_session, p_secret, false);
  return query select s.access_code, s.seen_at from public.seats s where s.session_id = p_session;
end;
$$;

create or replace function public.session_delete(p_session text, p_secret text)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  perform public.session_check(p_session, p_secret, false);
  delete from public.sessions where id = p_session;
end;
$$;

revoke execute on function public.session_check(text, text, boolean) from public, anon, authenticated;
grant execute on function public.seat_write(text, text, text, jsonb), public.seat_read(text),
  public.seat_status(text, text), public.session_delete(text, text) to anon, authenticated;


-- 8) Initial content (both adventures). Existing content stays untouched.
insert into public.content (id, data, updated_by)
values ('valdrien', $valdrien_content${"format": 2, "world": {"name": "Valdrien", "motto": "Ein Land voller Abenteuer, Geheimnisse und Gefährten, denen du nicht ganz trauen solltest."}, "adventures": {"forest": {"pos": 10, "name": "Die Prüfung der Waldgilde", "setting": "Draußen · für Wanderungen und Spaziergänge", "story": {"title": "Willkommen, Anwärter der Waldgilde!", "paragraphs": ["Tief verborgen zwischen uralten Bäumen liegt der Sitz der legendären Waldgilde. Seit Jahrhunderten beschützt sie die Bewohner des Waldes, bewahrt seine magischen Geheimnisse und stellt sich Gefahren, denen andere nicht gewachsen sind.", "Doch die Gilde nimmt nicht jeden auf. Nur wer Mut, Geschick, Verstand und Gerissenheit beweist, darf Teil ihrer Gemeinschaft werden.", "Ihr wurdet aus allen Winkeln des Landes ausgewählt, um euch der Aufnahmeprüfung zu stellen. Jeder von euch kennt seine eigenen Fähigkeiten, doch eure Mitstreiter sind Fremde. Wer ist Freund, wer Rivale? Und wer verbirgt mehr, als er preisgibt?", "Stellt euch den Prüfungen, meistert unerwartete Begegnungen und sammelt Münzen. Lernt eure Mitstreiter kennen, durchschaut ihre Absichten und beweist, dass ihr den Herausforderungen des Waldes gewachsen seid.", "Am Ende wird nur einer von euch den begehrten Titel erringen und in die Reihen der Waldgilde aufgenommen werden."], "closing": "Die Prüfung beginnt! Beweist euren Mut und zeigt dem Wald, dass ihr würdig seid!"}, "epilogue": {"title": "Die Aufnahme in die Waldgilde", "before": ["Die Prüfung ist vollbracht!", "Die Münzen sind gezählt, und es steht fest, wer gewonnen hat:"], "after": ["Mit Mut, Geschick und Verstand hast du deine Mitstreiter übertroffen und dich als würdig erwiesen.", "Im Namen der Waldgilde heißen wir dich willkommen! Mögest du ihre Geheimnisse bewahren, den Wald beschützen und viele Abenteuer bestehen.", "Herzlichen Glückwunsch, {winner}! Dein Abenteuer als Mitglied der Waldgilde beginnt jetzt!"]}, "terms": {"question": "Wer stellt sich der Prüfung?", "player": "Anwärter", "plural": "Anwärter", "dative": "Anwärtern", "finish": "Prüfung beenden"}, "roles": {"magnus": {"pos": 10, "name": "Magnus", "title": "der Mundschenk", "startingCoins": 4, "background": "Magnus sorgt dafür, dass auf keiner Reise die Kehlen trocken bleiben. Ob Wasser, Saft oder ein kräftiger Schluck aus dem Krug – er kennt den Wert guter Vorräte und einer wohlverdienten Pause.", "character": "", "traits": ["Gastfreundlich, gesellig und aufmerksam.", "Hat Getränke und Vorräte im Blick.", "Schlägt gern eine gemeinsame Trinkpause vor."], "ability": {"name": "Schatzsucher", "text": "Einmal im Spiel erhält Magnus 3 Münzen aus der Spielbank.", "mechanic": "treasureHunter"}, "task": {"name": "Münzhorter", "text": "Gib während der gesamten Partie keine Münzen aus und besitze am Ende mindestens so viele Münzen wie zu Beginn. Münzen, die du beim Raten setzt, zählen nicht als Ausgabe.", "bonus": 3}}, "elara": {"pos": 20, "name": "Elara", "title": "die Waldläuferin", "startingCoins": 5, "background": "Elara kennt die verschlungenen Wege des Waldes und bemerkt Dinge, an denen andere achtlos vorbeigehen. Sie ist unabhängig, wachsam und immer bereit, den nächsten Hinweis zu entdecken.", "character": "", "traits": ["Beobachtet aufmerksam ihre Umgebung.", "Wirkt selbstständig und orientiert sich gern.", "Entdeckt kleine Details, Wegweiser oder besondere Lichtungen."], "ability": {"name": "Pfadfinderin", "text": "Einmal im Spiel darf Elara die nächste Ereigniskarte ansehen, bevor entschieden wird, ob sie gespielt wird.", "mechanic": "pathfinder"}, "task": {"name": "Wegkundige", "text": "Fotografiere zwei unterschiedliche Wegmarkierungen oder Wanderwegschilder, ohne den Weg zu verlassen.", "bonus": 2}}, "morgana": {"pos": 30, "name": "Morgana", "title": "die Kräuterhexe", "startingCoins": 3, "background": "Morgana kennt die alten Geschichten über Pflanzen, Wurzeln und geheimnisvolle Waldgewächse. Sie beobachtet lieber erst, bevor sie handelt, und scheint für alles einen kleinen Zauber oder Rat zu kennen.", "character": "", "traits": ["Geheimnisvoll, ruhig und neugierig.", "Interessiert sich für Pflanzen, Pilze und Naturdetails.", "Gibt gern rätselhafte Ratschläge oder spricht von alten Rezepturen."], "ability": {"name": "Glücksbringerin", "text": "Einmal im Spiel kann Morgana verhindern, dass sie durch ein Ereignis Münzen verliert. Sie muss die Fähigkeit beim drohenden Verlust einsetzen.", "mechanic": "luckBringer"}, "task": {"name": "Sammlerin der Eindrücke", "text": "Mache drei Fotos: einen Baum, eine Kleinigkeit am Boden und eine besondere Aussicht.", "bonus": 3}}, "finnian": {"pos": 40, "name": "Finnian", "title": "der Wald-Barde", "startingCoins": 4, "background": "Finnian sammelt Geschichten, Legenden und Lieder, die von Generation zu Generation weitergegeben werden. Er liebt große Auftritte, dramatische Erzählungen und die kleinen Momente, aus denen später Legenden werden.", "character": "", "traits": ["Wortgewandt, kreativ und ausdrucksstark.", "Erzählt gern Geschichten oder kommentiert Ereignisse dramatisch.", "Hat oft einen Spruch, Reim oder eine passende Redewendung parat."], "ability": {"name": "Goldfinger", "text": "Einmal im Spiel darf Finnian seine Belohnung aus einem Minispiel verdoppeln, höchstens um 3 zusätzliche Münzen.", "mechanic": "goldFinger"}, "task": {"name": "Chronist", "text": "Sammle drei unterschiedliche Nachweise aus dem Abenteuer, z. B. ein Foto, eine erfüllte Aufgabe und einen gewonnenen Minispielbonus.", "bonus": 3}}, "roderick": {"pos": 50, "name": "Roderick", "title": "der Waldritter", "startingCoins": 5, "background": "Roderick hat geschworen, die Bewohner des Waldes und die Geheimnisse der Waldgilde zu beschützen. Er handelt entschlossen, nimmt Herausforderungen ernst und gibt nicht so schnell auf.", "character": "", "traits": ["Mutig, pflichtbewusst und entschlossen.", "Stellt sich gern Herausforderungen.", "Spricht von Ehre, Mut und dem Einhalten von Versprechen."], "ability": {"name": "Präzisionsmeister", "text": "Vor einem Minispiel kündigt Roderick seinen Sieg an. Schafft er es, erhält er 3 zusätzliche Münzen aus der Spielbank.", "mechanic": "marksman"}, "task": {"name": "Glücksstein", "text": "Finde einen flachen Stein, der bereits auf dem Boden liegt, und trage ihn bis zum Ende bei dir.", "bonus": 2}}, "theobald": {"pos": 60, "name": "Theobald", "title": "der Waldgelehrte", "startingCoins": 4, "background": "Theobald studiert die Legenden der Waldgilde und glaubt, dass Wissen mächtiger sein kann als jedes Schwert. Er analysiert Situationen, stellt kluge Fragen und versucht, stets einen Schritt voraus zu sein.", "character": "", "traits": ["Nachdenklich, wissbegierig und analytisch.", "Erklärt gern Zusammenhänge oder stellt ungewöhnliche Fragen.", "Wirkt, als würde er jedes Detail auf seine Bedeutung prüfen."], "ability": {"name": "Schicksalswender", "text": "Einmal im Spiel darf Theobald zwei Ereigniskarten ziehen und entscheiden, welche gespielt wird. Die andere kommt unter den Stapel.", "mechanic": "fateTurner"}, "task": {"name": "Kartograf", "text": "Mache ein Foto oder einen Screenshot der Wanderkarte bzw. deiner Route.", "bonus": 2}}, "liora": {"pos": 70, "name": "Liora", "title": "die Waldfee", "startingCoins": 3, "background": "Liora ist eng mit der Magie des Waldes verbunden. Sie wirkt verspielt und freundlich, doch hinter ihrem Lächeln steckt ein scharfer Verstand. Manchmal scheint ihr das Glück einfach in den Schoß zu fallen.", "character": "", "traits": ["Verspielt, charmant und ein wenig geheimnisvoll.", "Begeistert sich für schöne Kleinigkeiten und magische Zufälle.", "Reagiert auf Ereignisse gern mit Staunen oder schelmischen Kommentaren."], "ability": {"name": "Glücksfee", "text": "Einmal im Spiel wirft Liora eine Münze. Bei Erfolg erhält sie 4 Münzen aus der Spielbank, sonst keine. Vorher wird festgelegt, welche Seite Erfolg bedeutet.", "mechanic": "luckyFairy"}, "task": {"name": "Lichtfängerin", "text": "Fotografiere Sonnenlicht, das sichtbar durch die Bäume fällt.", "bonus": 2}}}, "minigames": {"stein-blatt-zapfen": {"pos": 10, "name": "Stein, Blatt, Zapfen", "category": "duel", "description": "Wie Schere, Stein, Papier: Der Stein zerdrückt den Zapfen, der Zapfen durchsticht das Blatt, das Blatt umhüllt den Stein. Wer zuerst 2 Runden gewinnt, siegt.", "reward": {"winner": 2}}, "blinzelduell": {"pos": 20, "name": "Blinzelduell", "category": "duel", "description": "Beide schauen sich in die Augen. Wer zuerst blinzelt, wegschaut oder lacht, verliert. Die anderen dürfen versuchen, sie zum Lachen zu bringen, aber ohne sie zu berühren.", "reward": {"winner": 2}}, "zapfenwurf": {"pos": 30, "name": "Zapfenwurf", "category": "duel", "description": "Jeder sucht sich einen Tannenzapfen vom Boden. Gemeinsam wählt ihr einen Baumstamm am Wegesrand als Ziel. Abwechselnd hat jeder drei Würfe. Wer öfter trifft, gewinnt. Nur werfen, wenn niemand in der Nähe ist, und die Zapfen danach zurücklegen.", "reward": {"winner": 2}}, "wortgefecht": {"pos": 40, "name": "Wortgefecht", "category": "duel", "description": "Ihr nennt abwechselnd ein Tier des Waldes. Wer länger als 5 Sekunden überlegt oder etwas wiederholt, verliert.", "reward": {"winner": 2, "loser": -1}}, "der-schnellste-blick": {"pos": 50, "name": "Der schnellste Blick", "category": "duel", "description": "Die anderen nennen etwas, das am Wegesrand zu finden ist, zum Beispiel »etwas Rotes« oder »ein Blatt mit Loch«. Wer es zuerst entdeckt und zeigt, gewinnt. Den Weg nicht verlassen!", "reward": {"winner": 2}}, "schrittschaetzer": {"pos": 60, "name": "Schrittschätzer", "category": "all", "description": "Wählt einen Baum oder Punkt am Weg. Jeder schätzt, wie viele Schritte es bis dorthin sind. Einer zählt beim Gehen mit. Wer am nächsten dran ist, gewinnt.", "reward": {"winner": 2}}, "welches-tier-bin-ich": {"pos": 70, "name": "Welches Tier bin ich?", "category": "all", "description": "Einer denkt sich ein Tier des Waldes aus, die anderen stellen reihum Ja-Nein-Fragen. Wer es errät, gewinnt. Nach 20 Fragen ohne Treffer gewinnt der, der es sich ausgedacht hat.", "reward": {"winner": 2}}, "das-gedaechtnis-des-waldes": {"pos": 80, "name": "Das Gedächtnis des Waldes", "category": "all", "description": "Der Erste sagt »Im Wald fand ich …« und nennt etwas. Jeder wiederholt alles Bisherige und fügt etwas hinzu. Wer etwas vergisst oder durcheinanderbringt, scheidet aus. Der Letzte gewinnt.", "reward": {"winner": 3}}, "das-gildenzeichen": {"pos": 90, "name": "Das Gildenzeichen", "category": "all", "description": "Alle zählen gemeinsam bis drei und zeigen dann mit den Fingern eine Zahl von 0 bis 5. Gewonnen hat, wer die höchste Zahl zeigt, die sonst niemand gezeigt hat. Gibt es keinen, wird wiederholt.", "reward": {"winner": 2}}, "der-hoechste-turm": {"pos": 100, "name": "Der höchste Turm", "category": "all", "description": "Jeder baut in einer Minute aus Steinchen und Zapfen vom Wegesrand einen Turm. Der höchste Turm, der noch steht, gewinnt. Danach wieder abbauen.", "reward": {"winner": 2}}, "der-waldrichter": {"pos": 110, "name": "Der Waldrichter", "category": "all", "description": "Jeder sucht in zwei Minuten den ungewöhnlichsten Gegenstand am Boden, ohne den Weg zu verlassen. Wer die wenigsten Münzen hat, spielt nicht mit, sondern ist Richter und kürt den Sieger.", "reward": {"winner": 2, "judge": 1}}, "ein-langer-atem": {"pos": 120, "name": "Ein langer Atem", "category": "all", "description": "Alle holen gleichzeitig Luft und summen. Wer am längsten durchhält, gewinnt.", "reward": {"winner": 2}}, "der-faehrtenleser": {"pos": 130, "name": "Der Fährtenleser", "category": "oneVsAll", "description": "Der Einzelne versteckt einen kleinen Stein in einer Hand hinter dem Rücken. Die anderen einigen sich gemeinsam auf links oder rechts. Drei Runden. Errät die Gruppe mindestens 2 von 3, gewinnt sie.", "reward": {"solo": 3, "group": 1}}, "die-geschichte-des-barden": {"pos": 140, "name": "Die Geschichte des Barden", "category": "oneVsAll", "description": "Die Gruppe zeigt dem Einzelnen drei Dinge vom Wegesrand. Er muss in einer Minute eine Geschichte erzählen, in der alle drei vorkommen.", "reward": {"solo": 3, "fail": -1}}, "der-waechter-der-bruecke": {"pos": 150, "name": "Der Wächter der Brücke", "category": "oneVsAll", "description": "Der Einzelne denkt an etwas, das alle gerade sehen können. Die Gruppe hat zusammen 10 Ja-Nein-Fragen, um es zu erraten.", "reward": {"solo": 3, "group": 1}}, "pantomime-des-waldes": {"pos": 160, "name": "Pantomime des Waldes", "category": "team", "description": "Abwechselnd stellt ein Spieler etwas aus dem Wald pantomimisch dar, zum Beispiel ein Tier oder einen Baum. Sein Team hat 30 Sekunden zum Raten. Nach drei Runden pro Team gewinnt das Team mit mehr Treffern.", "reward": {"team": 1}}, "gemeinsam-schaetzen": {"pos": 170, "name": "Gemeinsam schätzen", "category": "team", "description": "Wählt einen Baum oder Punkt am Weg. Jedes Team einigt sich auf eine Schätzung, wie viele Schritte es bis dorthin sind. Einer zählt beim Gehen mit. Das Team, das näher dran ist, gewinnt.", "reward": {"team": 1}}, "die-zapfenjagd": {"pos": 180, "name": "Die Zapfenjagd", "category": "team", "description": "Jedes Team sammelt zwei Minuten lang Tannenzapfen, die am Wegesrand liegen, ohne den Weg zu verlassen. Das Team mit mehr Zapfen gewinnt. Danach alles zurücklegen.", "reward": {"team": 2}}, "das-waldalphabet": {"pos": 190, "name": "Das Waldalphabet", "category": "team", "description": "Die Teams nennen abwechselnd etwas aus dem Wald nach dem Alphabet: A wie Ameise, B wie Buche … Wer nicht weiterweiß, verliert. Schwierige Buchstaben wie Q oder X dürft ihr überspringen.", "reward": {"team": 1}}, "der-riese-und-die-zwerge": {"pos": 200, "name": "Der Riese und die Zwerge", "category": "uneven", "description": "Der Riese nennt in 45 Sekunden so viele Waldwörter wie möglich. Danach nennen die zwei Zwerge abwechselnd Wörter, aber nur 30 Sekunden lang. Wer mehr schafft, gewinnt.", "reward": {"single": 3, "pair": 2, "singleName": "Riese", "pairName": "Zwerge"}}}, "events": {"goldregen": {"pos": 10, "name": "Goldregen", "category": "Segen", "visibility": "public", "description": "Ein Sonnenstrahl lässt etwas im Laub glitzern. Alle erhalten 1 Münze aus der Spielbank.", "effect": "goldRain"}, "der-steuereintreiber": {"pos": 20, "name": "Der Steuereintreiber", "category": "Fluch", "visibility": "public", "description": "Ein Bote des Fürsten verlangt seinen Anteil. Alle zahlen 1 Münze an die Spielbank. Wer keine Münze hat, kommt davon.", "effect": "tax"}, "gunst-der-waldgeister": {"pos": 30, "name": "Gunst der Waldgeister", "category": "Segen", "visibility": "public", "description": "Die Geister helfen den Schwachen. Wer die wenigsten Münzen hat, erhält 3 Münzen. Bei Gleichstand sind alle Gleichplatzierten betroffen.", "effect": "favor"}, "neid-der-gilde": {"pos": 40, "name": "Neid der Gilde", "category": "Fluch", "visibility": "public", "description": "Wer die meisten Münzen hat, muss 2 davon an den Spieler mit den wenigsten Münzen abgeben. Bei Gleichstand sind alle Gleichplatzierten betroffen. Jeder der Reichsten gibt 2 ab, jeder der Ärmsten erhält 2.", "effect": "envy"}, "entlarvt": {"pos": 50, "name": "Entlarvt!", "category": "Fluch", "visibility": "public", "description": "Wer sein Geheimnis verloren hat, ist verwundbar. Alle, deren Rolle schon erraten wurde, verlieren 1 Münze.", "effect": "exposed"}, "meister-der-tarnung": {"pos": 60, "name": "Meister der Tarnung", "category": "Segen", "visibility": "public", "description": "Alle, deren Rolle noch nicht erraten wurde, erhalten 1 Münze.", "effect": "disguise"}, "das-duell-an-der-bruecke": {"pos": 70, "name": "Das Duell an der Brücke", "category": "Duell", "visibility": "public", "description": "Wer die meisten und wer die wenigsten Münzen hat, treten in einem Minispiel gegeneinander an. Der Sieger erhält von jedem Verlierer 2 Münzen. Bei Gleichstand sind alle Gleichplatzierten betroffen. Sie treten alle mit an.", "effect": "duel"}, "das-grosse-kraeftemessen": {"pos": 80, "name": "Das große Kräftemessen", "category": "Alle gegen alle", "visibility": "public", "description": "Zieht ein Minispiel, bei dem alle gegeneinander antreten. Der Gewinner erhält die doppelte Belohnung.", "effect": "contest"}, "wettstreit-der-lager": {"pos": 90, "name": "Wettstreit der Lager", "category": "Team gegen Team", "visibility": "public", "description": "Die Entdeckten, deren Rolle erraten wurde, treten als Team gegen die Unentdeckten an. Jeder im Siegerteam erhält 1 Münze. Gibt es nur ein Lager, wird ein Alle-gegen-alle daraus, und der Sieger erhält 2 Münzen.", "effect": "camps"}, "der-verfluchte-beutel": {"pos": 100, "name": "Der verfluchte Beutel", "category": "Fluch mit Ausweg", "visibility": "public", "description": "Wer die meisten Münzen hat, verliert 2 Münzen, außer er wählt einen Herausforderer und gewinnt ein Duell gegen ihn. Bei Gleichstand sind alle Gleichplatzierten betroffen. Jeder kämpft für sich.", "effect": "purse"}, "das-orakel-spricht": {"pos": 110, "name": "Das Orakel spricht", "category": "Enthüllung", "visibility": "public", "description": "Wer die meisten Münzen hat, muss ein wahres Erkennungsmerkmal seiner Rolle verraten oder 2 Münzen an die Spielbank zahlen. Bei Gleichstand sind alle Gleichplatzierten betroffen.", "effect": "oracle"}, "am-scheideweg": {"pos": 120, "name": "Am Scheideweg", "category": "Entscheidung", "visibility": "public", "description": "Wer die wenigsten Münzen hat, entscheidet: Entweder erhalten alle 1 Münze, oder er allein erhält 2. Bei Gleichstand sind alle Gleichplatzierten betroffen. Sie entscheiden gemeinsam, und bei der zweiten Wahl erhält jeder von ihnen 2.", "effect": "crossroads"}, "die-nacht-der-seher": {"pos": 130, "name": "Die Nacht der Seher", "category": "Segen, hält an", "visibility": "public", "description": "Bis zum nächsten Ereignis bringt ein richtiger Tipp beim Raten 5 statt 3 Münzen.", "effect": "seers"}, "stille-lichtung": {"pos": 140, "name": "Stille Lichtung", "category": "Ruhe", "visibility": "public", "description": "Nichts geschieht. Der Wald ist friedlich. Atmet durch und genießt den Moment.", "effect": "calm"}, "der-alte-wegweiser": {"pos": 150, "name": "Der alte Wegweiser", "category": "Ruhe", "visibility": "public", "description": "Ihr kommt an einem alten Wegweiser vorbei. Seine Schrift ist längst verwittert. Nichts geschieht, doch irgendwo beobachtet euch die Gilde.", "effect": "calm"}, "vogelgesang": {"pos": 160, "name": "Vogelgesang", "category": "Ruhe", "visibility": "public", "description": "Über euch singt eine Amsel. Nichts geschieht. Lauscht einen Moment, bevor es weitergeht.", "effect": "calm"}}}, "tavern": {"pos": 20, "name": "Die Sturmnacht im Goldenen Krug", "setting": "Drinnen · für einen Abend am Tisch mit Essen und Trinken", "story": {"title": "Die Sturmnacht im Goldenen Krug", "paragraphs": ["Draußen tobt ein Sturm über Valdrien, wie ihn selbst die Alten noch nicht erlebt haben. Die Wege sind überschwemmt, die Brücken gesperrt, und so sitzt ihr fest: eine bunt gemischte Runde Reisender in der Taverne »Zum Goldenen Krug«.", "Der Wirt stellt Krüge und eine dampfende Suppe auf den Tisch und macht euch ein Angebot: »Wer heute Nacht die meisten Münzen sammelt, dessen Name kommt an die Wand der Stammgäste. Und Stammgäste trinken bei mir für immer umsonst.«", "Doch niemand an diesem Tisch ist der, für den er sich ausgibt. Jeder hat ein Geheimnis, und jeder will an diese Wand. Esst, trinkt, spielt und beobachtet eure Tischnachbarn genau."], "closing": "Bis der Sturm sich legt, ist noch viel Zeit. Die Nacht beginnt!"}, "epilogue": {"title": "Ein neuer Stammgast", "before": ["Der Sturm hat sich gelegt, die Kerzen sind heruntergebrannt, und die Münzen sind gezählt.", "Der Wirt nimmt Hammer und Nagel und hängt eine neue Tafel an die Wand:"], "after": ["Willkommen unter den Stammgästen des Goldenen Krugs! Ab heute ist dein Krug nie mehr leer, und dein Name hängt für immer an dieser Wand.", "Herzlichen Glückwunsch, {winner}! Die nächste Runde geht aufs Haus."]}, "terms": {"question": "Wer sitzt mit am Tisch?", "player": "Gast", "plural": "Gäste", "dative": "Gästen", "finish": "Die Nacht beenden"}, "roles": {"wendelin": {"pos": 10, "name": "Wendelin", "title": "der Wirt", "startingCoins": 5, "background": "Wendelin ist Herr über Krüge, Kasse und Hausrecht. Was an seinem Tisch passiert, entgeht ihm nicht.", "character": "", "traits": ["Achtet darauf, dass alle versorgt sind.", "Kommentiert gern das Geschehen am Tisch.", "Sorgt für Ordnung, wenn es laut wird."], "ability": {"name": "Hausrecht", "text": "Einmal im Spiel sieht Wendelin heimlich die nächste Ereigniskarte an und entscheidet, ob sie gespielt oder abgelegt wird. Spielt er sie, erhält er 1 Münze.", "mechanic": "houseRules"}, "task": {"name": "Volle Kasse", "text": "Besitze am Ende mindestens 8 Münzen.", "bonus": 3}}, "mathilda": {"pos": 20, "name": "Mathilda", "title": "die Mundschenkin", "startingCoins": 4, "background": "Mathilda kennt jeden Gast beim Namen und jedes Gerücht, das über den Tresen geht.", "character": "", "traits": ["Aufmerksam und gesprächig.", "Schenkt gern nach, auch Wasser.", "Fragt die Leute neugierig aus."], "ability": {"name": "Trinkgeld", "text": "Einmal im Spiel erhält Mathilda nach einem Minispiel, bei dem sie mitgespielt hat, 2 Münzen, egal ob sie gewonnen oder verloren hat.", "mechanic": "tip"}, "task": {"name": "Prost!", "text": "Mache ein Foto, auf dem mindestens drei Gläser beim Anstoßen zu sehen sind.", "bonus": 2}}, "torben": {"pos": 30, "name": "Torben", "title": "der Trunkenbold", "startingCoins": 3, "background": "Torben wirkt, als hätte er einen Krug zu viel gehabt. Aber er bekommt mehr mit, als alle denken. (Die Rolle wird nur gespielt, getrunken wird nicht mehr als sonst.)", "character": "", "traits": ["Laut und gesellig.", "Erzählt wirre Geschichten.", "Verwechselt gern Namen."], "ability": {"name": "Glück des Narren", "text": "Einmal im Spiel zieht Torben eine zufällige Belohnung von 1 bis 4 Münzen.", "mechanic": "foolsLuck"}, "task": {"name": "Geliehen ist geliehen", "text": "Besitze am Ende einen Gegenstand, den dir ein Mitspieler freiwillig geliehen hat, ohne dass er ihn zurückverlangt hat. Der Besitzer bestätigt das.", "bonus": 3}}, "klara": {"pos": 40, "name": "Klara", "title": "die Köchin", "startingCoins": 4, "background": "Aus Klaras Küche kommt die beste Suppe von ganz Valdrien. Wer einmal bei ihr gegessen hat, kommt wieder.", "character": "", "traits": ["Spricht gern übers Essen.", "Bietet anderen etwas an.", "Hat zu allem ein Rezept."], "ability": {"name": "Stärkende Suppe", "text": "Verliert Klara durch ein Ereignis Münzen, erhält sie einmal im Spiel direkt danach 3 Münzen.", "mechanic": "heartySoup"}, "task": {"name": "Geheimrezept", "text": "Lege auf deinem Teller heimlich ein Gesicht aus Essen oder Besteck und fotografiere es.", "bonus": 2}}, "severin": {"pos": 50, "name": "Severin", "title": "der Spielmann", "startingCoins": 4, "background": "Mit Laute und Liedern zieht Severin von Taverne zu Taverne. Wo er spielt, ist der Saal voll.", "character": "", "traits": ["Summt vor sich hin.", "Reimt gern.", "Macht aus allem eine Geschichte."], "ability": {"name": "Zugabe", "text": "Einmal im Spiel wählt Severin aus drei Minispielen eins aus und spielt mit. Gewinnt er, erhält er 2 zusätzliche Münzen.", "mechanic": "encore"}, "task": {"name": "Ohrwurm", "text": "Nimm ein kurzes Video auf, in dem mindestens zwei Mitspieler gemeinsam singen oder summen. Nur mit ihrer Zustimmung.", "bonus": 3}}, "fenja": {"pos": 60, "name": "Fenja", "title": "die Falschspielerin", "startingCoins": 3, "background": "Fenja lächelt freundlich, mischt geschickt und verliert erstaunlich selten.", "character": "", "traits": ["Charmant und schlagfertig.", "Will ständig wetten oder spielen.", "Hat immer einen Trick auf Lager."], "ability": {"name": "Gezinkt", "text": "Einmal im Spiel darf Fenja einen verlorenen Versuch in einem Minispiel wiederholen. Der Knopf dafür erscheint direkt beim Minispiel.", "mechanic": "loadedDice"}, "task": {"name": "Glückssträhne", "text": "Gewinne mindestens zwei Minispiele.", "bonus": 3}}, "hedda": {"pos": 70, "name": "Hedda", "title": "die Hellseherin", "startingCoins": 4, "background": "Hedda liest aus Teeblättern, Kerzenwachs und Bierschaum. Und manchmal liegt sie sogar richtig.", "character": "", "traits": ["Geheimnisvoll.", "Macht düstere Andeutungen.", "»Spürt« Dinge, bevor sie passieren."], "ability": {"name": "Blick in die Zukunft", "text": "Einmal im Spiel sieht Hedda heimlich die nächsten zwei Ereigniskarten und bestimmt, welche davon als Nächstes kommt.", "mechanic": "foresight"}, "task": {"name": "Prophezeiung", "text": "Schreib zu Spielbeginn heimlich in dein Handy, wer am Ende die wenigsten Münzen hat. Stimmt es, hast du die Aufgabe erfüllt.", "bonus": 3}}, "rudger": {"pos": 80, "name": "Rudger", "title": "der Raufbold", "startingCoins": 5, "background": "Rudger ist ein ehemaliger Söldner, der keinem Streit aus dem Weg geht. Zumindest keinem, den er gewinnen kann.", "character": "", "traits": ["Großspurig.", "Fordert gern andere heraus.", "Kann schlecht verlieren."], "ability": {"name": "Herausforderung", "text": "Einmal im Spiel fordert Rudger einen Gegner seiner Wahl zum Duell. Gewinnt er, erhält er 2 zusätzliche Münzen.", "mechanic": "challenge"}, "task": {"name": "Ehrenhändel", "text": "Gewinne mindestens ein Duell.", "bonus": 2}}}, "minigames": {"muenzschieben": {"pos": 10, "name": "Münzschieben", "category": "duel", "description": "Abwechselnd schiebt jeder eine Münze oder einen Bierdeckel mit einem Fingerschnipp über den Tisch. Wer näher an der Kante liegt, ohne herunterzufallen, gewinnt die Runde. Wer zuerst 2 Runden gewinnt, siegt.", "reward": {"winner": 2}}, "daumenringen": {"pos": 20, "name": "Daumenringen", "category": "duel", "description": "Verhakt die Finger, dann kämpfen die Daumen. Wer den Daumen des anderen drei Sekunden lang festhält, gewinnt.", "reward": {"winner": 2}}, "pokerface": {"pos": 30, "name": "Pokerface", "category": "duel", "description": "Jeder erzählt zwei wahre Dinge über sich und eins, das gelogen ist. Der andere muss die Lüge finden. Wer richtig liegt, bekommt einen Punkt. Bei Gleichstand wird wiederholt.", "reward": {"winner": 2}}, "der-schnellste-griff": {"pos": 40, "name": "Der schnellste Griff", "category": "duel", "description": "Ein Korken liegt zwischen euch. Ein Dritter sagt nacheinander Wörter. Bei »Prost!« wird gegriffen. Wer bei einem anderen Wort zugreift, verliert sofort.", "reward": {"winner": 2, "loser": -1}}, "die-gefuehlte-minute": {"pos": 50, "name": "Die gefühlte Minute", "category": "all", "description": "Alle schließen die Augen. Wer glaubt, dass genau eine Minute vergangen ist, hebt die Hand. Einer stoppt mit dem Handy. Wer am nächsten dran ist, gewinnt.", "reward": {"winner": 2}}, "ein-wort-eine-geschichte": {"pos": 60, "name": "Ein Wort, eine Geschichte", "category": "all", "description": "Reihum sagt jeder ein Wort, gemeinsam entsteht eine Geschichte. Wer zögert, lacht oder einen Satz kaputtmacht, scheidet aus. Der Letzte gewinnt.", "reward": {"winner": 3}}, "der-tresenturm": {"pos": 70, "name": "Der Tresenturm", "category": "all", "description": "Jeder baut in einer Minute einen Turm aus Dingen auf dem Tisch, aber ohne Essen und ohne volle Gläser. Der höchste Turm, der noch steht, gewinnt.", "reward": {"winner": 2}}, "maerchengestalt": {"pos": 80, "name": "Märchengestalt", "category": "all", "description": "Einer denkt an eine Figur aus Märchen oder Sagen, die anderen stellen reihum Ja-Nein-Fragen. Wer sie errät, gewinnt. Nach 20 Fragen ohne Treffer gewinnt der, der sie sich ausgedacht hat.", "reward": {"winner": 2}}, "das-schweigende-mahl": {"pos": 90, "name": "Das schweigende Mahl", "category": "all", "description": "Ab jetzt wird nicht mehr gesprochen. Wer redet oder laut lacht, scheidet aus. Grimassen sind erlaubt. Der Letzte gewinnt.", "reward": {"winner": 2}}, "seemannsgarn": {"pos": 100, "name": "Seemannsgarn", "category": "oneVsAll", "description": "Der Einzelne erzählt drei kurze Geschichten aus seinem Leben, eine davon ist erfunden. Die Gruppe einigt sich, welche gelogen ist. Liegt sie richtig, gewinnt die Gruppe.", "reward": {"solo": 3, "group": 1}}, "das-gedaechtnis-des-wirts": {"pos": 110, "name": "Das Gedächtnis des Wirts", "category": "oneVsAll", "description": "Der Einzelne prägt sich 20 Sekunden lang den Tisch ein und dreht sich um. Die Gruppe verändert zwei Dinge. Er muss beide finden.", "reward": {"solo": 3, "fail": -1}}, "das-huetchenspiel": {"pos": 120, "name": "Das Hütchenspiel", "category": "oneVsAll", "description": "Der Einzelne versteckt einen Kronkorken unter einem von drei Bechern und mischt. Die Gruppe einigt sich auf einen Becher. Drei Runden. Trifft die Gruppe mindestens zweimal, gewinnt sie.", "reward": {"solo": 3, "group": 1}}, "pantomime-der-taverne": {"pos": 130, "name": "Pantomime der Taverne", "category": "team", "description": "Abwechselnd stellt ein Spieler etwas aus der Taverne pantomimisch dar, zum Beispiel Bierzapfen, eine Schlägerei oder einen Betrunkenen auf der Treppe. Sein Team hat 30 Sekunden zum Raten. Nach drei Runden pro Team gewinnt das Team mit mehr Treffern.", "reward": {"team": 1}}, "die-speisekarte": {"pos": 140, "name": "Die Speisekarte", "category": "team", "description": "Die Teams nennen abwechselnd ein Gericht oder Getränk. Wer nicht weiterweiß oder etwas wiederholt, verliert.", "reward": {"team": 1}}, "der-rausschmeisser": {"pos": 150, "name": "Der Rausschmeißer", "category": "uneven", "description": "Der Rausschmeißer nennt in 30 Sekunden so viele Reime auf »Krug« wie möglich, zum Beispiel klug, Zug, genug. Danach haben die zwei Gäste zusammen 30 Sekunden für Reime auf »Wein«. Wer mehr schafft, gewinnt.", "reward": {"single": 3, "pair": 2, "singleName": "Rausschmeißer", "pairName": "Gäste"}}}, "events": {"lokalrunde": {"pos": 10, "name": "Lokalrunde", "category": "Segen", "visibility": "public", "description": "Der Wirt gibt einen aus! Alle stoßen an, Wasser zählt genauso, und erhalten 1 Münze.", "effect": "goldRain"}, "die-zeche-wird-faellig": {"pos": 20, "name": "Die Zeche wird fällig", "category": "Fluch", "visibility": "public", "description": "Der Wirt kommt mit der Rechnung. Alle zahlen 1 Münze an die Spielbank. Wer keine hat, kommt davon.", "effect": "tax"}, "anschreiben-lassen": {"pos": 30, "name": "Anschreiben lassen", "category": "Segen", "visibility": "public", "description": "Der Wirt hat ein Herz für arme Schlucker. Wer die wenigsten Münzen hat, erhält 3 Münzen. Bei Gleichstand sind alle Gleichplatzierten betroffen.", "effect": "favor"}, "kneipenschlaegerei": {"pos": 40, "name": "Kneipenschlägerei", "category": "Duell", "visibility": "public", "description": "Ein falsches Wort, und schon fliegen die Fäuste. Wer die meisten und wer die wenigsten Münzen hat, treten in einem Minispiel gegeneinander an. Der Sieger erhält von jedem Verlierer 2 Münzen. Bei Gleichstand sind alle Gleichplatzierten betroffen. Sie treten alle mit an.", "effect": "duel"}, "ein-taschendieb-geht-um": {"pos": 50, "name": "Ein Taschendieb geht um", "category": "Fluch", "visibility": "public", "description": "Im Gedränge am Tresen verschwindet ein Geldbeutel. Wer die meisten Münzen hat, verliert 2 Münzen an die Spielbank. Bei Gleichstand sind alle Gleichplatzierten betroffen.", "effect": "pickpocket"}, "gerede-am-tresen": {"pos": 60, "name": "Gerede am Tresen", "category": "Fluch", "visibility": "public", "description": "Die Leute tuscheln über euch. Alle, deren Rolle schon erraten wurde, verlieren 1 Münze.", "effect": "exposed"}, "inkognito": {"pos": 70, "name": "Inkognito", "category": "Segen", "visibility": "public", "description": "Wer unerkannt bleibt, hat es leichter. Alle, deren Rolle noch nicht erraten wurde, erhalten 1 Münze.", "effect": "disguise"}, "tisch-gegen-tisch": {"pos": 80, "name": "Tisch gegen Tisch", "category": "Team gegen Team", "visibility": "public", "description": "Die Entdeckten, deren Rolle erraten wurde, treten als Team gegen die Unentdeckten an. Jeder im Siegerteam erhält 1 Münze. Gibt es nur ein Lager, wird ein Alle-gegen-alle daraus, und der Sieger erhält 2 Münzen.", "effect": "camps"}, "der-spielmann-fordert-zum-wettstreit": {"pos": 90, "name": "Der Spielmann fordert zum Wettstreit", "category": "Alle gegen alle", "visibility": "public", "description": "Severin stimmt ein Lied an und ruft zum Wettstreit. Zieht ein Minispiel, bei dem alle gegeneinander antreten. Der Gewinner erhält die doppelte Belohnung.", "effect": "contest"}, "ein-fremder-tritt-ein": {"pos": 100, "name": "Ein Fremder tritt ein", "category": "Einer gegen alle", "visibility": "public", "description": "Ein Fremder im nassen Mantel setzt sich an euren Tisch und fordert den Reichsten heraus. Wer die meisten Münzen hat, tritt allein gegen alle an. Gewinnt er, erhält er 3 Münzen. Gewinnt die Gruppe, erhalten alle anderen je 1 Münze. Bei Gleichstand sind alle Gleichplatzierten betroffen. Sie treten gemeinsam an.", "effect": "stranger"}, "grosszuegigkeit-des-reichen": {"pos": 110, "name": "Großzügigkeit des Reichen", "category": "Entscheidung", "visibility": "public", "description": "Alle Augen richten sich auf den, der am meisten hat. Wer die meisten Münzen hat, wählt: Entweder schenkt er einem Mitspieler seiner Wahl 2 Münzen, oder er zahlt 3 Münzen an die Spielbank. Bei Gleichstand sind alle Gleichplatzierten betroffen. Jeder entscheidet für sich.", "effect": "generosity"}, "das-spiel-des-schicksals": {"pos": 120, "name": "Das Spiel des Schicksals", "category": "Glück", "visibility": "public", "description": "Ein alter Mann zieht eine Münze aus der Tasche und lässt sie für jeden von euch tanzen. Die App wirft für jeden eine Münze. Kopf: +1 Münze. Zahl: −1 Münze.", "effect": "fate"}, "lose-zungen": {"pos": 130, "name": "Lose Zungen", "category": "Segen, hält an", "visibility": "public", "description": "Der Abend wird lang, und die Zungen werden locker. Bis zum nächsten Ereignis kostet Raten keine Münze.", "effect": "looseTongues"}, "ein-gemuetlicher-abend": {"pos": 140, "name": "Ein gemütlicher Abend", "category": "Ruhe", "visibility": "public", "description": "Nichts geschieht. Das Feuer knistert, die Suppe dampft, und draußen heult der Sturm.", "effect": "calm"}, "der-hund-des-wirts": {"pos": 150, "name": "Der Hund des Wirts", "category": "Ruhe", "visibility": "public", "description": "Ein alter Hund trottet durch die Stube, schnüffelt an jedem Stuhl und legt sich vor den Kamin. Nichts geschieht.", "effect": "calm"}}}}}$valdrien_content$::jsonb, 'setup')
on conflict (id) do nothing;
