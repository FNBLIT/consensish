import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'

const path = resolve(process.env.CONSENSISH_DB || '.data/consensish.sqlite')
mkdirSync(dirname(path), { recursive: true })
export const db = new DatabaseSync(path)
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
CREATE TABLE IF NOT EXISTS records (kind TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY(kind,id));
CREATE TABLE IF NOT EXISTS activity (id INTEGER PRIMARY KEY AUTOINCREMENT, groupId TEXT NOT NULL, proposalId TEXT, kind TEXT NOT NULL, text TEXT NOT NULL, createdAt TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS attempts (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);`)
export function get(kind: string, id: string): any { const row = db.prepare('SELECT data FROM records WHERE kind=? AND id=?').get(kind, id) as any; return row ? JSON.parse(row.data) : null }
export function all(kind: string): any[] { return (db.prepare('SELECT data FROM records WHERE kind=?').all(kind) as any[]).map(r => JSON.parse(r.data)) }
export function put(kind: string, record: any) { db.prepare('INSERT INTO records VALUES (?,?,?) ON CONFLICT(kind,id) DO UPDATE SET data=excluded.data').run(kind, record.id, JSON.stringify(record)); return record }
export function transaction<T>(fn: () => T): T { db.exec('BEGIN IMMEDIATE'); try { const result = fn(); db.exec('COMMIT'); return result } catch (e) { db.exec('ROLLBACK'); throw e } }
export function log(groupId: string, proposalId: string | null, kind: string, text: string) { db.prepare('INSERT INTO activity(groupId,proposalId,kind,text,createdAt) VALUES (?,?,?,?,?)').run(groupId, proposalId, kind, text, new Date().toISOString()) }
export function events(groupId: string, proposalId?: string) { return db.prepare(`SELECT * FROM activity WHERE groupId=? ${proposalId ? 'AND proposalId=?' : ''} ORDER BY id DESC LIMIT 200`).all(...(proposalId ? [groupId, proposalId] : [groupId])) }
