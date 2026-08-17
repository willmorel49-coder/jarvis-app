-- ═══════════════════════════════════════════════════════════════
-- JARVIS · RDV — l'envoi groupé en copie cachée (17/08/2026)
--
-- POURQUOI CES TABLES. La campagne existante crée un jeton PAR officine
-- (`rdv_lien`), donc elle sait déjà qui a reçu quoi. L'envoi groupé, lui,
-- ne peut pas : un seul mail part vers N destinataires en Cci, avec UN
-- lien commun — celui du lien permanent du commercial. Sans trace écrite
-- ici, on ne saurait plus jamais à qui on a écrit, ni quand.
--
-- CE QUE ÇA REND POSSIBLE. Une officine qui réserve par le lien permanent
-- enregistre `origine = 'lien_public'` et son CIP. En rapprochant ce CIP
-- de la liste des destinataires d'un lot, on sait quel envoi a fait
-- réserver — c'est la seule attribution honnête possible sans pister le
-- pharmacien, ce qu'on ne fera pas.
--
-- CE QU'ON N'ENREGISTRE PAS, ET C'EST VOLONTAIRE : aucune ouverture de
-- mail, aucun pixel, aucun clic. On ne pose pas de mouchard chez un
-- pharmacien. « Envoyé » est déclaré par le commercial, « réservé » est
-- un fait vérifiable en base. Rien entre les deux ne sera inventé.
--
-- Rejouable : tout est en "if not exists" / "drop … if exists".
-- ═══════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────
-- 1. Un lot d'envoi = un mail parti vers N officines en Cci
--    `restrict` et non `cascade` : un commercial qui part n'efface pas
--    l'historique des sollicitations — même règle que rdv-socle.sql.
-- ───────────────────────────────────────────────────────────────
create table if not exists public.rdv_envoi (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete restrict,
  modele      text not null default 'routine'
                check (modele in ('bilan', 'offre', 'routine')),
  objet       text,
  -- Un envoi de 60 officines se découpe en lots : on garde le rang du lot
  -- et le total, sinon un rapport ne peut pas dire « lot 2 sur 3 ».
  lot         int  not null default 1 check (lot >= 1),
  lots_total  int  not null default 1 check (lots_total >= 1),
  nb_dest     int  not null default 0 check (nb_dest >= 0),
  -- Par quel geste le mail est parti : copie des adresses dans Outlook,
  -- ou brouillon ouvert automatiquement. Les deux existent, et savoir
  -- lequel marche vraiment sur le terrain vaut la colonne.
  canal       text not null default 'copie'
                check (canal in ('copie', 'brouillon')),
  cree_le     timestamptz not null default now(),
  -- Déclaré par le commercial. JARVIS ne peut pas savoir si le mail est
  -- vraiment parti de sa boîte : il vaut mieux l'écrire que le supposer.
  envoye_le   timestamptz
);
create index if not exists rdv_envoi_user on public.rdv_envoi (user_id, cree_le desc);

-- ───────────────────────────────────────────────────────────────
-- 2. Qui était dans le lot
--    On recopie nom / ville / e-mail au moment de l'envoi plutôt que de
--    pointer le référentiel : c'est une trace de ce qui s'est passé ce
--    jour-là. Si l'officine change d'adresse mail demain, la trace doit
--    continuer à dire à quelle adresse on a écrit hier.
-- ───────────────────────────────────────────────────────────────
create table if not exists public.rdv_envoi_dest (
  envoi_id  uuid not null references public.rdv_envoi(id) on delete cascade,
  cip       text not null,
  nom       text,
  ville     text,
  email     text,
  primary key (envoi_id, cip)
);
create index if not exists rdv_envoi_dest_cip on public.rdv_envoi_dest (cip);

-- Longueurs maximales : mêmes garde-fous que rdv-socle.sql. Ces champs
-- viennent du référentiel, pas d'un inconnu, mais une base gratuite se
-- remplit aussi par accident.
alter table public.rdv_envoi_dest drop constraint if exists rdv_envoi_dest_nom_len;
alter table public.rdv_envoi_dest add  constraint rdv_envoi_dest_nom_len
  check (nom is null or char_length(nom) <= 160);

alter table public.rdv_envoi_dest drop constraint if exists rdv_envoi_dest_email_len;
alter table public.rdv_envoi_dest add  constraint rdv_envoi_dest_email_len
  check (email is null or char_length(email) <= 160);

alter table public.rdv_envoi drop constraint if exists rdv_envoi_objet_len;
alter table public.rdv_envoi add  constraint rdv_envoi_objet_len
  check (objet is null or char_length(objet) <= 300);

-- ───────────────────────────────────────────────────────────────
-- 3. Les verrous
--    ⚠️ Il faut LES DEUX : le droit sur la table (grant) ET la policy RLS.
--    Une policy sans grant répond « permission denied » même connecté, et
--    l'app bascule en silence sur un repli — c'est le piège payé le 10/08
--    sur `maquette_notes`.
--    `anon` n'a aucun accès : la page publique ne touche jamais ces tables.
-- ───────────────────────────────────────────────────────────────
alter table public.rdv_envoi      enable row level security;
alter table public.rdv_envoi_dest enable row level security;

revoke all on public.rdv_envoi      from anon;
revoke all on public.rdv_envoi_dest from anon;

-- Pas de `delete` pour l'application : un historique de sollicitation ne
-- se supprime pas depuis un écran. Voir la règle « jamais de DELETE ».
grant select, insert, update on public.rdv_envoi      to authenticated;
grant select, insert         on public.rdv_envoi_dest to authenticated;
grant all    on public.rdv_envoi      to service_role;
grant all    on public.rdv_envoi_dest to service_role;

drop policy if exists rdv_envoi_sien on public.rdv_envoi;
create policy rdv_envoi_sien on public.rdv_envoi
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Un destinataire se lit et s'écrit à travers son lot : la ligne
-- n'appartient à personne toute seule, elle appartient à l'envoi.
drop policy if exists rdv_envoi_dest_sien on public.rdv_envoi_dest;
create policy rdv_envoi_dest_sien on public.rdv_envoi_dest
  for all to authenticated
  using (exists (select 1 from public.rdv_envoi e
                  where e.id = rdv_envoi_dest.envoi_id and e.user_id = auth.uid()))
  with check (exists (select 1 from public.rdv_envoi e
                       where e.id = rdv_envoi_dest.envoi_id and e.user_id = auth.uid()));

-- ───────────────────────────────────────────────────────────────
-- 4. Contrôle — doit renvoyer `true` partout.
--    On vérifie le grant ET pour `service_role` : une table créée par
--    migration ne lui donne aucun droit, et l'absence est silencieuse
--    (liste vide, aucune erreur).
-- ───────────────────────────────────────────────────────────────
select
  has_table_privilege('authenticated', 'public.rdv_envoi',      'SELECT') as auth_lit_envoi,
  has_table_privilege('authenticated', 'public.rdv_envoi',      'INSERT') as auth_ecrit_envoi,
  has_table_privilege('authenticated', 'public.rdv_envoi_dest', 'INSERT') as auth_ecrit_dest,
  has_table_privilege('service_role',  'public.rdv_envoi',      'SELECT') as svc_lit_envoi,
  has_table_privilege('service_role',  'public.rdv_envoi_dest', 'SELECT') as svc_lit_dest,
  not has_table_privilege('anon',      'public.rdv_envoi',      'SELECT') as anon_bloque;
