import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { SQLITE_SCHEMA } from './schema';

let sqlModule: SqlJsStatic | null = null;

export async function getSqlModule(): Promise<SqlJsStatic> {
  if (!sqlModule) {
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