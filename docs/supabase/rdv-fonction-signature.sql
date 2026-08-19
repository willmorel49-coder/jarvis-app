-- ═══════════════════════════════════════════════════════════════
-- JARVIS · RDV — la fonction du commercial dans sa signature (19/08/2026)
--
-- « Les mails ne sont pas assez pro » (Will, 19/08). Une signature
-- professionnelle porte une fonction ; la nôtre n'avait que le nom, la maison
-- et le numéro.
--
-- ⚠️ POURQUOI UNE COLONNE, ET PAS UNE CONSTANTE DANS LE CODE. Le moteur de
-- modèles refuse depuis toujours d'écrire un titre que personne n'a validé :
-- « un titre faux dans un mail à un pharmacien se remarque, et décrédibilise
-- tout le reste ». Chacun saisit donc la sienne, et sans saisie la ligne
-- n'existe pas — on n'invente rien.
-- ═══════════════════════════════════════════════════════════════

alter table public.rdv_dispo add column if not exists fonction text;

alter table public.rdv_dispo drop constraint if exists rdv_dispo_fonction_len;
alter table public.rdv_dispo add  constraint rdv_dispo_fonction_len
  check (fonction is null or char_length(fonction) between 2 and 80);

-- Contrôle.
select
  exists (select 1 from information_schema.columns
           where table_schema='public' and table_name='rdv_dispo' and column_name='fonction') as colonne_posee,
  has_table_privilege('authenticated', 'public.rdv_dispo', 'UPDATE') as auth_modifie;
