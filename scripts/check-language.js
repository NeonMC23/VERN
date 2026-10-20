#!/usr/bin/env node
/*
 * VΞRN — language guard for public interface text.
 *
 * Reads the repository, renders every Library resource through the real builder in a minimal DOM,
 * then looks for French text in what a visitor would see. Read-only: it never writes inside the
 * repository and it proves that by hashing what it read.
 *
 *   node scripts/check-language.js              # full check, 110 resources
 *   node scripts/check-language.js --help       # options and documented limits
 *   node scripts/check-language.js --only debian,ubuntu
 *
 * Exit status: 0 CONFORME · 1 DETECTION · 2 NON_CONCLUANT (missing or broken input, partial run).
 * A partial run is never reported as CONFORME.
 *
 * Origin: the phase 111 study; the rules and the lexicon were calibrated there against the phase
 * 110 language register and re-validated on this file in phase 112. Nothing outside this
 * repository is read at run time: no test fixture, no register file, no previous DOM survey.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith('--')) { args[a.slice(2)] = process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[++i] : true; }
}
const ROOT = path.resolve(args.root ? args.root : path.join(__dirname, '..'));
const QUIET = !!args.quiet;
const ATTENDU_TITLES = args['expect-titles'] !== undefined ? Number(args['expect-titles']) : 40;
if (args.help) {
  console.log(`usage : node scripts/check-language.js [options]

  --only id1,id2        ne controler que ces ressources
  --root DIR            racine a controler (defaut : le depot de ce script)
  --titles              controler la table des etiquettes de section
  --expect-titles N     nombre d'entrees attendu dans SECTION_TITLES (defaut 40)
  --approved-csv FICHIER  comparer la table a un registre approuve (colonnes cle,titre)
  --dom REPERTOIRE      relire en plus un releve de texte rendu (fichier par page)
  --json FICHIER        ecrire le resultat machine (seule ecriture possible, jamais dans le depot
                        sous cette commande : a pointer hors de l'arbre servi)
  --quiet               une seule ligne de verdict
  --subset-ok           accepter un corpus partiel (mode test)

etats : CONFORME (0) · DETECTION (1) · NON_CONCLUANT (2)

limites declarees (phase 111) : un enonce francais sans mot non equivoque, sans accent et sans
elision n'est pas detecte ; les etats produits a l'execution par library-catalog.js et par le widget
ne sont vus que par leurs donnees et leurs chaines, sauf mode --dom ; le rendu visuel (coupe,
contraste, police) n'est pas controle ; le controle ne porte que sur le francais. Le controle
navigateur reste un complement periodique, pas un remplacement.`);
  process.exit(0);
}

/* ------------------------------------------------------------------ regles */
// Deux niveaux, calibres sur le corpus reel des 110 fiches (voir phase111-validation.md) :
// FR_FORT declenche seul ; FR_FAIBLE est partage avec l'anglais ou present dans des noms propres,
// il ne declenche qu'accompagne d'un second marqueur dans une fenetre de 8 mots.
const FR_FORT = ['avec', 'pour', 'dans', 'sont', 'mais', 'aussi', 'chaque', 'depuis', 'lorsque',
  'afin', 'ainsi', 'selon', 'très', 'tres', 'après', 'apres', 'système', 'systeme', 'préférence', 'paramètre', 'parametres', 'fonctionnalité', 'fonctionnalites', 'utilisateur',
  'état', 'etat', 'nécessite', 'necessite', 'également', 'egalement', 'historique', 'gratuit',
  'télécharger', 'telecharger', 'prérequis', 'prerequis', 'compatibilité', 'compatibilite',
  'permettent', 'choisir', 'cliquer', 'fournir', 'afficher', 'sélectionner', 'selectionner',
  'dépôt', 'nécessaire', 'nécessaires', 'necessaires', 'utilisé', 'utilisée', 'présente',
  'règles', 'réseau', 'reseau', 'sécurité', 'securite', 'démarrage', 'inconvénient',
  'avantages', 'remarques', 'recommandé', 'recommandée', 'schéma', 'côté', 'numéro', 'siège',
  'durée', 'coût', 'matériel', 'modèle', 'notice légale', 'liste de', 'prise en main',
  'fonctionnement', 'comparaison', 'configuration requise',
  'quelle', 'quelles', 'quels', 'combien', 'pourquoi', 'dès', 'des lors', 'lors', 'plutôt',
  'plutot', 'davantage', 'uniquement', 'toutes', 'lesquels', 'lesquelles', 'auxquels',
  ' auxquels', 'mesure que', 'de même', 'bien que', 'ainsi que', 'afin de', 'grâce', 'grace a',
  'd ailleurs', 'en outre', 'par contre', 'en fait', 'toutefois', 'néanmoins', 'neanmoins'];
const FORT = new Set(FR_FORT);
// FR_FAIBLE : mots francophones qui existent aussi en anglais (guide, page, source, version,
// licence, installation, configuration, generation) ou dans des noms propres (le, la, des, du).
// Ils ne declenchent jamais seuls : il faut un mot du niveau fort, une elision ou un accent.
const FR_FAIBLE = ['le', 'la', 'les', 'des', 'du', 'une', 'cette', 'ces', 'notre', 'votre',
  'leur', 'avant', 'libre', 'liste', 'modele', 'cout', 'duree', 'noyau', 'paquet', 'retour',
  'notice', 'licence', 'source', 'version', 'page', 'guide', 'installation', 'utilisation',
  'configuration', 'generation', 'siege', 'comparaison', 'fonctionnement', 'materiel'];
const FAIBLE = new Set(FR_FAIBLE);
// SHARED : mots outils des deux langues, utilises par la regle B uniquement.
const SHARED = ['de', 'du', 'des', 'la', 'le', 'les', 'un', 'une', 'et', 'au', 'aux', 'en',
  'dans', 'pour', 'par', 'sur', 'avec', 'est', 'sont', 'pas', 'plus', 'cette', 'que', 'qui'];
const CONTRACT = /(?:^|[\s(,;:.!?])(?:[dljnqstcm]'|’)[a-zàâçéèêëîïôùûüœ]+(?![A-Za-z])/;
const ACC = /[àâäçéèêëîïôöùûüÿœæÀÂÄÇÉÈÊËÎÏÔÖÛÙÜŸŒÆ]/;
const mots = s => String(s).normalize('NFC').split(/[^\p{L}\p{N}'’]+/u).filter(Boolean);
const bas = s => mots(s).map(w => w.toLowerCase());
const contientFort = arr => arr.some(w => FORT.has(w));

function regleA(s) {
  const arr = bas(s);
  for (const w of FORT) if (arr.includes(w)) return 'A1:' + w;
  const faibles = arr.filter(w => FAIBLE.has(w));
  if (!faibles.length) return null;
  if (contientFort(arr)) return 'A2:' + faibles[0] + '+mot fort';
  if (CONTRACT.test(s)) return 'A2:' + faibles[0] + '+elision';
  // pas de declenchement sur accent seul : la phase 110 a mesure 34 lignes declenchees par des
  // noms propres accentues (Gaël, iodé, Mueller, Forde). Un accent ne suffit pas.
  return null;
}
// Regle B : deux mots outils distincts dans une fenetre de 8 mots, double d'un signe francais.
function regleB(s) {
  const w = mots(s), low = w.map(x => x.toLowerCase());
  const pos = {};
  low.forEach((x, i) => { if (SHARED.includes(x)) (pos[x] = pos[x] || []).push(i); });
  const keys = Object.keys(pos);
  for (let a = 0; a < keys.length; a++) for (let b = a + 1; b < keys.length; b++) {
    for (const i of pos[keys[a]]) for (const j of pos[keys[b]]) {
      if (Math.abs(i - j) > 7) continue;
      const [x0, x1] = i < j ? [i, j] : [j, i];
      const fen = w.slice(x0, x1 + 1).join(' ');
      if (ACC.test(fen) || CONTRACT.test(fen)) return { motifs: 2, fenetre: fen };
    }
  }
  return null;
}
const CLE_FR = /(?:^|_)(etat|apercu|parametres|fonctionnalites|utilisateur|retour|historique|inconvenients|prerequis|compatibilite|systeme|securite|noyaux|reseau|licence|demarrage|fonctionnalite|preferences|utilisation)(?:_|$)/;
// forme technique : URL, chemin, jeton sans espace, hash, domaine
const TECH = /^[\s"']*(?:(?:https?:\/\/|ftp:\/\/|mailto:|file:\/\/|www\.)\S+|(?:[.\/~][\w.\/-]+)|(?:[\w.-]+\.(?:org|com|net|io|dev|fr|edu|gov|html?|json|md|txt|py|js|css|sh|png|jpg|svg|iso|tar|gz|xz|zip|deb|rpm|img|qcow2))(?:$|[\s).,;]))/i;
const NO_SPACE = /^[^\s]+$/;

function norm(s) { return String(s).replace(/\s+/g, ' ').trim(); }

// Regle B : combinaison de mots outils + signe franais (accent ou elision), ou trois outils distincts.
function regleB(s) {
  const t = norm(s);
  const words = t.split(/[\s'’]+/);
  const hits = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i].toLowerCase().replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '');
    if (SHARED.includes(w) && !hits.some(h => h.w === w && i - h.i < 8)) hits.push({ w, i });
  }
  const distinct = new Set(hits.map(h => h.w));
  for (let a = 0; a < hits.length; a++) {
    for (let b = a + 1; b < hits.length; b++) {
      if (hits[b].w === hits[a].w || hits[b].i - hits[a].i > 7) continue;
      const win = words.slice(hits[a].i, hits[b].i + 1).join(' ');
      if (ACC.test(win) || CONTRACT.test(win)) return { motifs: 2, fenetre: win };
      if (distinct.size >= 3) return { motifs: 3, fenetre: win };
    }
  }
  return null;
}
function est_technique(s) { const t = norm(s); return t.length < 3 || NO_SPACE.test(t) || TECH.test(t); }

function examiner(s, ctx) {
  const t = norm(s);
  if (!t) return null;
  const a = regleA(t), b = regleB(t);
  if (!a && !b) return null;
  if (est_technique(t) && !a) return null;      // URL et chemins : seulement si aucun mot franais
  if (est_technique(t) && a && t.split(' ').length <= 3) return null;
  return { chaine: t.slice(0, 220), regle: a ? 'A' : 'B', marqueur: a || (b && b.fenetre), contexte: ctx };
}

/* ------------------------------------------------------- lecture du depot */
function lire(p) {
  const full = path.join(ROOT, p);
  if (!fs.existsSync(full)) return null;
  return fs.readFileSync(full, 'utf8');
}
const problemes = [];

/* --- preuve de lecture seule : empreinte de tout ce qui sera lu, avant et apres --- */
function listeFichiersLus(root) {
  const out = [];
  const p = (...x) => path.join(root, ...x);
  for (const f of ['assets/js/library-builder.js', 'assets/js/library-catalog.js', 'assets/js/vern-ui.js',
                   '404.html', 'index.html', 'library/index.html', 'about/index.html', 'tools/index.html',
                   'tracks/index.html', '_library-preview.html', 'assets/css/vern.css',
                   'assets/js/tracks/tracks-app.js', 'assets/js/tracks/tracks-data.js',
                   'assets/js/tracks/tracks-renderer.js', 'assets/js/tracks/tracks-router.js'])
    if (fs.existsSync(p(f))) out.push(f);
  for (const sub of ['data/library', 'data/tracks']) {
    (function parcourir(d) {
      let ents = [];
      try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
      for (const ent of ents) {
        const full = path.join(d, ent.name);
        if (ent.isDirectory()) parcourir(full);
        else if (ent.name.endsWith('.json')) out.push(path.relative(root, full));
      }
    })(p(sub));
  }
  return out.sort();
}
const LUS = listeFichiersLus(ROOT);
function empreinteCorpus(liste) {
  const h = crypto.createHash('sha256');
  let n = 0;
  for (const f of liste) {
    try { h.update(f); h.update(fs.readFileSync(path.join(ROOT, f))); n++; }
    catch (e) { h.update(f + '||ILLISIBLE'); }
  }
  return { empreinte: h.digest('hex').slice(0, 16), fichiers: n };
}
const AVANT = empreinteCorpus(LUS);

const catSrc = lire('assets/js/library-catalog.js');
if (!catSrc) problemes.push('assets/js/library-catalog.js absent');
const ids = (() => {
  if (!catSrc) return [];
  const m = catSrc.match(/var LIBRARY_RESOURCES = \[\s*([\s\S]*?)\s*\];/);
  if (!m) { problemes.push('LIBRARY_RESOURCES introuvable'); return []; }
  return m[1].split('\n').map(l => l.trim().replace(/^"|"?,?$/g, '')).filter(l => l && !l.startsWith('//'));
})();
let fichiers = [];
try {
  fichiers = fs.readdirSync(path.join(ROOT, 'data/library')).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5));
} catch (e) { problemes.push('data/library illisible : ' + e.message); }

const only = args.only ? String(args.only).split(',').map(s => s.trim()) : null;
const cible = only ? ids.filter(i => only.includes(i)) : ids.slice();
if (!cible.length) problemes.push('aucune fiche a controller');

const fixtures = fichiers.filter(f => f.startsWith('test-'));
const orphelins = fichiers.filter(f => !ids.includes(f) && !only && !f.startsWith('test-'));
const manquants = cible.filter(i => !fichiers.includes(i));
if (!args['subset-ok'] && !only && orphelins.length) problemes.push('fiches sans identifiant dans la liste : ' + orphelins.join(','));
if (manquants.length) problemes.push('identifiants sans fichier JSON : ' + manquants.join(','));

/* --------------------------------------------- humanize et SECTION_TITLES */
const builderSrc = lire('assets/js/library-builder.js');
if (!builderSrc) problemes.push('assets/js/library-builder.js absent');
let table = {}, humanize = k => String(k).replace(/[_-]+/g, ' ').replace(/^\w/, c => c.toUpperCase());
if (builderSrc) {
  const m = builderSrc.match(/var SECTION_TITLES = \{(.*?)\n {2}\};/s);
  if (m) for (const g of m[1].matchAll(/"([^"]+)"\s*:\s*"((?:[^"\\]|\\.)*)"/g)) table[g[1]] = g[2];
  else problemes.push('SECTION_TITLES introuvable dans le constructeur');
  const h = builderSrc.match(/function humanize\(key\)\s*\{[\s\S]*?\n {2}\}/);
  if (h) {
    try {
      const box = vm.runInNewContext(h[0] + '\nhumanize', {});
      if (typeof box === 'function') humanize = box;
    } catch (e) { problemes.push('humanize non evalue : repli python-like utilise : ' + e.message); }
  } else problemes.push('humanize introuvable : repli declare utilise');
}

/* --------------------------------------------------------- rendu des pages */
function textNode(t) { return { __text: true, textContent: String(t), parentNode: null }; }
class Node {
  constructor(tag) { this.tagName = tag; this.childNodes = []; this.attrs = {}; this.className = ''; this.parentNode = null; }
  get firstChild() { return this.childNodes[0] || null; }
  appendChild(c) {
    if (c && c.__frag) { c.childNodes.slice().forEach(x => this.appendChild(x)); c.childNodes = []; return c; }
    if (!c) return c;
    if (c.parentNode && c.parentNode !== this) c.parentNode.removeChild(c);
    c.parentNode = this; this.childNodes.push(c); return c;
  }
  removeChild(c) { const i = this.childNodes.indexOf(c); if (i >= 0) this.childNodes.splice(i, 1); if (c) c.parentNode = null; return c; }
  replaceChild(nu, old) { const i = this.childNodes.indexOf(old); if (i >= 0) { this.childNodes[i] = nu; if (nu) nu.parentNode = this; } return old; }
  setAttribute(k, v) { this.attrs[k] = String(v); if (k === 'class') this.className = String(v); }
  getAttribute(k) { return k === 'class' ? (this.className || null) : (k in this.attrs ? this.attrs[k] : null); }
  removeAttribute(k) { delete this.attrs[k]; if (k === 'class') this.className = ''; }
  set textContent(v) { this.childNodes = []; if (v !== '' && v != null) this.childNodes.push(textNode(v)); }
  get textContent() { return this.childNodes.map(c => c.textContent).join(''); }
  querySelectorAll() { return []; }
}
function renderiser(id) {
  return new Promise(resolve => {
    const mount = new Node('div'); mount.id = 'library-resource';
    const frag = { __frag: true, childNodes: [], appendChild(c) { if (c) this.childNodes.push(c); return c; } };
    const doc = {
      readyState: 'complete', title: '',
      createElement: t => new Node(t),
      createTextNode: t => ({ __text: true, textContent: String(t), parentNode: null }),
      createDocumentFragment: () => Object.create(frag),
      getElementById: x => (x === 'library-resource' ? mount : null),
      querySelector: sel => (sel === 'base' ? { getAttribute: () => '/' } : null),
      addEventListener: () => {}
    };
    const loc = { pathname: `/library/${id}/`, search: '', href: `http://127.0.0.1/${id}/` };
    const file = path.join(ROOT, 'data/library', id + '.json');
    async function mockFetch(url) {
      const p = path.join(ROOT, decodeURIComponent(url).replace(/^\//, ''));
      try { const body = fs.readFileSync(p, 'utf8'); return { ok: true, status: 200, json: async () => JSON.parse(body), text: async () => body }; }
      catch (e) { return { ok: false, status: 404, json: async () => { throw new Error('absent'); }, text: async () => '' }; }
    }
    const ctx = vm.createContext({
      document: doc, window: { location: loc, document: doc }, location: loc, fetch: mockFetch,
      URL, URLSearchParams, console: { log() {}, warn() {}, error() {} }, Promise, JSON, Object,
      Array, String, Number, Boolean, Error, RegExp, decodeURIComponent, encodeURIComponent,
      setTimeout, Intl, Math, Date
    });
    try { vm.runInContext(builderSrc, ctx, { filename: 'library-builder.js' }); }
    catch (e) { return resolve({ id, erreur: 'sync : ' + e.message }); }
    setTimeout(() => {
      const textes = []; let erreur = null;
      (function walk(n, tag) {
        if (n.__text) { if (norm(n.textContent)) textes.push({ tag: tag || '', texte: n.textContent }); return; }
        const t = (n.tagName || tag || '').toLowerCase();
        if (n.className && /(^|\s)error(\s|$)/.test(n.className)) erreur = norm(n.textContent);
        if (n.attrs && n.attrs['aria-label']) textes.push({ tag: 'aria-label', texte: n.attrs['aria-label'] });
        (n.childNodes || []).forEach(c => walk(c, t));
      })(mount, '');
      resolve({ id, textes, erreur });
    }, 25);
  });
}

// Lecteur tolerent pour les releves de l'outil de test : le payload est une chaine JSON
// doublement encodee, suivie de lignes de log. On lit la premiere valeur complete et on ignore
// le reste (mesure phase 110 : json.loads echouait sur « Extra data »).
function lirePayload(txt) {
  const s = String(txt).trim();
  try { const o = JSON.parse(s); return (typeof o === 'string') ? JSON.parse(o) : o; } catch (e) { }
  let i = s.search(/["{[]/);
  if (i < 0) throw new Error('aucune valeur JSON');
  if (s[i] === '"') {
    let esc = false, k = i + 1;
    for (; k < s.length; k++) { const c = s[k]; if (esc) { esc = false; continue; }
      if (c === '\\') { esc = true; continue; } if (c === '"') break; }
    if (k >= s.length) throw new Error('chaine JSON non terminee');
    return JSON.parse(s.slice(i + 1, k).replace(/\\"/g, '"').replace(/\\\\/g, '\\'));
  }
  let depth = 0, inStr = false, esc = false;
  for (let k = i; k < s.length; k++) {
    const c = s[k];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === '{' || c === '[') depth++;
    else if (c === '}' || c === ']') { depth--; if (depth === 0) return JSON.parse(s.slice(i, k + 1)); }
  }
  throw new Error('objet JSON incomplet');
}

process.on('uncaughtException', e => {
  console.log('garde-fou linguistique : NON_CONCLUANT');
  console.log('  exception inattendue : ' + e.message);
  process.exit(2);
});
process.on('unhandledRejection', e => {
  console.log('garde-fou linguistique : NON_CONCLUANT');
  console.log('  promesse rejetee : ' + (e && e.message ? e.message : String(e)));
  process.exit(2);
});

(async () => {
  const detections = [];
  const cles_vues = {};            // cles de section rencontrees dans les fiches publiques
  let pages_rendues = 0, pages_en_erreur = 0, pages_vides = 0;

  const CODE = new Set(['code', 'pre', 'kbd', 'samp', 'var']);
  for (const id of cible) {
    const r = await renderiser(id);
    if (r.erreur) { pages_en_erreur++; problemes.push(`page ${id} en etat d'erreur : ${r.erreur}`); continue; }
    if (!r.textes || !r.textes.length) { pages_vides++; problemes.push(`page ${id} sans texte rendu`); continue; }
    pages_rendues++;
    for (const t of r.textes) {
      if (CODE.has(t.tag)) continue;   // commandes et chemins rendus en <code> : exclusion declaree
      const d = examiner(t.texte, `page /library/${id}/ <${t.tag}>`);
      if (d) detections.push(d);
    }
    // etiquettes de section : vocabulaire et racines francaises
    let data = null;
    try { data = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/library', id + '.json'), 'utf8')); }
    catch (e) { problemes.push(`fiche ${id} JSON illisible : ${e.message}`); continue; }
    const contenus = data.content && typeof data.content === 'object' ? data.content : {};
    for (const k of Object.keys(contenus)) cles_vues[k] = (cles_vues[k] || 0) + 1;
    for (const k of Object.keys(contenus)) {
      if (!(k in table) && CLE_FR.test(k)) {
        detections.push({ chaine: k, regle: 'C', marqueur: 'racine francaise dans la cle de section', contexte: `etiquette rendue « ${humanize(k)} » sur /library/${id}/` });
      }
      const lib = (k in table) ? table[k] : humanize(k);
      // les etiquettes sont un registre cure, pas de la prose : elles sont verifiees plus
      // strictement que le texte libre (un accent ou un mot francais suffit), parce qu'aucun nom
      // propre n'y a sa place. Mesure : 0 etiquette accentuee sur les 1 252 libelles rendus.
      const d = examiner(lib, `etiquette de section rendue /library/${id}/ (${k})`)
        || (ACC.test(lib) ? { chaine: lib, regle: 'L', marqueur: 'accent dans une etiquette de section',
                              contexte: `etiquette rendue /library/${id}/ (${k})` } : null);
      if (d) detections.push(d);
    }
  }

  // donnees du widget Tracks (arborescence complete, pas seulement la racine)
  (function parcourirTracks(dir, prefix) {
    let ents = [];
    try { ents = fs.readdirSync(dir, { withFileTypes: true }); }
    catch (e) { if (!/ENOENT/.test(e.message)) problemes.push('data/tracks : ' + e.message); return; }
    for (const ent of ents) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) { parcourirTracks(full, prefix + ent.name + '/'); continue; }
      if (!ent.name.endsWith('.json')) continue;
      try {
        const o = JSON.parse(fs.readFileSync(full, 'utf8'));
        (function scan(x, p) {
          if (typeof x === 'string') { const d = examiner(x, `data/tracks/${prefix}${ent.name} ${p}`); if (d) detections.push(d); }
          else if (Array.isArray(x)) x.forEach((y, i) => scan(y, p + '[' + i + ']'));
          else if (x && typeof x === 'object') for (const k of Object.keys(x)) scan(x[k], p + '.' + k);
        })(o, '');
      } catch (e) { problemes.push(`data/tracks/${prefix}${ent.name} illisible : ${e.message}`); }
    }
  })(path.join(ROOT, 'data/tracks'), '');

  // texte fixe des pages HTML et chaines affichees des scripts
  const pagesHTML = ['index.html', 'library/index.html', 'about/index.html', 'tools/index.html', 'tracks/index.html', '404.html', '_library-preview.html'];
  for (const p of pagesHTML) {
    const s = lire(p); if (!s) continue;
    const sans = s.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ');
    for (const g of sans.matchAll(/>([^<>{}]+)</g)) {
      const d = examiner(g[1], `${p} (texte fixe)`); if (d) detections.push(d);
    }
  }
  for (const p of ['assets/js/library-catalog.js', 'assets/js/vern-ui.js', 'assets/js/tracks/tracks-app.js',
                   'assets/js/tracks/tracks-renderer.js', 'assets/js/tracks/tracks-data.js', 'assets/js/tracks/tracks-router.js']) {
    const s = lire(p); if (!s) continue;
    const nu = s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
    for (const g of nu.matchAll(/(?:text|label|title|placeholder|aria-label|emptyMessage|error|heading)\s*[:=]\s*"((?:[^"\\]|\\.)*)"/g)) {
      const d = examiner(g[1], `${p} (chaine affichee)`); if (d) detections.push(d);
    }
  }

  let sortie_dom = null;
  // releve DOM optionnel (--dom DIR) : texte reellement rendu, page par page
  let dom_pages = null;
  if (args.dom) {
    dom_pages = { valide: 0, invalide: 0, detections: 0 };
    let files = [];
    try { files = fs.readdirSync(args.dom).filter(f => f.endsWith('.json')); }
    catch (e) { problemes.push('releve DOM illisible : ' + e.message); }
    if (!files.length) problemes.push('releve DOM vide : ' + args.dom);
    for (const f of files) {
      let o = null;
      try {
        // l'outil de test ajoute des lignes de log apres le payload : on lit le premier objet JSON,
        // qui est lui-meme une chaine JSON doublement encodee (mesure phase 110).
        o = lirePayload(fs.readFileSync(path.join(args.dom, f), 'utf8'));
      } catch (e) { dom_pages.invalide++; continue; }
      const v = norm(o && o.visible || '');
      if (v.length < 200) { dom_pages.invalide++; continue; }
      dom_pages.valide++;
      for (const phrase of v.split(/(?<=[.!?]) +/)) {
        const d = examiner(phrase, `releve DOM ${f}`);
        if (d) { detections.push(d); dom_pages.detections++; }
      }
    }
    if (dom_pages.invalide) problemes.push(`releve DOM : ${dom_pages.invalide} page(s) sans texte exploitable`);
    sortie_dom = dom_pages;
  }

  // rejeu du controle des 40 etiquettes, independant de l'ordre des cles
  let titres = null;
  if (args.titles) {
    // controle structurel, sans dependance hors du depot : la table est le registre.
    const cles_table = Object.keys(table).sort();
    titres = {
      entrees_table: cles_table.length,
      entrees_attendues: ATTENDU_TITLES,
      count_conforme: cles_table.length === ATTENDU_TITLES,
      cles_jamais_utilisees: cles_table.filter(k => !(k in cles_vues)),
      libelles_avec_marque: cles_table.map(k => table[k]).filter(v => regleA(v) || regleB(v) || ACC.test(v)),
      cles_avec_racine_frangaise_hors_table: Object.keys(cles_vues).filter(k => !(k in table) && CLE_FR.test(k)),
      cles_de_section_rencontrees: Object.keys(cles_vues).length,
      occurrences_de_cles: Object.values(cles_vues).reduce((a, b) => a + b, 0)
    };
    if (!cles_table.length) problemes.push('table SECTION_TITLES vide : controle des etiquettes impossible');
    if (cles_table.length !== ATTENDU_TITLES) {
      problemes.push(`table SECTION_TITLES : ${cles_table.length} entrees, ${ATTENDU_TITLES} attendues`
        + ' — la table a change de taille : revoir le registre approuve et relancer avec'
        + ' --expect-titles <n> si le changement est delibere');
    }
    // comparaison a un registre approuve : explicite, donc bloquant si absent
    const csvp = args['approved-csv'];
    if (csvp) {
      if (!fs.existsSync(csvp)) problemes.push('registre approuve introuvable : ' + csvp);
      else {
        const attendu = {};
        for (const l of fs.readFileSync(csvp, 'utf8').split(/\r?\n/).slice(1)) {
          const c = l.split(',');
          if (c.length > 4 && c[1]) attendu[c[1]] = c[4];
        }
        titres.registre = {
          chemin: csvp, entrees: Object.keys(attendu).length,
          cles_identiques: JSON.stringify(Object.keys(attendu).sort()) === JSON.stringify(cles_table),
          libelles_differents: cles_table.filter(k => attendu[k] !== table[k]),
          cles_hors_registre: cles_table.filter(k => !(k in attendu))
        };
        if (!titres.registre.cles_identiques || titres.registre.libelles_differents.length ||
            titres.registre.cles_hors_registre.length) {
          problemes.push('la table des etiquettes ne correspond plus au registre approuve');
        }
      }
    } else {
      titres.registre = { chemin: null, note: 'comparaison au registre approuve non demandee (--approved-csv)' };
    }
  }

  // un controle incomplet n'est jamais CONFORME : couverture, puis preuve de lecture seule
  if (pages_rendues !== cible.length) {
    problemes.push(`couverture incomplete : ${pages_rendues} pages rendues sur ${cible.length} cibles`);
  }
  const APRES = empreinteCorpus(LUS);
  const lecture_seule = APRES.empreinte === AVANT.empreinte && APRES.fichiers === AVANT.fichiers;
  if (!lecture_seule) {
    problemes.push(`corpus modifie pendant l'execution (${AVANT.empreinte} -> ${APRES.empreinte})`);
  }
  let statut = 'CONFORME', code = 0;
  if (detections.length) { statut = 'DETECTION'; code = 1; }
  if (problemes.length || !lecture_seule) { statut = 'NON_CONCLUANT'; code = 2; }
  // la seule ecriture possible du script : un fichier demande explicitement, hors de l'arbre servi
  let cibleJson = null;
  if (args.json) {
    cibleJson = path.resolve(args.json);
    if (cibleJson === ROOT || cibleJson.startsWith(ROOT + path.sep)) {
      problemes.push('--json refuse : le chemin demande est dans l\'arbre du depot (' + cibleJson
        + '). Relancer avec un chemin hors du depot, par exemple /tmp/garde-fou.json.');
      statut = 'NON_CONCLUANT'; code = 2;
      cibleJson = null;
    }
  }
  const sortie = {
    statut, code_sortie: code, racine: ROOT, regle_technique_appliquee: true,
    ids_en_liste: ids.length, fiches_sur_disque: fichiers.length, cibles: cible.length,
    pages_rendues, pages_en_erreur, pages_vides, orphelins, fixtures_exclues: fixtures.length,
    detections: detections.length, cas: detections.slice(0, 40), problemes: problemes.slice(0, 20),
    controle_titres: titres, releve_dom: sortie_dom,
    lecture_seule: { confirmee: lecture_seule, fichiers_haches: AVANT.fichiers,
                    avant: AVANT.empreinte, apres: APRES.empreinte },
    frequences_marqueurs: (() => { const c = {}; for (const d of detections) c[d.marqueur] = (c[d.marqueur] || 0) + 1; return Object.fromEntries(Object.entries(c).sort((x, y) => y[1] - x[1]).slice(0, 25)); })()
  };
  if (cibleJson) {
    sortie.ecrit = cibleJson;
    fs.writeFileSync(cibleJson, JSON.stringify(sortie, null, 1));
  }
  if (!QUIET) {
    console.log(`garde-fou linguistique : ${statut}`);
    console.log(`  cibles ${cible.length} sur ${ids.length} ids | pages rendues ${pages_rendues} | erreurs de rendu ${pages_en_erreur} | pages vides ${pages_vides}`);
    console.log(`  detections ${detections.length} | problemes ${problemes.length}`);
    for (const d of detections.slice(0, 12)) console.log(`   [${d.regle}] ${d.contexte} :: ${d.chaine.slice(0, 90)}`);
    for (const p of problemes.slice(0, 8)) console.log('   ! ' + p);
    if (titres) console.log('  controle des etiquettes : ' + JSON.stringify(titres));
    console.log(`  lecture seule : ${lecture_seule ? 'confirmee' : 'NON'} (${AVANT.fichiers} fichiers haches avant et apres)`);
  }
  process.exit(code);
})();
