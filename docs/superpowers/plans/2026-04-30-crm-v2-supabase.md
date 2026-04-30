# CRM V2 — Migration Supabase — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer localStorage + users hardcodés par Supabase Auth + PostgreSQL, sans toucher au HTML/CSS ni ajouter de build step.

**Architecture:** Phase 1 remplace uniquement l'auth (USERS[] → Supabase Auth + user_profiles). Phase 2 remplace le stockage (localStorage → tables PostgreSQL). Le client Supabase est chargé via CDN, toute la logique de rendu reste intacte.

**Tech Stack:** Vanilla JS, Supabase JS v2 (CDN UMD), PostgreSQL (Supabase), GitHub Pages

---

## Fichiers modifiés / créés

| Fichier | Action | Responsabilité |
|---|---|---|
| `crm/supabase-schema.sql` | CRÉER | SQL complet à coller dans Supabase |
| `crm/index.html` | MODIFIER | Ajouter CDN Supabase + config URL/key |
| `crm/app.js` | MODIFIER | Remplacer auth + storage par Supabase |

---

## PHASE 1 — Auth Supabase

---

### Task 1 : Créer le projet Supabase (étapes manuelles)

**Files:** aucun fichier à modifier

- [ ] **Step 1 : Créer un compte Supabase**

  Ouvre https://supabase.com et clique "Start your project". Connecte-toi avec GitHub.

- [ ] **Step 2 : Créer un nouveau projet**

  - Clique "New project"
  - Nom : `integral-pharma-crm`
  - Mot de passe base de données : choisis un mot de passe fort, note-le
  - Région : West EU (Ireland) — la plus proche de la France
  - Clique "Create new project" et attends ~2 min

- [ ] **Step 3 : Récupérer URL et anon key**

  Dans ton projet Supabase : Settings (icône engrenage) → API

  Note ces deux valeurs :
  - **Project URL** → ressemble à `https://abcdefgh.supabase.co`
  - **anon public key** → longue chaîne commençant par `eyJ...`

  Garde-les à portée de main pour la Task 4.

---

### Task 2 : Créer le schema SQL

**Files:**
- Create: `crm/supabase-schema.sql`

- [ ] **Step 1 : Créer le fichier SQL**

  Contenu complet de `crm/supabase-schema.sql` :

  ```sql
  -- ═══════════════════════════════════════════════
  -- INTÉGRAL PHARMA CRM — Supabase Schema V2
  -- ═══════════════════════════════════════════════

  -- 1. Profils utilisateurs (liés à Supabase Auth)
  create table if not exists user_profiles (
    id           uuid primary key references auth.users(id) on delete cascade,
    name         text not null,
    role         text not null check (role in ('admin', 'manager', 'commercial')),
    pharmacy_ids uuid[] default null
  );

  -- 2. Pharmacies
  create table if not exists pharmacies (
    id         uuid primary key default gen_random_uuid(),
    name       text not null,
    code       text not null,
    color      text not null,
    created_at timestamptz default now()
  );

  -- 3. Imports
  create table if not exists imports (
    id           uuid primary key default gen_random_uuid(),
    pharmacy_id  uuid references pharmacies(id) on delete cascade,
    month        int,
    year         int,
    filename     text not null,
    imported_at  timestamptz default now(),
    imported_by  uuid references auth.users(id)
  );

  -- 4. Ventes
  create table if not exists sales (
    id              uuid primary key default gen_random_uuid(),
    import_id       uuid references imports(id) on delete cascade,
    pharmacy_id     uuid references pharmacies(id) on delete cascade,
    month           int,
    year            int,
    art_designation text,
    art_code        text,
    art_id          text,
    qte             decimal(12,4) default 0,
    pu_brut         decimal(12,4) default 0,
    pu_net          decimal(12,4) default 0,
    mnt_net_ht      decimal(12,4) default 0
  );

  -- ── ROW LEVEL SECURITY ────────────────────────

  alter table user_profiles enable row level security;
  alter table pharmacies     enable row level security;
  alter table imports        enable row level security;
  alter table sales          enable row level security;

  -- user_profiles : chaque user voit uniquement son propre profil
  create policy "own_profile_select" on user_profiles
    for select using (auth.uid() = id);

  -- pharmacies : tout utilisateur authentifié peut lire/écrire/supprimer
  create policy "auth_select" on pharmacies for select using (auth.role() = 'authenticated');
  create policy "auth_insert" on pharmacies for insert with check (auth.role() = 'authenticated');
  create policy "auth_delete" on pharmacies for delete using (auth.role() = 'authenticated');

  -- imports : tout utilisateur authentifié peut lire/écrire/supprimer
  create policy "auth_select" on imports for select using (auth.role() = 'authenticated');
  create policy "auth_insert" on imports for insert with check (auth.role() = 'authenticated');
  create policy "auth_delete" on imports for delete using (auth.role() = 'authenticated');

  -- sales : tout utilisateur authentifié peut lire/écrire/supprimer
  create policy "auth_select" on sales for select using (auth.role() = 'authenticated');
  create policy "auth_insert" on sales for insert with check (auth.role() = 'authenticated');
  create policy "auth_delete" on sales for delete using (auth.role() = 'authenticated');
  ```

- [ ] **Step 2 : Exécuter le SQL dans Supabase**

  Dans ton projet Supabase : SQL Editor (icône terminal) → New query

  Colle tout le contenu du fichier ci-dessus → clique "Run"

  Résultat attendu : `Success. No rows returned`

- [ ] **Step 3 : Commit**

  ```bash
  cd ~/jarvis/APP
  git add crm/supabase-schema.sql
  git commit -m "feat: add Supabase schema SQL"
  ```

---

### Task 3 : Créer les 3 utilisateurs + seed profils (étapes manuelles)

**Files:** aucun fichier à modifier

- [ ] **Step 1 : Créer les 3 comptes dans Supabase Auth**

  Dans ton projet Supabase : Authentication → Users → "Add user" (bouton en haut à droite)

  Crée ces 3 comptes dans cet ordre (coche "Auto Confirm User" à chaque fois) :
  - Email: `admin@integralpharma.fr` | Password: `Admin2024!`
  - Email: `manager@integralpharma.fr` | Password: `Manager2024!`
  - Email: `demo@integralpharma.fr` | Password: `Demo2024!`

- [ ] **Step 2 : Seed les profils utilisateurs**

  SQL Editor → New query → colle et exécute :

  ```sql
  insert into user_profiles (id, name, role, pharmacy_ids)
  select
    id,
    case email
      when 'admin@integralpharma.fr'   then 'William M.'
      when 'manager@integralpharma.fr' then 'Sophie L.'
      when 'demo@integralpharma.fr'    then 'Demo User'
    end,
    case email
      when 'admin@integralpharma.fr'   then 'admin'
      when 'manager@integralpharma.fr' then 'manager'
      when 'demo@integralpharma.fr'    then 'commercial'
    end,
    case email
      when 'demo@integralpharma.fr' then array[]::uuid[]
      else null
    end
  from auth.users
  where email in (
    'admin@integralpharma.fr',
    'manager@integralpharma.fr',
    'demo@integralpharma.fr'
  )
  on conflict (id) do nothing;
  ```

  Résultat attendu : `3 rows affected`

- [ ] **Step 3 : Vérifier**

  SQL Editor → New query :
  ```sql
  select name, role from user_profiles;
  ```
  Doit retourner 3 lignes : William M. (admin), Sophie L. (manager), Demo User (commercial)

---

### Task 4 : Ajouter Supabase CDN dans index.html

**Files:**
- Modify: `crm/index.html` (lignes 121-128)

- [ ] **Step 1 : Remplacer le bloc LIBS CDN**

  Trouve ce bloc à la fin de `crm/index.html` :
  ```html
  <!-- LIBS CDN -->
  <script src="https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js"></script>
  <script>
    Chart.defaults.color = '#8899BB';
    Chart.defaults.borderColor = 'rgba(255,255,255,0.06)';
  </script>
  <script src="app.js"></script>
  ```

  Remplace-le par :
  ```html
  <!-- LIBS CDN -->
  <script src="https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
  <script>
    Chart.defaults.color = '#8899BB';
    Chart.defaults.borderColor = 'rgba(255,255,255,0.06)';
    window.SUPABASE_URL      = 'https://REMPLACE-PAR-TON-ID.supabase.co';
    window.SUPABASE_ANON_KEY = 'REMPLACE-PAR-TA-ANON-KEY';
  </script>
  <script src="app.js"></script>
  ```

  Remplace `REMPLACE-PAR-TON-ID` et `REMPLACE-PAR-TA-ANON-KEY` par tes vraies valeurs récupérées en Task 1 Step 3.

- [ ] **Step 2 : Mettre à jour le numéro de version dans la sidebar**

  Trouve dans `crm/index.html` :
  ```html
  <div class="sidebar-brand-sub">CRM v1.0</div>
  ```
  Remplace par :
  ```html
  <div class="sidebar-brand-sub">CRM v2.0</div>
  ```

- [ ] **Step 3 : Vérifier visuellement que le fichier est correct**

  Ouvre `crm/index.html` dans un éditeur. Vérifie que les 3 scripts CDN sont dans le bon ordre : xlsx → chart.js → supabase → app.js

---

### Task 5 : Remplacer l'auth dans app.js (Phase 1)

**Files:**
- Modify: `crm/app.js`

- [ ] **Step 1 : Ajouter l'init Supabase et supprimer USERS**

  En haut de `crm/app.js`, trouve et supprime tout le bloc `USERS` :
  ```js
  const USERS = [
    { id: 1, email: 'admin@integralpharma.fr',   password: 'Admin2024!',   role: 'admin',      name: 'William M.',   pharmacyIds: null },
    { id: 2, email: 'manager@integralpharma.fr', password: 'Manager2024!', role: 'manager',    name: 'Sophie L.',    pharmacyIds: null },
    { id: 3, email: 'demo@integralpharma.fr',    password: 'Demo2024!',    role: 'commercial', name: 'Demo User',    pharmacyIds: [] },
  ];
  ```

  Remplace-le par :
  ```js
  // ── SUPABASE ──────────────────────────────────
  const sb = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  ```

- [ ] **Step 2 : Remplacer les fonctions AUTH**

  Trouve et supprime tout le bloc `// ── AUTH ─────` (lignes 39-62) :
  ```js
  // ── AUTH ─────────────────────────────────────
  function tryLogin(email, password) { ... }
  function restoreSession() { ... }
  function logout() { ... }
  ```

  Remplace-le par :
  ```js
  // ── AUTH ─────────────────────────────────────
  async function loadUserProfile() {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return false;
    const { data: profile } = await sb.from('user_profiles').select('*').eq('id', user.id).single();
    if (!profile) return false;
    // Normaliser pharmacy_ids (snake_case DB) → pharmacyIds (camelCase JS, utilisé dans getSales())
    state.user = {
      id:          user.id,
      email:       user.email,
      name:        profile.name,
      role:        profile.role,
      pharmacyIds: profile.pharmacy_ids,
    };
    return true;
  }

  async function tryLogin(email, password) {
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) return false;
    return await loadUserProfile();
  }

  async function restoreSession() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return false;
    return await loadUserProfile();
  }

  async function logout() {
    await sb.auth.signOut();
    state.user = null;
    document.getElementById('app').classList.remove('visible');
    document.getElementById('login-screen').style.display = 'flex';
  }
  ```

- [ ] **Step 3 : Mettre à jour initApp pour être async**

  Trouve :
  ```js
  function initApp() {
    load();

    // Sidebar user info
    document.getElementById('sidebar-user-name').textContent = state.user.name;
    document.getElementById('sidebar-user-role').textContent = state.user.role;
    document.getElementById('sidebar-avatar').textContent = state.user.name.charAt(0);

    // Hide admin for non-admin
    document.getElementById('nav-admin').style.display = state.user.role === 'admin' ? 'flex' : 'none';

    updateNavBadge();
    navigate('dashboard');
  }
  ```

  Remplace par :
  ```js
  async function initApp() {
    await load();

    document.getElementById('sidebar-user-name').textContent = state.user.name;
    document.getElementById('sidebar-user-role').textContent = state.user.role;
    document.getElementById('sidebar-avatar').textContent = state.user.name.charAt(0);
    document.getElementById('nav-admin').style.display = state.user.role === 'admin' ? 'flex' : 'none';

    updateNavBadge();
    navigate('dashboard');
  }
  ```

- [ ] **Step 4 : Mettre à jour le bloc BOOT (DOMContentLoaded)**

  Trouve tout le bloc boot (dernières lignes de app.js) :
  ```js
  document.addEventListener('DOMContentLoaded', () => {
    if (restoreSession()) {
      document.getElementById('login-screen').style.display = 'none';
      document.getElementById('app').classList.add('visible');
      initApp();
    }

    // Login form
    document.getElementById('login-form').addEventListener('submit', e => {
      e.preventDefault();
      const email    = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;
      const err      = document.getElementById('login-error');
      if (tryLogin(email, password)) {
        err.classList.remove('show');
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('app').classList.add('visible');
        initApp();
      } else {
        err.textContent = 'Email ou mot de passe incorrect';
        err.classList.add('show');
      }
    });
  });
  ```

  Remplace par :
  ```js
  document.addEventListener('DOMContentLoaded', async () => {
    if (await restoreSession()) {
      document.getElementById('login-screen').style.display = 'none';
      document.getElementById('app').classList.add('visible');
      await initApp();
    }

    document.getElementById('login-form').addEventListener('submit', async e => {
      e.preventDefault();
      const email    = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;
      const err      = document.getElementById('login-error');
      if (await tryLogin(email, password)) {
        err.classList.remove('show');
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('app').classList.add('visible');
        await initApp();
      } else {
        err.textContent = 'Email ou mot de passe incorrect';
        err.classList.add('show');
      }
    });
  });
  ```

- [ ] **Step 5 : Mettre à jour renderAdmin (supprimer la référence à USERS)**

  Trouve dans `renderAdmin()` le bloc qui génère le tableau utilisateurs :
  ```js
  <div class="card" style="margin-bottom:20px">
    <div class="card-header"><div class="card-title">Utilisateurs</div></div>
    <table class="data-table">
      <thead><tr><th>Email</th><th>Nom</th><th>Rôle</th><th>Accès</th></tr></thead>
      <tbody>
        ${USERS.map(u => `
          <tr>
            <td class="td-name">${u.email}</td>
            <td>${u.name}</td>
            <td><span class="badge ${u.role==='admin'?'badge-rose':u.role==='manager'?'badge-amber':'badge-blue'}">${u.role}</span></td>
            <td style="color:var(--text3)">${u.pharmacyIds === null ? 'Toutes' : u.pharmacyIds?.length ? u.pharmacyIds.length+' pharmacies' : 'Aucune'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
  ```

  Remplace par :
  ```js
  <div class="card" style="margin-bottom:20px">
    <div class="card-header"><div class="card-title">Utilisateurs</div></div>
    <div class="card-body">
      <p style="color:var(--text2);font-size:14px;margin:0">
        Gérer les utilisateurs depuis le
        <a href="https://supabase.com/dashboard" target="_blank" style="color:var(--blue)">dashboard Supabase</a>
        → Authentication → Users
      </p>
    </div>
  </div>
  ```

  Aussi dans `renderAdmin()`, remplace le bouton "Réinitialiser" :
  ```js
  <button class="btn btn-ghost" onclick="if(confirm('Supprimer toutes les données ?')){localStorage.clear();location.reload()}" style="color:var(--rose);border-color:rgba(255,77,109,.3)">
    🗑 Réinitialiser toutes les données
  </button>
  ```
  par (provisoire Phase 1 — sera remplacé en Phase 2) :
  ```js
  <button class="btn btn-ghost" onclick="if(confirm('Supprimer toutes les données ?')){localStorage.clear();location.reload()}" style="color:var(--rose);border-color:rgba(255,77,109,.3)">
    🗑 Réinitialiser données locales
  </button>
  ```

---

### Task 6 : Déployer et tester Phase 1

**Files:** aucun

- [ ] **Step 1 : Commit et push**

  ```bash
  cd ~/jarvis/APP
  git add crm/index.html crm/app.js
  git commit -m "feat: Phase 1 — Supabase Auth (remplace users hardcodés)"
  git push
  ```

- [ ] **Step 2 : Attendre le déploiement GitHub Pages**

  Attends 1-2 minutes, puis ouvre : https://willmorel49-coder.github.io/jarvis-app/crm/

- [ ] **Step 3 : Tester la connexion**

  - Entre `admin@integralpharma.fr` / `Admin2024!` → doit se connecter et afficher le dashboard
  - Ouvre la console (F12 → Console) → vérifie qu'il n'y a pas d'erreurs rouges
  - Rafraîchis la page → doit rester connecté (session restaurée par Supabase)
  - Clique sur ton nom en bas de la sidebar → doit se déconnecter

- [ ] **Step 4 : Tester avec le compte manager**

  - Connecte-toi avec `manager@integralpharma.fr` / `Manager2024!`
  - Vérifie que le menu "Administration" n'apparaît pas (visible seulement pour admin)

  Phase 1 terminée ✓

---

## PHASE 2 — Données Supabase

---

### Task 7 : Remplacer load() et save() par Supabase

**Files:**
- Modify: `crm/app.js`

- [ ] **Step 1 : Remplacer la fonction save()**

  Trouve :
  ```js
  function save() {
    localStorage.setItem('ip_crm_pharmacies', JSON.stringify(state.pharmacies));
    localStorage.setItem('ip_crm_imports',    JSON.stringify(state.imports));
    localStorage.setItem('ip_crm_sales',      JSON.stringify(state.sales));
  }
  ```
  Supprime-la entièrement (elle ne sera plus utilisée).

- [ ] **Step 2 : Remplacer la fonction load()**

  Trouve :
  ```js
  function load() {
    state.pharmacies = JSON.parse(localStorage.getItem('ip_crm_pharmacies') || '[]');
    state.imports    = JSON.parse(localStorage.getItem('ip_crm_imports')    || '[]');
    state.sales      = JSON.parse(localStorage.getItem('ip_crm_sales')      || '[]');
  }
  ```

  Remplace par :
  ```js
  async function load() {
    const [{ data: pharmacies }, { data: imports }, { data: sales }] = await Promise.all([
      sb.from('pharmacies').select('*').order('name'),
      sb.from('imports').select('*').order('imported_at', { ascending: false }),
      sb.from('sales').select('*'),
    ]);

    state.pharmacies = pharmacies || [];

    state.imports = (imports || []).map(i => ({
      id:          i.id,
      pharmacyId:  i.pharmacy_id,
      month:       i.month,
      year:        i.year,
      filename:    i.filename,
      importedAt:  i.imported_at,
    }));

    state.sales = (sales || []).map(s => ({
      id:             s.id,
      importId:       s.import_id,
      pharmacyId:     s.pharmacy_id,
      month:          s.month,
      year:           s.year,
      artDesignation: s.art_designation,
      artCode:        s.art_code,
      artId:          s.art_id,
      qte:            parseFloat(s.qte) || 0,
      puBrut:         parseFloat(s.pu_brut) || 0,
      puNet:          parseFloat(s.pu_net) || 0,
      mntNetHt:       parseFloat(s.mnt_net_ht) || 0,
    }));
  }
  ```

---

### Task 8 : Mettre à jour pharmaFromFilename et importFile

**Files:**
- Modify: `crm/app.js`

- [ ] **Step 1 : Remplacer pharmaFromFilename (devient async)**

  Trouve la fonction `pharmaFromFilename(filename)` (lignes ~65-94) et remplace-la entièrement par :

  ```js
  async function pharmaFromFilename(filename) {
    const base = filename.replace(/\.(xlsx|xls|csv)$/i, '').trim();
    const monthYearMatch = base.match(/(\d{2})\s+(\d{2,4})$/);
    let month = null, year = null, namePart = base;
    if (monthYearMatch) {
      month = parseInt(monthYearMatch[1]);
      year  = parseInt(monthYearMatch[2]);
      if (year < 100) year += 2000;
      namePart = base.slice(0, base.length - monthYearMatch[0].length).trim();
    }
    const name = namePart
      .replace(/^Phie\s+/i, 'Pharmacie ')
      .replace(/^Ph\s+/i,   'Pharmacie ')
      .replace(/\b\w/g, c => c.toUpperCase());

    let pharma = state.pharmacies.find(p => p.name.toLowerCase() === name.toLowerCase());
    if (!pharma) {
      const { data, error } = await sb.from('pharmacies').insert({
        name,
        code:  name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 4),
        color: PHARMA_COLORS[state.pharmacies.length % PHARMA_COLORS.length],
      }).select().single();
      if (error) throw new Error('Erreur création pharmacie : ' + error.message);
      pharma = data;
      state.pharmacies.push(pharma);
    }
    return { pharma, month, year };
  }
  ```

- [ ] **Step 2 : Remplacer importFile**

  Trouve la fonction `async function importFile(file)` (lignes ~127-157) et remplace-la entièrement par :

  ```js
  async function importFile(file) {
    const { pharma, month, year } = await pharmaFromFilename(file.name);
    let rows;
    try { rows = await parseExcel(file); }
    catch(e) { return { ok: false, error: 'Erreur lecture fichier' }; }
    if (!rows.length) return { ok: false, error: 'Fichier vide' };

    // Supprimer l'import existant pour la même pharmacie/période
    if (month && year) {
      const existing = state.imports.find(i => i.pharmacyId === pharma.id && i.month === month && i.year === year);
      if (existing) {
        await sb.from('sales').delete().eq('import_id', existing.id);
        await sb.from('imports').delete().eq('id', existing.id);
      }
    }

    // Créer le nouvel import
    const { data: imp, error: impErr } = await sb.from('imports').insert({
      pharmacy_id: pharma.id,
      month, year,
      filename:    file.name,
      imported_by: state.user.id,
    }).select().single();
    if (impErr) return { ok: false, error: 'Erreur création import' };

    // Préparer les lignes de vente
    const salesRows = rows
      .map(normalizeRow)
      .filter(r => r.artDesignation)
      .map(r => ({
        import_id:       imp.id,
        pharmacy_id:     pharma.id,
        month, year,
        art_designation: r.artDesignation,
        art_code:        r.artCode,
        art_id:          r.artId,
        qte:             r.qte,
        pu_brut:         r.puBrut,
        pu_net:          r.puNet,
        mnt_net_ht:      r.mntNetHt,
      }));

    // Insérer par lots de 500
    for (let i = 0; i < salesRows.length; i += 500) {
      const { error } = await sb.from('sales').insert(salesRows.slice(i, i + 500));
      if (error) return { ok: false, error: 'Erreur insertion ventes' };
    }

    await load();
    return { ok: true, pharma, month, year, count: rows.length };
  }
  ```

---

### Task 9 : Mettre à jour renderAdmin + ajouter migration et reset Supabase

**Files:**
- Modify: `crm/app.js`

- [ ] **Step 1 : Remplacer renderAdmin() au complet**

  Trouve la fonction `function renderAdmin()` (lignes ~575-622) et remplace-la entièrement par :

  ```js
  function renderAdmin() {
    const hasLocalData = !!(localStorage.getItem('ip_crm_pharmacies') || localStorage.getItem('ip_crm_sales'));

    document.getElementById('admin-content').innerHTML = `
      <div class="fade-up" style="max-width:700px">
        <div class="section-title">Administration</div>
        <div class="section-sub">Gestion des accès et des données</div>

        <div class="card" style="margin-bottom:20px">
          <div class="card-header"><div class="card-title">Utilisateurs</div></div>
          <div class="card-body">
            <p style="color:var(--text2);font-size:14px;margin:0">
              Gérer les utilisateurs depuis le
              <a href="https://supabase.com/dashboard" target="_blank" style="color:var(--blue)">dashboard Supabase</a>
              → Authentication → Users
            </p>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><div class="card-title">Données cloud</div></div>
          <div class="card-body">
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:20px">
              <div style="background:var(--glass2);border-radius:var(--rs);padding:16px;text-align:center">
                <div style="font-family:'Space Grotesk',sans-serif;font-size:24px;font-weight:800">${state.pharmacies.length}</div>
                <div style="font-size:12px;color:var(--text2);margin-top:4px">Pharmacies</div>
              </div>
              <div style="background:var(--glass2);border-radius:var(--rs);padding:16px;text-align:center">
                <div style="font-family:'Space Grotesk',sans-serif;font-size:24px;font-weight:800">${state.imports.length}</div>
                <div style="font-size:12px;color:var(--text2);margin-top:4px">Imports</div>
              </div>
              <div style="background:var(--glass2);border-radius:var(--rs);padding:16px;text-align:center">
                <div style="font-family:'Space Grotesk',sans-serif;font-size:24px;font-weight:800">${state.sales.length}</div>
                <div style="font-size:12px;color:var(--text2);margin-top:4px">Lignes de vente</div>
              </div>
            </div>
            ${hasLocalData ? `
            <button class="btn btn-primary" onclick="migrateFromLocalStorage()" style="margin-bottom:12px;width:100%">
              ☁️ Migrer les données locales vers Supabase
            </button>` : ''}
            <button class="btn btn-ghost" onclick="if(confirm('Supprimer TOUTES les données Supabase ? Cette action est irréversible.')){resetAllData()}" style="color:var(--rose);border-color:rgba(255,77,109,.3)">
              🗑 Réinitialiser toutes les données
            </button>
          </div>
        </div>
      </div>
    `;
  }
  ```

- [ ] **Step 2 : Ajouter migrateFromLocalStorage() et resetAllData() après renderAdmin()**

  Juste après la fermeture de `renderAdmin()`, ajoute :

  ```js
  async function migrateFromLocalStorage() {
    const oldPharmacies = JSON.parse(localStorage.getItem('ip_crm_pharmacies') || '[]');
    const oldImports    = JSON.parse(localStorage.getItem('ip_crm_imports')    || '[]');
    const oldSales      = JSON.parse(localStorage.getItem('ip_crm_sales')      || '[]');

    if (!oldPharmacies.length && !oldImports.length) {
      showToast('Aucune donnée locale à migrer', 'info');
      return;
    }

    showToast('Migration en cours...', 'info');

    // Migrer pharmacies et construire le mapping anciens IDs → UUIDs
    const pharmaIdMap = {};
    for (const p of oldPharmacies) {
      const { data } = await sb.from('pharmacies').insert({
        name: p.name, code: p.code, color: p.color,
      }).select().single();
      pharmaIdMap[String(p.id)] = data.id;
    }

    // Migrer imports
    const importIdMap = {};
    for (const i of oldImports) {
      const newPharmaId = pharmaIdMap[String(i.pharmacyId)];
      if (!newPharmaId) continue;
      const { data } = await sb.from('imports').insert({
        pharmacy_id: newPharmaId,
        month:       i.month,
        year:        i.year,
        filename:    i.filename,
        imported_by: state.user.id,
      }).select().single();
      importIdMap[String(i.id)] = data.id;
    }

    // Migrer ventes par lots de 500
    const salesRows = oldSales
      .filter(s => pharmaIdMap[String(s.pharmacyId)] && importIdMap[String(s.importId)])
      .map(s => ({
        import_id:       importIdMap[String(s.importId)],
        pharmacy_id:     pharmaIdMap[String(s.pharmacyId)],
        month:           s.month,
        year:            s.year,
        art_designation: s.artDesignation,
        art_code:        s.artCode,
        art_id:          s.artId,
        qte:             s.qte,
        pu_brut:         s.puBrut,
        pu_net:          s.puNet,
        mnt_net_ht:      s.mntNetHt,
      }));

    for (let i = 0; i < salesRows.length; i += 500) {
      await sb.from('sales').insert(salesRows.slice(i, i + 500));
    }

    // Supprimer les données locales
    localStorage.removeItem('ip_crm_pharmacies');
    localStorage.removeItem('ip_crm_imports');
    localStorage.removeItem('ip_crm_sales');

    await load();
    showToast(`Migration terminée — ${oldPharmacies.length} pharmacies, ${oldSales.length} ventes`, 'success');
    renderAdmin();
  }

  async function resetAllData() {
    await sb.from('sales').delete().not('id', 'is', null);
    await sb.from('imports').delete().not('id', 'is', null);
    await sb.from('pharmacies').delete().not('id', 'is', null);
    state.pharmacies = [];
    state.imports    = [];
    state.sales      = [];
    showToast('Données réinitialisées', 'success');
    navigate('dashboard');
  }
  ```

---

### Task 10 : Déployer, migrer les données, tester Phase 2

**Files:** aucun

- [ ] **Step 1 : Commit et push**

  ```bash
  cd ~/jarvis/APP
  git add crm/app.js
  git commit -m "feat: Phase 2 — Supabase DB (remplace localStorage)"
  git push
  ```

- [ ] **Step 2 : Attendre le déploiement et ouvrir le CRM**

  Attends 1-2 min, puis : https://willmorel49-coder.github.io/jarvis-app/crm/

  Connecte-toi avec `admin@integralpharma.fr` / `Admin2024!`

- [ ] **Step 3 : Migrer les données existantes**

  - Va dans "Administration" (menu gauche)
  - Si tu avais des données dans localStorage, tu verras le bouton bleu "☁️ Migrer les données locales vers Supabase"
  - Clique dessus et attends le message "Migration terminée"
  - Si tu n'avais pas de données, passe à Step 4

- [ ] **Step 4 : Tester un import Excel**

  - Va dans "Import Excel"
  - Glisse un fichier `.xlsx` et vérifie qu'il s'importe correctement
  - Va dans "Dashboard" → vérifie que les données apparaissent

- [ ] **Step 5 : Vérifier le partage des données**

  - Ouvre le CRM dans un autre navigateur (ou onglet privé)
  - Connecte-toi avec un autre compte (`manager@integralpharma.fr` / `Manager2024!`)
  - Vérifie que tu vois les mêmes données que sur le premier compte

  Phase 2 terminée ✓

- [ ] **Step 6 : Vérifier dans Supabase**

  Dans ton dashboard Supabase → Table Editor → ouvre la table `sales` → vérifie que les lignes sont bien là

  Migration V2 complète ✓
