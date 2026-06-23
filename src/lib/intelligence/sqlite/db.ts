import type { Database, SqlJsStatic } from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { SQLITE_SCHEMA } from './schema';

let sqlModule: SqlJsStatic | null = null;

type InitSqlJs = (config?: { locateFile?: (file: string) => string }) => Promise<SqlJsStatic>;

async function loadInitSqlJs(): Promise<InitSqlJs> {
  const mod = await import('sql.js/dist/sql-wasm.js');
  const candidate =
    (mod as { default?: InitSqlJs }).default ??
    (mod as unknown as InitSqlJs);
  if (typeof candidate !== 'function') {
    throw new Error('sql.js: could not resolve init function from dist/sql-wasm.js');
  }
  return candidate;
}

export async function getSqlModule(): Promise<SqlJsStatic> {
  if (!sqlModule) {
    const initSqlJs = await loadInitSqlJs();
    sqlModule = await initSqlJs({ locateFile: () => wasmUrl });
  }
  return sqlModule;
}

export async function openDatabase(bytes?: Uint8Array): Promise<Database> {
  const SQL = await getSqlModule();
  const db = bytes ? new SQL.Database(bytes) : new SQL.Database();
  db.run(SQLITE_SCHEMA);
  return db;
}

export function exportDatabase(db: Database): Uint8Array {
  return db.export();
}