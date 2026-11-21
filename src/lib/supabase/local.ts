// Локальный режим без ключей Supabase: дневники и файлы живут на этом компьютере в .local-data/.
// Повторяет ровно ту часть API Supabase, которой пользуется приложение (таблицы days/diaries и bucket days),
// чтобы локально можно было записывать дни без .env.local. На Vercel не включается никогда.
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

type Row = Record<string, unknown>;
type Tables = { diaries: Row[]; days: Row[] };

const ROOT = path.join(process.cwd(), '.local-data');
const DB = path.join(ROOT, 'db.json');
const FILES = path.join(ROOT, 'files');

export const isLocalMode = () =>
  !process.env.VERCEL && (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY);

function load(): Tables {
  try { return JSON.parse(fs.readFileSync(DB, 'utf8')) as Tables; }
  catch { return { diaries: [{ id: 'demo', title: 'Демо-дневник', kind: 'memories', created_at: new Date().toISOString() }], days: [] }; }
}
function save(t: Tables) {
  fs.mkdirSync(ROOT, { recursive: true });
  fs.writeFileSync(DB, JSON.stringify(t, null, 1));
}

const DEFAULTS: Record<keyof Tables, () => Row> = {
  diaries: () => ({ created_at: new Date().toISOString(), title: null, kind: 'memories', board: null }),
  days: () => ({
    id: randomUUID(), created_at: new Date().toISOString(), title: null, slug: null, photos: [], music: null, analysis: null,
    style: null, voice: null, poster_path: null, status: 'draft', error: null, mood_override: null, place: null,
    weather: null, sealed_until: null, share_id: null, decor: null, feeling: null, board: null,   // board — доска дня (0008)
  }),
};

type Filter = (r: Row) => boolean;
const str = (v: unknown) => (v == null ? '' : String(v));

/** Мини-конструктор запросов в духе supabase-js: фильтры, сортировка, лимит, then(). */
class Query implements PromiseLike<{ data: unknown; error: null | Error; count?: number | null }> {
  private filters: Filter[] = [];
  private sort: { col: string; asc: boolean }[] = [];
  private max = Infinity;
  private mode: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private payload: Row | Row[] | null = null;
  private cols: string | null = '*';
  private countOnly = false;
  private one: 'single' | 'maybe' | null = null;
  private returning = false;
  constructor(private table: keyof Tables) {}

  select(cols = '*', opts?: { count?: string; head?: boolean }) {
    if (this.mode !== 'select') this.returning = true;
    this.cols = cols;
    if (opts?.head) this.countOnly = true;
    return this;
  }
  insert(v: Row | Row[]) { this.mode = 'insert'; this.payload = v; return this; }
  update(v: Row) { this.mode = 'update'; this.payload = v; return this; }
  delete() { this.mode = 'delete'; return this; }
  eq(c: string, v: unknown) { this.filters.push((r) => r[c] === v); return this; }
  neq(c: string, v: unknown) { this.filters.push((r) => r[c] !== v); return this; }
  lte(c: string, v: unknown) { this.filters.push((r) => str(r[c]) <= str(v)); return this; }
  gte(c: string, v: unknown) { this.filters.push((r) => str(r[c]) >= str(v)); return this; }
  in(c: string, vs: unknown[]) { this.filters.push((r) => vs.includes(r[c])); return this; }
  /** Только вид «title.ilike.%q%,text.ilike.%q%» — так ищет архив. */
  or(expr: string) {
    const parts = expr.split(',').map((p) => { const [col, , ...rest] = p.split('.'); return { col, q: rest.join('.').replace(/%/g, '').toLowerCase() }; });
    this.filters.push((r) => parts.some((p) => str(r[p.col]).toLowerCase().includes(p.q)));
    return this;
  }
  order(col: string, o?: { ascending?: boolean }) { this.sort.push({ col, asc: o?.ascending !== false }); return this; }
  limit(n: number) { this.max = n; return this; }
  single() { this.one = 'single'; return this; }
  maybeSingle() { this.one = 'maybe'; return this; }

  private pick(r: Row): Row {
    if (!this.cols || this.cols === '*') return r;
    return Object.fromEntries(this.cols.split(',').map((c) => c.trim()).map((c) => [c, r[c] ?? null]));
  }

  private run(): { data: unknown; error: null | Error; count?: number | null } {
    const t = load();
    const rows = t[this.table];
    const match = (r: Row) => this.filters.every((f) => f(r));
    let out: Row[] = [];
    if (this.mode === 'insert') {
      const list = (Array.isArray(this.payload) ? this.payload : [this.payload!]).map((v) => ({ ...DEFAULTS[this.table](), ...v }));
      if (this.table === 'diaries' && list.some((n) => rows.some((r) => r.id === n.id))) return { data: null, error: new Error('duplicate key') };
      rows.push(...list);
      save(t);
      out = list;
    } else if (this.mode === 'update') {
      for (const r of rows) if (match(r)) { Object.assign(r, this.payload); out.push(r); }
      save(t);
    } else if (this.mode === 'delete') {
      t[this.table] = rows.filter((r) => !match(r)) as never;
      save(t);
      return { data: null, error: null };
    } else {
      out = rows.filter(match);
      for (const s of [...this.sort].reverse()) out.sort((a, b) => (str(a[s.col]) < str(b[s.col]) ? -1 : str(a[s.col]) > str(b[s.col]) ? 1 : 0) * (s.asc ? 1 : -1));
      out = out.slice(0, this.max);
      if (this.countOnly) return { data: null, error: null, count: out.length };
    }
    if (this.mode !== 'select' && !this.returning) return { data: null, error: null };
    const picked = out.map((r) => this.pick(r));
    if (this.one) {
      if (!picked.length) return this.one === 'maybe' ? { data: null, error: null } : { data: null, error: new Error('Строка не найдена') };
      return { data: picked[0], error: null };
    }
    return { data: picked, error: null, count: picked.length };
  }

  then<A = { data: unknown; error: null | Error; count?: number | null }, B = never>(
    ok?: ((v: { data: unknown; error: null | Error; count?: number | null }) => A | PromiseLike<A>) | null,
    fail?: ((e: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    try { return Promise.resolve(this.run()).then(ok, fail); } catch (e) { return Promise.reject(e).then(ok, fail); }
  }
}

// ── Хранилище файлов ──
const filePath = (p: string) => {
  const full = path.join(FILES, ...p.split('/'));
  if (!full.startsWith(FILES)) throw new Error('Неверный путь файла');
  return full;
};
export const localFileUrl = (p: string) => `/api/local/files/${p.split('/').map(encodeURIComponent).join('/')}`;

export function readLocalFile(p: string): Buffer | null {
  try { return fs.readFileSync(filePath(p)); } catch { return null; }
}
export function writeLocalFile(p: string, body: Buffer) {
  const f = filePath(p);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, body);
}

const toBuffer = async (body: Blob | Buffer | string) =>
  typeof body === 'string' ? Buffer.from(body) : Buffer.isBuffer(body) ? body : Buffer.from(await body.arrayBuffer());

const storageApi = {
  async upload(p: string, body: Blob | Buffer | string) { writeLocalFile(p, await toBuffer(body)); return { data: { path: p }, error: null }; },
  async download(p: string) {
    const b = readLocalFile(p);
    return b ? { data: new Blob([new Uint8Array(b)]), error: null } : { data: null, error: new Error(`Файл не найден: ${p}`) };
  },
  async move(from: string, to: string) {
    try { fs.mkdirSync(path.dirname(filePath(to)), { recursive: true }); fs.renameSync(filePath(from), filePath(to)); return { data: null, error: null }; }
    catch { return { data: null, error: new Error(`Object not found: ${from}`) }; }
  },
  async copy(from: string, to: string) {
    const b = readLocalFile(from);
    if (!b) return { data: null, error: new Error(`Object not found: ${from}`) };
    writeLocalFile(to, b);
    return { data: null, error: null };
  },
  async remove(paths: string[]) { for (const p of paths) { try { fs.unlinkSync(filePath(p)); } catch { /* уже нет */ } } return { data: null, error: null }; },
  async list(folder: string) {
    try {
      const dir = filePath(folder);
      const data = fs.readdirSync(dir, { withFileTypes: true }).map((e) => e.isDirectory()
        ? { name: e.name, id: null, metadata: null }
        : { name: e.name, id: e.name, metadata: { size: fs.statSync(path.join(dir, e.name)).size } });
      return { data, error: null };
    } catch { return { data: [], error: null }; }
  },
  async createSignedUrls(paths: string[]) { return { data: paths.map((p) => ({ path: p, signedUrl: localFileUrl(p), error: null })), error: null }; },
  async createSignedUploadUrl(p: string) { return { data: { path: p, token: 'local', signedUrl: localFileUrl(p) }, error: null }; },
};

/** Объект с той же формой, что SupabaseClient, — только используемые методы. */
export function localClient() {
  return {
    from: (table: string) => new Query(table as keyof Tables),
    storage: { from: () => storageApi },
  };
}
