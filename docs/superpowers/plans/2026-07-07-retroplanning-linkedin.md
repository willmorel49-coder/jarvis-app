# Rétroplanning LinkedIn — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un bloc « Rétroplanning LinkedIn » dans l'onglet Marketing du CRM JARVIS : calendrier éditorial + générateur de rétroplanning à rebours + éditeur de post + import de l'export LinkedIn + rappels + publier en 1 clic.

**Architecture:** Nouveau module vanilla `crm/v2/v2-mkt-linkedin.js` exposant `V2.mktLinkedin` (data + vues), branché dans le routeur `V2.pages.marketing.render` de `v2-mkt.js` via `param === 'linkedin'`. Persistance : table Supabase `linkedin_posts` via `V2.sb()`, repli `localStorage` (même pattern que `marketing_items`). Visuels dans le bucket Supabase `marketing-media`. Aucune dépendance nouvelle (parseur CSV maison pour l'import).

**Tech Stack:** Vanilla JS (ES5-compatible, comme le reste du CRM), CSS inline dans le module, Supabase JS (déjà chargé), GitHub Pages, service worker offline.

## Global Constraints

- **Vanilla JS only** — pas de framework, pas de build, pas de npm. Compatible avec le style ES5 existant (`var`, fonctions nommées).
- **100% client-side** — aucun serveur, aucune clé API, aucun coût. Pas d'appel à l'API LinkedIn.
- **Persistance** — Supabase primaire via `V2.sb()`, **repli `localStorage`** silencieux (clé `jarvis_li_posts`). Comme `v2-mkt.js`.
- **Pas de dépendance nouvelle** — parseur CSV maison (pas de SheetJS ajouté en v2).
- **Français** partout côté UI.
- **Règles métier** — aucune condition commerciale chiffrée n'est imposée par l'outil (l'utilisateur écrit librement ses posts). Pas de faux contenu généré.
- **Déploiement JARVIS** — après livraison : bumper `?v=` de `v2-mkt.js`, `v2-mkt-linkedin.js` (et les autres assets versionnés inchangés), **synchroniser `sw.js` `VER`**, commit + push sur `main`. NE PAS réintroduire l'unregister du service worker.
- **Pas de framework de test dans ce repo** → chaque tâche se vérifie **dans le navigateur** (serveur local `python3 -m http.server` + capture Playwright, ou vérification manuelle). Les « Step: vérifier » décrivent l'observation attendue.

### Namespace & helpers réutilisables (déjà présents dans v2-mkt.js / app)
- `window.V2` : objet global. `V2.pages.marketing.render(root, param)` = routeur Marketing.
- `V2.sb()` : client Supabase (ou null). `V2.user` : `{email}`. `V2.esc(s)` : échappe le HTML.
- `V2.go(page, param)` : navigue (déclenche un render). `V2.render()` : re-render la route courante.
- `V2.route` : `{name, param}`. `V2.topbar({back,backTo,backLabel})` : barre du haut.
- `V2.motion` (optionnel) : `stagger`, `enter`, `magnetic`.

---

## File Structure

- **Create `crm/v2/v2-mkt-linkedin.js`** — tout le sous-module (data + vues calendrier/liste/éditeur/import/rétroplanning). Responsabilité unique : le rétroplanning LinkedIn. Exposé sous `V2.mktLinkedin` (+ handlers `onclick` sous `V2.li`).
- **Modify `crm/v2/v2-mkt.js`** — (a) dispatcher : `else if (param === 'linkedin') V2.mktLinkedin.render(root);` ; (b) `renderList` : ajouter une entrée « Rétroplanning LinkedIn » (lien `V2.go('marketing','linkedin')`) ; (c) badge « à publier » (compteur) sur cette entrée.
- **Modify `crm/v2/index.html`** — ajouter `<script src="v2-mkt-linkedin.js?v=…"></script>` AVANT `v2-mkt.js` (pour que `V2.mktLinkedin` existe au dispatch) ou juste après (le dispatch est appelé à l'exécution, donc l'ordre importe peu, mais on le met juste après `v2-mkt.js` pour rester groupé) — voir Task 1.
- **Modify `crm/v2/sw.js`** — bump `VER` (Task 9).
- **Create `docs/supabase/linkedin_posts.sql`** — SQL de la table + RLS + note bucket (Task 9).

---

### Task 1: Scaffold du module + branchement routeur + entrée dans le menu Marketing

**Files:**
- Create: `crm/v2/v2-mkt-linkedin.js`
- Modify: `crm/v2/index.html` (ajout du `<script>`)
- Modify: `crm/v2/v2-mkt.js` (dispatcher `render` + entrée menu)

**Interfaces:**
- Produces: `V2.mktLinkedin.render(root)` — rend le sous-module dans l'élément `root`. `V2.li` — objet des handlers `onclick`.

- [ ] **Step 1: Créer le squelette du module**

Create `crm/v2/v2-mkt-linkedin.js` :

```javascript
/* CRM V2 · Sous-module "Rétroplanning LinkedIn" (pages.marketing?linkedin)
   100% client-side. Supabase (V2.sb) primaire, repli localStorage. */
(function () {
  var V2 = window.V2 = window.V2 || {};
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s); };
  function sb() { return (V2.sb && V2.sb()) || null; }

  // ── État de vue ──
  var view = 'cal';                 // 'cal' | 'list'
  var calRef = new Date();          // mois affiché (1er du mois)
  calRef.setDate(1);

  // ── Piliers éditoriaux (modifiable) ──
  var PILLARS = [
    { k: 'produit',     label: 'Produit',              color: '#0057FF' },
    { k: 'conseil',     label: 'Conseil officine',     color: '#00B37A' },
    { k: 'coulisses',   label: 'Coulisses / logistique', color: '#FFB020' },
    { k: 'recrutement', label: 'Recrutement',          color: '#FF4D6D' },
    { k: 'tempsfort',   label: 'Temps fort',           color: '#8B5CF6' }
  ];
  function pillar(k) { for (var i = 0; i < PILLARS.length; i++) if (PILLARS[i].k === k) return PILLARS[i]; return PILLARS[0]; }

  // ── Statuts ──
  var STATUSES = [
    { k: 'idee',      label: 'Idée',        icon: '💡' },
    { k: 'redaction', label: 'En rédaction', icon: '✍️' },
    { k: 'pret',      label: 'Prêt',        icon: '✅' },
    { k: 'publie',    label: 'Publié',      icon: '📢' }
  ];
  function statusOf(k) { for (var i = 0; i < STATUSES.length; i++) if (STATUSES[i].k === k) return STATUSES[i]; return STATUSES[0]; }

  // ── Rendu (placeholder pour la Task 1) ──
  function render(root) {
    root.innerHTML =
      (V2.topbar ? V2.topbar({ back: true, backTo: 'marketing', backLabel: 'Marketing' }) : '') +
      '<div class="li-wrap"><h1 class="li-h1">Rétroplanning LinkedIn</h1>' +
      '<p class="li-empty">Module en cours de construction.</p></div>';
  }

  V2.mktLinkedin = { render: render, PILLARS: PILLARS, STATUSES: STATUSES, pillar: pillar, statusOf: statusOf };
  V2.li = V2.li || {};
})();
```

- [ ] **Step 2: Charger le script dans index.html**

Modify `crm/v2/index.html` — juste après la ligne `<script src="v2-mkt.js?v=20260703d23"></script>`, ajouter (même version de cache, sera bumpée en Task 9) :

```html
  <script src="v2-mkt-linkedin.js?v=20260703d23"></script>
```

- [ ] **Step 3: Brancher le dispatcher du routeur Marketing**

Modify `crm/v2/v2-mkt.js` — dans `V2.pages.marketing.render`, la chaîne de `else if` (repère actuel ~lignes 1132-1136). Ajouter AVANT `else if (param) renderEditor…` :

```javascript
      else if (param === 'linkedin') { if (V2.mktLinkedin) V2.mktLinkedin.render(root); else root.innerHTML = ''; }
```

Résultat attendu de la chaîne :
```javascript
      else if (param === 'site') renderSite(root);
      else if (param === 'propositions') renderPropositions(root);
      else if (param === 'fxbank') renderFxBank(root);
      else if (param === 'docs') renderDocs(root);
      else if (param === 'linkedin') { if (V2.mktLinkedin) V2.mktLinkedin.render(root); else root.innerHTML = ''; }
      else if (param) renderEditor(root, param); else renderList(root);
```

- [ ] **Step 4: Ajouter l'entrée « Rétroplanning LinkedIn » dans le menu Marketing**

Modify `crm/v2/v2-mkt.js` — dans `renderList`, à côté des liens existants (repère : le lien `V2.go('marketing','propositions')` ~ligne 309 et `…'fxbank'` ~315). Ajouter un lien similaire :

```javascript
          '<a class="mkt-link" onclick="V2.go(\'marketing\',\'linkedin\')">' +
            '<span class="mkt-link-t">Rétroplanning LinkedIn</span>' +
            '<span class="mkt-link-s">Calendrier éditorial · préparer et planifier vos posts</span>' +
          '</a>' +
```
(Coller EXACTEMENT dans la même concaténation `+` que les liens `propositions`/`fxbank` — respecter la structure `'<a …>' + … + '</a>' +`.)

- [ ] **Step 5: Vérifier dans le navigateur**

Servir et ouvrir :
```bash
cd /Users/williammorel/JARVIS/APP && python3 -m http.server 8090 --directory crm >/dev/null 2>&1 &
```
Aller sur `http://localhost:8090/v2/` (se connecter : `demo@integralpharma.fr` / `***RETIRE***`), onglet **Marketing** → cliquer **Rétroplanning LinkedIn**.
Attendu : une page avec le titre « Rétroplanning LinkedIn », la topbar « ← Marketing », et le texte « Module en cours de construction ». Aucune erreur console.

- [ ] **Step 6: Commit**

```bash
git add crm/v2/v2-mkt-linkedin.js crm/v2/index.html crm/v2/v2-mkt.js
git commit -m "feat(mkt-linkedin): scaffold du sous-module + branchement routeur Marketing"
```

---

### Task 2: Couche de données `linkedin_posts` (Supabase + repli localStorage)

**Files:**
- Modify: `crm/v2/v2-mkt-linkedin.js`

**Interfaces:**
- Produces (dans le module) :
  - `newId()` → `string` (`'li' + timestamp`)
  - `loadPosts()` → `Promise<Array<Post>>` (remplit `posts`, définit `backend`)
  - `savePost(p)` → `Promise<Array<Post>>`
  - `removePost(id)` → `Promise<Array<Post>>`
  - `posts` (Array), `backend` (`'supabase'|'local'`)
  - Type `Post` : `{ id, date (ISO string), status, pillar, title, body, image_path, linkedin_url, event_id, event_name, source, created_at, updated_at }`

- [ ] **Step 1: Ajouter la couche de données dans le module**

Modify `crm/v2/v2-mkt-linkedin.js` — insérer AVANT `function render` :

```javascript
  // ── Données ──
  var LS = 'jarvis_li_posts';
  var backend = 'local';
  var posts = [];

  function newId() { return 'li' + Date.now() + Math.floor((window.performance && performance.now ? performance.now() : 0) % 1000); }
  function localAll() { try { var a = JSON.parse(localStorage.getItem(LS) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function localWrite(a) { try { localStorage.setItem(LS, JSON.stringify(a)); } catch (e) {} }

  function fromRow(r) {
    return { id: r.id, date: r.date, status: r.status || 'idee', pillar: r.pillar || 'produit',
      title: r.title || '', body: r.body || '', image_path: r.image_path || '', linkedin_url: r.linkedin_url || '',
      event_id: r.event_id || '', event_name: r.event_name || '', source: r.source || 'manuel',
      created_at: r.created_at || null, updated_at: r.updated_at || null };
  }
  function toRow(p) {
    return { id: p.id, date: p.date, status: p.status, pillar: p.pillar, title: p.title, body: p.body,
      image_path: p.image_path || '', linkedin_url: p.linkedin_url || '', event_id: p.event_id || '',
      event_name: p.event_name || '', source: p.source || 'manuel',
      owner: (V2.user && V2.user.email) || '', updated_at: new Date().toISOString() };
  }

  function loadPosts() {
    var c = sb();
    if (c) {
      return c.from('linkedin_posts').select('*').order('date', { ascending: true })
        .then(function (r) {
          if (!r.error && r.data) { backend = 'supabase'; posts = r.data.map(fromRow); return posts; }
          backend = 'local'; posts = localAll(); return posts;
        }).catch(function () { backend = 'local'; posts = localAll(); return posts; });
    }
    backend = 'local'; posts = localAll();
    return Promise.resolve(posts);
  }

  function saveLocal(p) {
    var a = localAll(), i = -1;
    for (var k = 0; k < a.length; k++) if (a[k].id === p.id) { i = k; break; }
    if (i >= 0) a[i] = p; else a.push(p);
    localWrite(a); posts = a; return a;
  }
  function savePost(p) {
    if (!p.id) p.id = newId();
    if (!p.created_at) p.created_at = new Date().toISOString();
    p.updated_at = new Date().toISOString();
    var c = sb();
    if (backend === 'supabase' && c) {
      return c.from('linkedin_posts').upsert(toRow(p)).then(function (r) {
        if (r.error) { saveLocal(p); return posts; } return loadPosts();
      }).catch(function () { saveLocal(p); return Promise.resolve(posts); });
    }
    return Promise.resolve(saveLocal(p));
  }
  function removePost(id) {
    var c = sb();
    if (backend === 'supabase' && c) {
      return c.from('linkedin_posts').delete().eq('id', id).then(function () { return loadPosts(); })
        .catch(function () { localWrite(localAll().filter(function (x) { return x.id !== id; })); posts = localAll(); return posts; });
    }
    localWrite(localAll().filter(function (x) { return x.id !== id; })); posts = localAll();
    return Promise.resolve(posts);
  }
```

- [ ] **Step 2: Charger les posts au render + exposer une méthode de test**

Modify `render` pour charger puis re-rendre, et exposer un helper de test :

```javascript
  function render(root) {
    root.innerHTML = (V2.topbar ? V2.topbar({ back: true, backTo: 'marketing', backLabel: 'Marketing' }) : '') +
      '<div class="li-wrap"><h1 class="li-h1">Rétroplanning LinkedIn</h1>' +
      '<p class="li-empty" id="li-status">Chargement… (' + posts.length + ' post(s))</p></div>';
    loadPosts().then(function () {
      var el = document.getElementById('li-status');
      if (el) el.textContent = posts.length + ' post(s) · stockage : ' + backend;
    });
  }
```

Et compléter l'export :

```javascript
  V2.mktLinkedin = { render: render, PILLARS: PILLARS, STATUSES: STATUSES, pillar: pillar, statusOf: statusOf,
    loadPosts: loadPosts, savePost: savePost, removePost: removePost, _posts: function () { return posts; }, newId: newId };
```

- [ ] **Step 3: Vérifier la persistance localStorage dans le navigateur**

Sur `http://localhost:8090/v2/` (Marketing → Rétroplanning LinkedIn), dans la console DevTools :
```javascript
V2.mktLinkedin.savePost({date:new Date().toISOString(), status:'idee', pillar:'produit', title:'Test', body:'Bonjour', source:'manuel'})
  .then(()=>V2.mktLinkedin.loadPosts()).then(p=>console.log('OK', p.length, p[0]));
```
Attendu : `OK 1 {…}`. Recharger la page → la ligne « X post(s) · stockage : local » affiche `1 post(s)`.

- [ ] **Step 4: Commit**

```bash
git add crm/v2/v2-mkt-linkedin.js
git commit -m "feat(mkt-linkedin): couche de donnees linkedin_posts (Supabase + repli localStorage)"
```

---

### Task 3: Vue Calendrier (mois) avec posts colorés par pilier

**Files:**
- Modify: `crm/v2/v2-mkt-linkedin.js`

**Interfaces:**
- Consumes: `posts`, `pillar()`, `statusOf()`, `calRef`.
- Produces: `renderCal(root)`, handlers `V2.li.prevMonth()`, `V2.li.nextMonth()`, `V2.li.today()`, `V2.li.newAt(iso)`, `V2.li.openPost(id)` (openPost implémenté en Task 4 — ici il ouvrira un `alert` temporaire remplacé ensuite).

- [ ] **Step 1: Ajouter les utilitaires de date + le rendu du calendrier**

Modify `crm/v2/v2-mkt-linkedin.js` — insérer avant `function render` :

```javascript
  // ── Utilitaires date ──
  function ymd(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function sameDay(iso, d) { return iso && iso.slice(0, 10) === ymd(d); }
  var MONTHS = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
  var DOW = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];

  function postsOnDay(d) { return posts.filter(function (p) { return sameDay(p.date, d); }); }

  function renderCal(root) {
    var y = calRef.getFullYear(), m = calRef.getMonth();
    var first = new Date(y, m, 1);
    var startDow = (first.getDay() + 6) % 7; // Lundi = 0
    var daysInMonth = new Date(y, m + 1, 0).getDate();
    var todayStr = ymd(new Date());

    var legend = PILLARS.map(function (p) {
      return '<span class="li-leg"><i style="background:' + p.color + '"></i>' + esc(p.label) + '</span>';
    }).join('');

    var cells = '';
    for (var i = 0; i < startDow; i++) cells += '<div class="li-cell li-out"></div>';
    for (var day = 1; day <= daysInMonth; day++) {
      var d = new Date(y, m, day), iso = ymd(d);
      var pl = postsOnDay(d).map(function (p) {
        var pc = pillar(p.pillar), st = statusOf(p.status);
        return '<button class="li-pill" style="--pc:' + pc.color + '" title="' + esc(st.label) + '" ' +
          'onclick="event.stopPropagation();V2.li.openPost(\'' + esc(p.id) + '\')">' +
          '<span class="li-pill-dot">' + st.icon + '</span>' + esc(p.title || p.body.slice(0, 22) || 'Post') + '</button>';
      }).join('');
      cells += '<div class="li-cell' + (iso === todayStr ? ' li-today' : '') + '" onclick="V2.li.newAt(\'' + iso + '\')">' +
        '<span class="li-num">' + day + '</span>' + pl + '</div>';
    }

    root.innerHTML = (V2.topbar ? V2.topbar({ back: true, backTo: 'marketing', backLabel: 'Marketing' }) : '') +
      '<div class="li-wrap">' +
        '<div class="li-bar">' +
          '<h1 class="li-h1">Rétroplanning LinkedIn</h1>' +
          '<div class="li-actions">' +
            '<button class="li-btn" onclick="V2.li.setView(\'cal\')">Calendrier</button>' +
            '<button class="li-btn" onclick="V2.li.setView(\'list\')">Liste</button>' +
            '<button class="li-btn li-btn-p" onclick="V2.li.newAt(\'' + todayStr + '\')">+ Post</button>' +
            '<button class="li-btn" onclick="V2.li.newEvent()">+ Temps fort</button>' +
            '<button class="li-btn" onclick="V2.li.importOpen()">Import</button>' +
          '</div>' +
        '</div>' +
        '<div class="li-calbar">' +
          '<button class="li-nav" onclick="V2.li.prevMonth()">‹</button>' +
          '<b>' + MONTHS[m] + ' ' + y + '</b>' +
          '<button class="li-nav" onclick="V2.li.nextMonth()">›</button>' +
          '<button class="li-nav li-navtoday" onclick="V2.li.today()">Aujourd\'hui</button>' +
          '<div class="li-legend">' + legend + '</div>' +
        '</div>' +
        '<div class="li-dow">' + DOW.map(function (x) { return '<span>' + x + '</span>'; }).join('') + '</div>' +
        '<div class="li-grid">' + cells + '</div>' +
      '</div>';
  }
```

- [ ] **Step 2: Ajouter les handlers de navigation + le CSS**

Modify — compléter `V2.li` (après sa déclaration) :

```javascript
  V2.li.setView = function (v) { view = v; V2.render(); };
  V2.li.prevMonth = function () { calRef.setMonth(calRef.getMonth() - 1); V2.render(); };
  V2.li.nextMonth = function () { calRef.setMonth(calRef.getMonth() + 1); V2.render(); };
  V2.li.today = function () { calRef = new Date(); calRef.setDate(1); V2.render(); };
  V2.li.newAt = function (iso) { alert('Nouveau post le ' + iso + ' (éditeur en Task 4)'); };
  V2.li.openPost = function (id) { alert('Ouvrir post ' + id + ' (éditeur en Task 4)'); };
  V2.li.newEvent = function () { alert('Temps fort (Task 6)'); };
  V2.li.importOpen = function () { alert('Import (Task 7)'); };
```

Ajouter le CSS (injection unique) — insérer en tête du module, après `var esc = …` :

```javascript
  (function injectCss() {
    if (document.getElementById('li-css')) return;
    var s = document.createElement('style'); s.id = 'li-css';
    s.textContent =
      '.li-wrap{max-width:1080px;margin:0 auto;padding:8px 16px 60px}' +
      '.li-h1{font-size:22px;font-weight:800;margin:0}' +
      '.li-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:10px 0}' +
      '.li-actions{display:flex;gap:8px;flex-wrap:wrap}' +
      '.li-btn{background:#0e1730;color:#e8eeff;border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:8px 12px;font:600 13px/1 inherit;cursor:pointer}' +
      '.li-btn-p{background:#0057FF;border-color:#0057FF;color:#fff}' +
      '.li-calbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:6px 0 10px}' +
      '.li-nav{background:transparent;border:1px solid rgba(255,255,255,.14);color:inherit;border-radius:8px;width:34px;height:34px;cursor:pointer}' +
      '.li-navtoday{width:auto;padding:0 12px}' +
      '.li-legend{display:flex;gap:14px;flex-wrap:wrap;margin-left:auto;font-size:12px;opacity:.85}' +
      '.li-leg i{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:5px}' +
      '.li-dow{display:grid;grid-template-columns:repeat(7,1fr);gap:6px;font-size:11px;opacity:.7;padding:0 2px 4px}' +
      '.li-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:6px}' +
      '.li-cell{min-height:96px;border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:6px;cursor:pointer;background:rgba(255,255,255,.02)}' +
      '.li-cell.li-out{background:transparent;border:0;cursor:default}' +
      '.li-cell.li-today{border-color:#0057FF;box-shadow:inset 0 0 0 1px #0057FF}' +
      '.li-num{font-size:12px;opacity:.6}' +
      '.li-pill{display:flex;align-items:center;gap:5px;width:100%;text-align:left;margin-top:4px;padding:4px 6px;border:0;border-left:3px solid var(--pc);border-radius:6px;background:rgba(255,255,255,.06);color:inherit;font:600 11px/1.2 inherit;cursor:pointer;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}' +
      '.li-empty{opacity:.7;margin-top:20px}';
    document.head.appendChild(s);
  })();
```

- [ ] **Step 3: Router `render` vers `renderCal`/`renderList`**

Modify `render` :

```javascript
  function render(root) {
    if (!posts.length) {
      // premier rendu : charge puis re-render
      loadPosts().then(function () { if (V2.route && V2.route.name === 'marketing' && V2.route.param === 'linkedin') V2.render(); });
    }
    if (view === 'list') return renderList2(root);   // renderList2 en Task 8 ; d'ici là, fallback :
    return renderCal(root);
  }
```
(Note : `renderList2` est défini en Task 8. En attendant, ajouter un stub pour éviter l'erreur : `function renderList2(root){ renderCal(root); }` — sera remplacé en Task 8.)

- [ ] **Step 4: Vérifier dans le navigateur**

Recharger `http://localhost:8090/v2/` → Marketing → Rétroplanning LinkedIn.
Attendu : un calendrier du mois courant, la barre d'actions, la légende des piliers, le jour du jour encadré en bleu. Le post « Test » créé en Task 2 (si sa date est ce mois) apparaît en pastille. Cliquer un jour → `alert` « Nouveau post le … ». Aucune erreur console.

- [ ] **Step 5: Commit**

```bash
git add crm/v2/v2-mkt-linkedin.js
git commit -m "feat(mkt-linkedin): vue calendrier mensuelle avec posts par pilier"
```

---

### Task 4: Éditeur de post (texte, pilier, date, statut, visuel, lien)

**Files:**
- Modify: `crm/v2/v2-mkt-linkedin.js`

**Interfaces:**
- Consumes: `savePost`, `removePost`, `PILLARS`, `STATUSES`, `pillar`, `posts`, bucket `marketing-media` via `sb().storage`.
- Produces: `renderEditor(post)` (overlay), handlers `V2.li.newAt` (remplace le stub), `V2.li.openPost` (remplace le stub), `V2.li.editField(field,val)`, `V2.li.save()`, `V2.li.del()`, `V2.li.closeEditor()`, `V2.li.uploadImg(input)`.

- [ ] **Step 1: État d'édition + overlay**

Modify `crm/v2/v2-mkt-linkedin.js` — ajouter l'état + le rendu de l'overlay (insérer avant `V2.mktLinkedin = …`) :

```javascript
  var editing = null; // Post en cours d'édition (copie)

  function openEditor(p) {
    editing = p ? JSON.parse(JSON.stringify(p)) : {
      id: '', date: new Date().toISOString(), status: 'idee', pillar: 'produit',
      title: '', body: '', image_path: '', linkedin_url: '', event_id: '', event_name: '', source: 'manuel'
    };
    drawEditor();
  }
  function drawEditor() {
    var host = document.getElementById('li-editor');
    if (!host) { host = document.createElement('div'); host.id = 'li-editor'; document.body.appendChild(host); }
    if (!editing) { host.innerHTML = ''; return; }
    var e = editing, dt = (e.date || '').slice(0, 16); // yyyy-mm-ddThh:mm
    var pills = PILLARS.map(function (p) {
      return '<button class="li-ch' + (e.pillar === p.k ? ' on' : '') + '" style="--pc:' + p.color + '" onclick="V2.li.editField(\'pillar\',\'' + p.k + '\')">' + esc(p.label) + '</button>';
    }).join('');
    var stat = STATUSES.map(function (s) {
      return '<button class="li-ch' + (e.status === s.k ? ' on' : '') + '" onclick="V2.li.editField(\'status\',\'' + s.k + '\')">' + s.icon + ' ' + esc(s.label) + '</button>';
    }).join('');
    var img = e.image_path
      ? '<div class="li-imgprev"><img src="' + esc(imgUrl(e.image_path)) + '" alt=""><button class="li-btn" onclick="V2.li.editField(\'image_path\',\'\')">Retirer</button></div>'
      : '<label class="li-btn">Ajouter un visuel<input type="file" accept="image/*" style="display:none" onchange="V2.li.uploadImg(this)"></label>' +
        '<input class="li-in" placeholder="…ou coller une URL d\'image" value="" oninput="V2.li.editField(\'image_path\',this.value)">';
    host.innerHTML =
      '<div class="li-ov" onclick="if(event.target===this)V2.li.closeEditor()"><div class="li-panel">' +
        '<div class="li-panelhd"><b>' + (e.id ? 'Modifier le post' : 'Nouveau post') + '</b>' +
          '<button class="li-x" onclick="V2.li.closeEditor()">✕</button></div>' +
        '<label class="li-lab">Titre court</label>' +
        '<input class="li-in" value="' + esc(e.title) + '" oninput="V2.li.editField(\'title\',this.value)" placeholder="ex : Teaser salon Pharmagora">' +
        '<label class="li-lab">Texte du post <span id="li-count">' + (e.body || '').length + ' / 3000</span></label>' +
        '<textarea class="li-ta" oninput="V2.li.editField(\'body\',this.value)" placeholder="Rédigez votre post LinkedIn…">' + esc(e.body) + '</textarea>' +
        '<label class="li-lab">Pilier</label><div class="li-chips">' + pills + '</div>' +
        '<label class="li-lab">Statut</label><div class="li-chips">' + stat + '</div>' +
        '<label class="li-lab">Date & heure</label>' +
        '<input class="li-in" type="datetime-local" value="' + dt + '" oninput="V2.li.editField(\'date\',this.value)">' +
        '<label class="li-lab">Visuel</label><div class="li-imgrow">' + img + '</div>' +
        '<label class="li-lab">Lien LinkedIn (après publication)</label>' +
        '<input class="li-in" value="' + esc(e.linkedin_url) + '" oninput="V2.li.editField(\'linkedin_url\',this.value)" placeholder="https://www.linkedin.com/posts/…">' +
        '<div class="li-panelft">' +
          (e.id ? '<button class="li-btn li-del" onclick="V2.li.del()">Supprimer</button>' : '<span></span>') +
          '<div><button class="li-btn" onclick="V2.li.closeEditor()">Annuler</button>' +
          '<button class="li-btn li-btn-p" onclick="V2.li.save()">Enregistrer</button></div>' +
        '</div>' +
      '</div></div>';
  }
  function imgUrl(path) {
    if (!path) return '';
    if (/^https?:/.test(path)) return path;
    var c = sb(); if (c && c.storage) { try { return c.storage.from('marketing-media').getPublicUrl(path).data.publicUrl; } catch (e) {} }
    return path;
  }
```

- [ ] **Step 2: Handlers d'édition**

Modify — remplacer les stubs `V2.li.newAt`/`V2.li.openPost` et ajouter les nouveaux :

```javascript
  V2.li.newAt = function (iso) {
    var d = new Date(); if (iso && iso.length >= 10) { d = new Date(iso + 'T09:00'); }
    openEditor({ id: '', date: d.toISOString(), status: 'idee', pillar: 'produit', title: '', body: '', image_path: '', linkedin_url: '', event_id: '', event_name: '', source: 'manuel' });
  };
  V2.li.openPost = function (id) { var p = null; for (var i = 0; i < posts.length; i++) if (posts[i].id === id) p = posts[i]; if (p) openEditor(p); };
  V2.li.editField = function (f, v) {
    if (!editing) return;
    if (f === 'date') { var d = new Date(v); if (!isNaN(d.getTime())) editing.date = d.toISOString(); return; }
    editing[f] = v;
    if (f === 'body') { var c = document.getElementById('li-count'); if (c) c.textContent = v.length + ' / 3000'; }
    if (f === 'pillar' || f === 'status' || f === 'image_path') drawEditor();
  };
  V2.li.closeEditor = function () { editing = null; drawEditor(); };
  V2.li.save = function () {
    if (!editing) return;
    var p = editing; editing = null; drawEditor();
    savePost(p).then(function () { V2.render(); });
  };
  V2.li.del = function () {
    if (!editing || !editing.id) { V2.li.closeEditor(); return; }
    if (!confirm('Supprimer ce post ?')) return;
    var id = editing.id; editing = null; drawEditor();
    removePost(id).then(function () { V2.render(); });
  };
  V2.li.uploadImg = function (input) {
    var f = input.files && input.files[0]; if (!f || !editing) return;
    var c = sb();
    if (!(c && c.storage) || backend !== 'supabase') { alert('Upload d\'image indisponible hors-ligne. Collez une URL d\'image à la place.'); return; }
    var path = 'linkedin/' + Date.now() + '_' + f.name.replace(/[^a-zA-Z0-9._-]/g, '');
    c.storage.from('marketing-media').upload(path, f, { upsert: true }).then(function (r) {
      if (r.error) { alert('Échec de l\'upload : ' + r.error.message); return; }
      editing.image_path = path; drawEditor();
    });
  };
```

- [ ] **Step 3: CSS de l'éditeur**

Modify — ajouter à la chaîne `s.textContent` du bloc `injectCss` :

```javascript
      '.li-ov{position:fixed;inset:0;z-index:200;background:rgba(3,6,14,.6);display:flex;justify-content:flex-end}' +
      '.li-panel{width:min(520px,94vw);height:100%;overflow:auto;background:#0b1020;border-left:1px solid rgba(255,255,255,.12);padding:18px 20px;display:flex;flex-direction:column;gap:6px}' +
      '.li-panelhd{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}' +
      '.li-x{background:transparent;border:0;color:inherit;font-size:18px;cursor:pointer}' +
      '.li-lab{font-size:12px;opacity:.7;margin-top:10px}' +
      '.li-in,.li-ta{width:100%;background:#0e1730;border:1px solid rgba(255,255,255,.14);border-radius:8px;color:inherit;padding:9px 11px;font:inherit}' +
      '.li-ta{min-height:120px;resize:vertical;line-height:1.5}' +
      '#li-count{float:right;opacity:.6}' +
      '.li-chips{display:flex;gap:7px;flex-wrap:wrap}' +
      '.li-ch{background:#0e1730;border:1px solid rgba(255,255,255,.14);border-left:3px solid var(--pc,transparent);border-radius:999px;color:inherit;padding:7px 12px;font:600 12px/1 inherit;cursor:pointer}' +
      '.li-ch.on{background:#0057FF;border-color:#0057FF}' +
      '.li-imgrow{display:flex;gap:8px;align-items:center;flex-wrap:wrap}' +
      '.li-imgprev img{max-width:160px;border-radius:8px;display:block;margin-bottom:6px}' +
      '.li-panelft{display:flex;justify-content:space-between;gap:8px;margin-top:16px}' +
      '.li-del{border-color:#FF4D6D;color:#FF4D6D}';
```

- [ ] **Step 4: Vérifier dans le navigateur**

Recharger → cliquer un jour → l'éditeur s'ouvre à droite. Saisir titre + texte (le compteur bouge), choisir un pilier + statut, Enregistrer. Le post apparaît sur le calendrier à la bonne date, avec la couleur du pilier. Re-cliquer dessus → l'éditeur ré-affiche les valeurs. Supprimer → il disparaît. Aucune erreur console.

- [ ] **Step 5: Commit**

```bash
git add crm/v2/v2-mkt-linkedin.js
git commit -m "feat(mkt-linkedin): editeur de post (texte, pilier, statut, date, visuel, lien)"
```

---

### Task 5: Barre « À publier » + publier en 1 clic + badge sur l'onglet Marketing

**Files:**
- Modify: `crm/v2/v2-mkt-linkedin.js`
- Modify: `crm/v2/v2-mkt.js` (badge de compte sur l'entrée du menu)

**Interfaces:**
- Consumes: `posts`.
- Produces: `duePosts()` → `Array<Post>` (date ≤ maintenant et status ≠ 'publie') ; `V2.li.publish(id)` ; `V2.mktLinkedin.dueCount()` → `number` (pour le badge).

- [ ] **Step 1: Calcul des posts dus + barre en haut du calendrier**

Modify `crm/v2/v2-mkt-linkedin.js` — ajouter :

```javascript
  function duePosts() {
    var now = Date.now();
    return posts.filter(function (p) { return p.status !== 'publie' && p.date && new Date(p.date).getTime() <= now; })
      .sort(function (a, b) { return new Date(a.date) - new Date(b.date); });
  }
```

Dans `renderCal`, juste après l'ouverture de `'<div class="li-wrap">'`, insérer la barre :

```javascript
        (function () {
          var due = duePosts(); if (!due.length) return '';
          var rows = due.map(function (p) {
            return '<div class="li-duerow"><span class="li-duedot" style="background:' + pillar(p.pillar).color + '"></span>' +
              '<span class="li-duet">' + esc(p.title || p.body.slice(0, 40) || 'Post') + '</span>' +
              '<span class="li-dued">' + (p.date || '').slice(0, 10) + '</span>' +
              '<button class="li-btn" onclick="V2.li.openPost(\'' + esc(p.id) + '\')">Ouvrir</button>' +
              '<button class="li-btn li-btn-p" onclick="V2.li.publish(\'' + esc(p.id) + '\')">Publier</button></div>';
          }).join('');
          return '<div class="li-due"><b>⚠ À publier (' + due.length + ')</b>' + rows + '</div>';
        })() +
```

- [ ] **Step 2: Publier en 1 clic (copie + ouverture LinkedIn + marquer publié)**

Modify — ajouter :

```javascript
  V2.li.publish = function (id) {
    var p = null; for (var i = 0; i < posts.length; i++) if (posts[i].id === id) p = posts[i];
    if (!p) return;
    var txt = p.body || '';
    function afterCopy() {
      window.open('https://www.linkedin.com/company/setup/new/', '_blank'); // ouvre LinkedIn (page/compositeur)
      if (confirm('Texte copié. LinkedIn est ouvert : collez, ajoutez le visuel et publiez.\n\nMarquer ce post comme « Publié » ?')) {
        var url = prompt('Collez le lien du post publié (facultatif) :', p.linkedin_url || '');
        p.status = 'publie'; if (url) p.linkedin_url = url;
        savePost(p).then(function () { V2.render(); });
      }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(afterCopy, function () { window.prompt('Copiez le texte :', txt); afterCopy(); });
    } else { window.prompt('Copiez le texte :', txt); afterCopy(); }
  };
```

Ajouter le CSS (bloc `injectCss`) :

```javascript
      '.li-due{background:rgba(255,77,109,.08);border:1px solid rgba(255,77,109,.3);border-radius:12px;padding:12px 14px;margin:6px 0 14px}' +
      '.li-duerow{display:flex;align-items:center;gap:10px;margin-top:8px}' +
      '.li-duedot{width:9px;height:9px;border-radius:50%;flex:none}' +
      '.li-duet{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.li-dued{opacity:.6;font-size:12px}';
```

- [ ] **Step 3: Badge de compte sur l'entrée du menu Marketing**

Modify `crm/v2/v2-mkt-linkedin.js` — exposer :

```javascript
  V2.mktLinkedin.dueCount = function () { try { return duePosts().length; } catch (e) { return 0; } };
```

Modify `crm/v2/v2-mkt.js` — dans `renderList`, sur l'entrée « Rétroplanning LinkedIn » créée en Task 1, ajouter un badge dynamique. Remplacer le `<span class="mkt-link-t">Rétroplanning LinkedIn</span>` par :

```javascript
            '<span class="mkt-link-t">Rétroplanning LinkedIn' +
              ((V2.mktLinkedin && V2.mktLinkedin.dueCount && V2.mktLinkedin.dueCount() > 0) ? ' <b class="mkt-badge">' + V2.mktLinkedin.dueCount() + '</b>' : '') +
            '</span>' +
```

(Note : `dueCount()` lit `posts` en mémoire — s'assurer que `loadPosts()` a été appelé au moins une fois. Ajouter dans `renderList` de `v2-mkt.js`, en tête, un appel non bloquant : `if (V2.mktLinkedin && V2.mktLinkedin.loadPosts && !V2.mktLinkedin._posts().length) V2.mktLinkedin.loadPosts().then(function(){ if(V2.route&&V2.route.name==='marketing'&&!V2.route.param) V2.render(); });` — placer avant le `root.innerHTML =`.)

Ajouter le CSS du badge dans `v2-mkt-linkedin.js` (`injectCss`) : `'.mkt-badge{background:#FF4D6D;color:#fff;border-radius:999px;padding:1px 7px;font-size:11px;margin-left:6px}'`.

- [ ] **Step 4: Vérifier**

Créer un post daté d'hier, statut « prêt ». Retour au calendrier → la barre « ⚠ À publier (1) » apparaît. Cliquer « Publier » → le texte est copié, un onglet LinkedIn s'ouvre, la confirmation propose de marquer publié → OK → le post passe « publié » et sort de la barre. Retour au menu Marketing → un badge rouge affiche le compte de posts dus.

- [ ] **Step 5: Commit**

```bash
git add crm/v2/v2-mkt-linkedin.js crm/v2/v2-mkt.js
git commit -m "feat(mkt-linkedin): barre a publier + publier en 1 clic + badge menu"
```

---

### Task 6: Générateur de rétroplanning (temps fort à rebours)

**Files:**
- Modify: `crm/v2/v2-mkt-linkedin.js`

**Interfaces:**
- Consumes: `savePost`, `newId`.
- Produces: `V2.li.newEvent()` (remplace le stub) — modale ; `V2.li.genEvent(name, dateJ)` — crée les posts du gabarit.

- [ ] **Step 1: Gabarit + modale + génération**

Modify — ajouter le gabarit et remplacer le stub `V2.li.newEvent` :

```javascript
  var RETRO = [
    { off: -14, title: 'Teaser',        pillar: 'tempsfort' },
    { off: -7,  title: 'Annonce',       pillar: 'tempsfort' },
    { off: -1,  title: 'Rappel',        pillar: 'tempsfort' },
    { off: 0,   title: 'Jour J / live', pillar: 'tempsfort' },
    { off: 2,   title: 'Retour / bilan',pillar: 'conseil'   }
  ];

  V2.li.newEvent = function () {
    var host = document.getElementById('li-editor');
    if (!host) { host = document.createElement('div'); host.id = 'li-editor'; document.body.appendChild(host); }
    var todayStr = ymd(new Date());
    host.innerHTML =
      '<div class="li-ov" onclick="if(event.target===this)V2.li.closeEditor()"><div class="li-panel">' +
        '<div class="li-panelhd"><b>Nouveau temps fort</b><button class="li-x" onclick="V2.li.closeEditor()">✕</button></div>' +
        '<p class="li-lab">JARVIS créera automatiquement les posts brouillons à rebours : J-14, J-7, J-1, Jour J, J+2.</p>' +
        '<label class="li-lab">Nom du temps fort</label>' +
        '<input class="li-in" id="li-evname" placeholder="ex : Salon Pharmagora">' +
        '<label class="li-lab">Date du jour J</label>' +
        '<input class="li-in" id="li-evdate" type="date" value="' + todayStr + '">' +
        '<div class="li-panelft"><span></span><div>' +
          '<button class="li-btn" onclick="V2.li.closeEditor()">Annuler</button>' +
          '<button class="li-btn li-btn-p" onclick="V2.li.genEvent()">Générer le rétroplanning</button></div></div>' +
      '</div></div>';
  };

  V2.li.genEvent = function () {
    var name = (document.getElementById('li-evname') || {}).value || '';
    var dstr = (document.getElementById('li-evdate') || {}).value || '';
    if (!name.trim() || !dstr) { alert('Renseignez un nom et une date.'); return; }
    var evId = newId(), dJ = new Date(dstr + 'T09:00');
    var chain = Promise.resolve();
    RETRO.forEach(function (r) {
      var d = new Date(dJ.getTime()); d.setDate(d.getDate() + r.off);
      var p = { id: '', date: d.toISOString(), status: 'idee', pillar: r.pillar,
        title: name + ' — ' + r.title, body: '', image_path: '', linkedin_url: '',
        event_id: evId, event_name: name, source: 'retroplanning' };
      chain = chain.then(function () { return savePost(p); });
    });
    document.getElementById('li-editor').innerHTML = '';
    chain.then(function () { calRef = new Date(dJ.getTime()); calRef.setDate(1); V2.render(); });
  };
```

- [ ] **Step 2: Vérifier**

Cliquer « + Temps fort » → saisir « Salon Pharmagora » + une date → « Générer ». Le calendrier se positionne sur le mois du jour J et affiche 5 posts brouillons (Teaser, Annonce, Rappel, Jour J, Retour) aux bonnes dates, tous en pilier « Temps fort » (sauf le bilan). Ouvrir l'un d'eux → il est pré-titré. Aucune erreur console.

- [ ] **Step 3: Commit**

```bash
git add crm/v2/v2-mkt-linkedin.js
git commit -m "feat(mkt-linkedin): generateur de retroplanning a rebours (temps fort)"
```

---

### Task 7: Import de l'export LinkedIn (CSV) → anciens posts

**Files:**
- Modify: `crm/v2/v2-mkt-linkedin.js`

**Interfaces:**
- Consumes: `savePost`, `posts`.
- Produces: `V2.li.importOpen()` (remplace le stub) ; `parseCsv(text)` → `Array<Array<string>>` ; `V2.li.importFile(input)` ; `V2.li.doImport()`.

- [ ] **Step 1: Parseur CSV maison (gère guillemets, virgules, retours ligne)**

Modify — ajouter :

```javascript
  function parseCsv(text) {
    var rows = [], row = [], cur = '', i = 0, inQ = false, ch;
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    for (; i < text.length; i++) {
      ch = text[i];
      if (inQ) {
        if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
        else cur += ch;
      } else if (ch === '"') inQ = true;
      else if (ch === ',') { row.push(cur); cur = ''; }
      else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
      else cur += ch;
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    return rows.filter(function (r) { return r.length && !(r.length === 1 && r[0] === ''); });
  }
```

- [ ] **Step 2: Modale d'import + mapping des colonnes**

Modify — remplacer le stub `V2.li.importOpen` :

```javascript
  var importRows = null, importMap = { date: -1, body: -1, url: -1 };

  V2.li.importOpen = function () {
    var host = document.getElementById('li-editor');
    if (!host) { host = document.createElement('div'); host.id = 'li-editor'; document.body.appendChild(host); }
    host.innerHTML =
      '<div class="li-ov" onclick="if(event.target===this)V2.li.closeEditor()"><div class="li-panel">' +
        '<div class="li-panelhd"><b>Importer mes anciens posts</b><button class="li-x" onclick="V2.li.closeEditor()">✕</button></div>' +
        '<p class="li-lab">Déposez le fichier <b>.csv</b> de l\'export LinkedIn (Paramètres → Confidentialité → Obtenir une copie de vos données → Publications). On repère les colonnes date / texte / lien.</p>' +
        '<label class="li-btn">Choisir le fichier CSV<input type="file" accept=".csv,text/csv" style="display:none" onchange="V2.li.importFile(this)"></label>' +
        '<div id="li-impbody"></div>' +
      '</div></div>';
  };

  V2.li.importFile = function (input) {
    var f = input.files && input.files[0]; if (!f) return;
    var rdr = new FileReader();
    rdr.onload = function () {
      importRows = parseCsv(String(rdr.result));
      if (!importRows.length) { document.getElementById('li-impbody').innerHTML = '<p class="li-lab">Fichier vide ou illisible.</p>'; return; }
      var head = importRows[0];
      // auto-détection
      importMap = { date: -1, body: -1, url: -1 };
      head.forEach(function (h, idx) {
        var l = String(h).toLowerCase();
        if (importMap.date < 0 && /date/.test(l)) importMap.date = idx;
        if (importMap.body < 0 && /(comment|content|text|texte|message|share)/.test(l)) importMap.body = idx;
        if (importMap.url < 0 && /(link|url|lien)/.test(l)) importMap.url = idx;
      });
      var opts = function (sel) { return head.map(function (h, idx) { return '<option value="' + idx + '"' + (sel === idx ? ' selected' : '') + '>' + esc(h || ('Colonne ' + (idx + 1))) + '</option>'; }).join(''); };
      document.getElementById('li-impbody').innerHTML =
        '<p class="li-lab">' + (importRows.length - 1) + ' ligne(s) détectée(s). Vérifiez les colonnes :</p>' +
        '<label class="li-lab">Date</label><select class="li-in" onchange="V2.li.setMap(\'date\',this.value)">' + opts(importMap.date) + '</select>' +
        '<label class="li-lab">Texte</label><select class="li-in" onchange="V2.li.setMap(\'body\',this.value)">' + opts(importMap.body) + '</select>' +
        '<label class="li-lab">Lien</label><select class="li-in" onchange="V2.li.setMap(\'url\',this.value)">' + opts(importMap.url) + '</select>' +
        '<div class="li-panelft"><span></span><button class="li-btn li-btn-p" onclick="V2.li.doImport()">Importer</button></div>';
    };
    rdr.readAsText(f, 'utf-8');
  };
  V2.li.setMap = function (k, v) { importMap[k] = parseInt(v, 10); };
```

- [ ] **Step 3: Import effectif avec anti-doublon**

Modify — ajouter :

```javascript
  V2.li.doImport = function () {
    if (!importRows || importRows.length < 2) return;
    var existing = {}; posts.forEach(function (p) { existing[(p.linkedin_url || '') + '|' + (p.date || '').slice(0, 10)] = 1; });
    var chain = Promise.resolve(), added = 0;
    for (var r = 1; r < importRows.length; r++) {
      var row = importRows[r];
      var rawDate = importMap.date >= 0 ? row[importMap.date] : '';
      var body = importMap.body >= 0 ? (row[importMap.body] || '') : '';
      var url = importMap.url >= 0 ? (row[importMap.url] || '') : '';
      var d = new Date(rawDate); if (isNaN(d.getTime())) d = new Date();
      var key = (url || '') + '|' + ymd(d);
      if (existing[key]) continue; existing[key] = 1;
      (function (dd, bb, uu) {
        var p = { id: '', date: dd.toISOString(), status: 'publie', pillar: 'produit',
          title: bb.slice(0, 40), body: bb, image_path: '', linkedin_url: uu, event_id: '', event_name: '', source: 'import' };
        chain = chain.then(function () { return savePost(p); });
      })(d, body, url); added++;
    }
    importRows = null;
    document.getElementById('li-editor').innerHTML = '';
    chain.then(function () { alert(added + ' ancien(s) post(s) importé(s).'); V2.render(); });
  };
```

- [ ] **Step 4: Vérifier**

Créer un CSV de test :
```bash
printf 'Date,ShareCommentary,ShareLink\n2025-06-01 10:00,"Bonjour LinkedIn, notre nouvelle plateforme !",https://www.linkedin.com/posts/abc\n2025-05-15 09:00,"Recrutement en cours",https://www.linkedin.com/posts/def\n' > /tmp/li-test.csv
```
Marketing → Rétroplanning LinkedIn → Import → choisir `/tmp/li-test.csv` → les 3 colonnes sont auto-détectées → Importer → « 2 ancien(s) post(s) importé(s) ». Naviguer sur juin 2025 / mai 2025 → les posts « publié » apparaissent. Ré-importer le même fichier → « 0 ancien(s) post(s) importé(s) » (anti-doublon). Aucune erreur console.

- [ ] **Step 5: Commit**

```bash
git add crm/v2/v2-mkt-linkedin.js
git commit -m "feat(mkt-linkedin): import de l'export LinkedIn (CSV) avec mapping et anti-doublon"
```

---

### Task 8: Vue Liste filtrable

**Files:**
- Modify: `crm/v2/v2-mkt-linkedin.js`

**Interfaces:**
- Consumes: `posts`, `pillar`, `statusOf`.
- Produces: `renderList2(root)` (remplace le stub de Task 3) ; filtres `V2.li.filter(k,v)`.

- [ ] **Step 1: État de filtre + rendu liste**

Modify — remplacer le stub `function renderList2(root){ renderCal(root); }` par :

```javascript
  var flt = { status: '', pillar: '', q: '' };
  function renderList2(root) {
    var rows = posts.slice().sort(function (a, b) { return new Date(b.date) - new Date(a.date); }).filter(function (p) {
      if (flt.status && p.status !== flt.status) return false;
      if (flt.pillar && p.pillar !== flt.pillar) return false;
      if (flt.q && (p.title + ' ' + p.body + ' ' + p.event_name).toLowerCase().indexOf(flt.q.toLowerCase()) < 0) return false;
      return true;
    });
    var opt = function (arr, cur, allLabel) {
      return '<option value="">' + allLabel + '</option>' + arr.map(function (x) { return '<option value="' + x.k + '"' + (cur === x.k ? ' selected' : '') + '>' + esc(x.label) + '</option>'; }).join('');
    };
    var list = rows.map(function (p) {
      var pc = pillar(p.pillar), st = statusOf(p.status);
      return '<div class="li-lrow" onclick="V2.li.openPost(\'' + esc(p.id) + '\')">' +
        '<span class="li-duedot" style="background:' + pc.color + '"></span>' +
        '<span class="li-lrow-d">' + (p.date || '').slice(0, 10) + '</span>' +
        '<span class="li-lrow-t">' + esc(p.title || p.body.slice(0, 60) || 'Post') + '</span>' +
        '<span class="li-lrow-s">' + st.icon + ' ' + esc(st.label) + '</span>' +
        (p.event_name ? '<span class="li-lrow-e">' + esc(p.event_name) + '</span>' : '') + '</div>';
    }).join('') || '<p class="li-empty">Aucun post.</p>';
    root.innerHTML = (V2.topbar ? V2.topbar({ back: true, backTo: 'marketing', backLabel: 'Marketing' }) : '') +
      '<div class="li-wrap"><div class="li-bar"><h1 class="li-h1">Rétroplanning LinkedIn</h1>' +
        '<div class="li-actions">' +
          '<button class="li-btn" onclick="V2.li.setView(\'cal\')">Calendrier</button>' +
          '<button class="li-btn li-btn-p" onclick="V2.li.setView(\'list\')">Liste</button></div></div>' +
        '<div class="li-flt">' +
          '<input class="li-in" placeholder="Rechercher…" value="' + esc(flt.q) + '" oninput="V2.li.filter(\'q\',this.value)">' +
          '<select class="li-in" onchange="V2.li.filter(\'status\',this.value)">' + opt(STATUSES, flt.status, 'Tous les statuts') + '</select>' +
          '<select class="li-in" onchange="V2.li.filter(\'pillar\',this.value)">' + opt(PILLARS, flt.pillar, 'Tous les piliers') + '</select>' +
        '</div>' + '<div class="li-listwrap">' + list + '</div></div>';
  }
  V2.li.filter = function (k, v) { flt[k] = v; V2.render(); };
```

- [ ] **Step 2: CSS liste**

Modify — ajouter au bloc `injectCss` :

```javascript
      '.li-flt{display:flex;gap:8px;flex-wrap:wrap;margin:6px 0 14px}.li-flt .li-in{width:auto;flex:1;min-width:140px}' +
      '.li-lrow{display:flex;align-items:center;gap:12px;padding:10px 12px;border:1px solid rgba(255,255,255,.08);border-radius:10px;margin-bottom:7px;cursor:pointer}' +
      '.li-lrow:hover{border-color:rgba(255,255,255,.2)}' +
      '.li-lrow-d{opacity:.6;font-size:12px;width:82px;flex:none}.li-lrow-t{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.li-lrow-s{font-size:12px;opacity:.85}.li-lrow-e{font-size:11px;background:rgba(139,92,246,.2);color:#c4b5fd;border-radius:999px;padding:2px 9px}';
```

- [ ] **Step 3: Vérifier**

Marketing → Rétroplanning LinkedIn → bouton « Liste » → tous les posts en liste triée par date décroissante. Filtrer par statut « Publié » → n'affiche que les publiés (dont les importés). Rechercher un mot → filtre le texte. Cliquer une ligne → ouvre l'éditeur. Aucune erreur console.

- [ ] **Step 4: Commit**

```bash
git add crm/v2/v2-mkt-linkedin.js
git commit -m "feat(mkt-linkedin): vue liste filtrable (statut, pilier, recherche)"
```

---

### Task 9: SQL Supabase + déploiement (version + service worker)

**Files:**
- Create: `docs/supabase/linkedin_posts.sql`
- Modify: `crm/v2/index.html` (bump `?v=`), `crm/v2/v2-mkt.js` (bump `?v=` interne si présent), `crm/v2/v2-mkt-linkedin.js` (n/a), `crm/v2/sw.js` (`VER`)

**Interfaces:** aucune (déploiement).

- [ ] **Step 1: Écrire le SQL Supabase**

Create `docs/supabase/linkedin_posts.sql` :

```sql
-- Table des posts LinkedIn (rétroplanning éditorial)
create table if not exists public.linkedin_posts (
  id text primary key,
  date timestamptz,
  status text default 'idee',
  pillar text default 'produit',
  title text default '',
  body text default '',
  image_path text default '',
  linkedin_url text default '',
  event_id text default '',
  event_name text default '',
  source text default 'manuel',
  owner text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.linkedin_posts enable row level security;

-- Accès aux utilisateurs authentifiés du CRM (aligné sur marketing_items)
create policy "li_auth_all" on public.linkedin_posts
  for all to authenticated using (true) with check (true);

-- Bucket de stockage des visuels (à créer aussi via l'UI Storage) :
--   insert into storage.buckets (id, name, public) values ('marketing-media','marketing-media', true)
--   on conflict do nothing;
-- Policies storage : lecture publique + écriture authentifiée sur le bucket 'marketing-media'.
```

- [ ] **Step 2: Exécuter le SQL dans Supabase (manuel, hors code)**

Dans le dashboard Supabase (SQL editor), exécuter `docs/supabase/linkedin_posts.sql`. Créer le bucket **`marketing-media`** (public) via Storage. Le module bascule alors automatiquement en `backend = 'supabase'` (sinon il reste en `localStorage`, tout fonctionne sauf l'upload d'image).

- [ ] **Step 3: Bump du cache + synchro service worker**

Choisir une nouvelle version, ex. `20260707a`. Modify :
```bash
cd /Users/williammorel/JARVIS/APP/crm/v2
# nouvelle version pour tous les assets versionnés déjà présents + le nouveau script
sed -i '' 's/?v=20260703d23/?v=20260707a/g' index.html
sed -i '' "s/var VER = '20260703d23'/var VER = '20260707a'/" sw.js
```
Vérifier que `<script src="v2-mkt-linkedin.js?v=20260707a">` et `v2-mkt.js?v=20260707a` sont bien à la nouvelle version, et `sw.js` `VER = '20260707a'`.

- [ ] **Step 4: Vérifier hors-ligne + build final**

Recharger avec cache forcé (Cmd+Shift+R). Confirmer : Marketing → Rétroplanning LinkedIn fonctionne (calendrier, éditeur, temps fort, import, liste, publier). Sans Supabase configuré, l'upload d'image affiche le message d'indisponibilité (URL possible). Aucune erreur console.

- [ ] **Step 5: Commit + push (déploiement)**

```bash
cd /Users/williammorel/JARVIS/APP
git add docs/supabase/linkedin_posts.sql crm/v2/index.html crm/v2/sw.js crm/v2/v2-mkt.js crm/v2/v2-mkt-linkedin.js
git commit -m "feat(mkt-linkedin): SQL Supabase + deploiement (bump cache + sw VER)"
git push origin main
```
Vérifier en ligne : `https://willmorel49-coder.github.io/jarvis-app/crm/` → Marketing → Rétroplanning LinkedIn.

---

## Self-Review (couverture du spec)

- §5 vues (calendrier, à publier, générateur, éditeur, liste) → Tasks 3, 5, 6, 4, 8. ✅
- §4.1 modèle `linkedin_posts` → Task 2 + Task 9 (SQL). ✅
- §4.2 piliers, §4.3 gabarits → Task 1 (PILLARS/STATUSES) + Task 6 (RETRO). ✅
- §6 import → Task 7. ✅
- §7 publier 1 clic → Task 5. ✅
- §8 rappels + badge → Task 5. ✅
- §9 dégradation (upload image off-line, presse-papier, import mal formé) → Tasks 4, 5, 7. ✅
- §2 contraintes (client-side, Supabase+localStorage, pas de dépendance, cache/sw) → transversal + Task 9. ✅
- Type `Post` cohérent (mêmes champs) dans toutes les tâches (fromRow/toRow/openEditor/import/génération). ✅
