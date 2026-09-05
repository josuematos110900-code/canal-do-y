import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { paths, ensureDirs } from "./config.js";

ensureDirs();
const dbPath = path.join(paths.data, "database.sqlite");
export const db = new DatabaseSync(dbPath);

db.exec(`
CREATE TABLE IF NOT EXISTS movies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  source_path TEXT NOT NULL,
  duration_seconds REAL,
  width INTEGER,
  height INTEGER,
  fps REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  movie_id INTEGER NOT NULL REFERENCES movies(id),
  mode TEXT NOT NULL DEFAULT 'auto',
  status TEXT NOT NULL DEFAULT 'PENDING',
  step TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS scenes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  movie_id INTEGER NOT NULL REFERENCES movies(id),
  start_seconds REAL NOT NULL,
  end_seconds REAL NOT NULL,
  importance INTEGER,
  description TEXT
);

CREATE TABLE IF NOT EXISTS scripts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL REFERENCES jobs(id),
  path TEXT NOT NULL,
  word_count INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS videos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL REFERENCES jobs(id),
  variant TEXT NOT NULL DEFAULT 'main',
  path TEXT NOT NULL,
  duration_seconds REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS publications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL REFERENCES jobs(id),
  youtube_video_id TEXT,
  title TEXT,
  publish_at TEXT,
  privacy_status TEXT DEFAULT 'private',
  status TEXT NOT NULL DEFAULT 'SCHEDULED',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER,
  level TEXT NOT NULL,
  step TEXT,
  message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

export const JOB_STATUSES = [
  "PENDING", "ANALYZING", "SCRIPTING", "VOICE_GENERATING",
  "EDITING", "READY", "UPLOADING", "SCHEDULED", "PUBLISHED", "FAILED",
];

export function upsertMovie({ slug, sourcePath, duration, width, height, fps }) {
  const existing = db.prepare("SELECT * FROM movies WHERE slug = ?").get(slug);
  if (existing) return existing;
  db.prepare(
    `INSERT INTO movies (slug, source_path, duration_seconds, width, height, fps)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(slug, sourcePath, duration ?? null, width ?? null, height ?? null, fps ?? null);
  return db.prepare("SELECT * FROM movies WHERE slug = ?").get(slug);
}

export function createJob(movieId, mode = "auto") {
  db.prepare("INSERT INTO jobs (movie_id, mode, status, step) VALUES (?, ?, 'PENDING', 'queued')")
    .run(movieId, mode);
  return db.prepare("SELECT * FROM jobs WHERE id = last_insert_rowid()").get();
}

export function getJobBySlug(slug) {
  return db.prepare(
    `SELECT jobs.* FROM jobs JOIN movies ON movies.id = jobs.movie_id
     WHERE movies.slug = ? ORDER BY jobs.id DESC LIMIT 1`
  ).get(slug);
}

export function updateJob(jobId, fields) {
  const keys = Object.keys(fields);
  if (keys.length === 0) return;
  const sets = keys.map((k) => `${k} = ?`).join(", ");
  db.prepare(`UPDATE jobs SET ${sets}, updated_at = datetime('now') WHERE id = ?`)
    .run(...keys.map((k) => fields[k]), jobId);
}

export function listJobs(status) {
  if (status) {
    return db.prepare(
      `SELECT jobs.*, movies.slug FROM jobs JOIN movies ON movies.id = jobs.movie_id
       WHERE jobs.status = ? ORDER BY jobs.id ASC`
    ).all(status);
  }
  return db.prepare(
    `SELECT jobs.*, movies.slug FROM jobs JOIN movies ON movies.id = jobs.movie_id
     ORDER BY jobs.id ASC`
  ).all();
}

export function pendingQueue() {
  return db.prepare(
    `SELECT jobs.*, movies.slug, movies.source_path FROM jobs
     JOIN movies ON movies.id = jobs.movie_id
     WHERE jobs.status NOT IN ('PUBLISHED', 'FAILED')
     ORDER BY jobs.id ASC`
  ).all();
}

export function readyQueue() {
  return db.prepare(
    `SELECT jobs.*, movies.slug FROM jobs JOIN movies ON movies.id = jobs.movie_id
     WHERE jobs.status = 'READY' ORDER BY jobs.id ASC`
  ).all();
}

export function logEvent(jobId, level, step, message) {
  db.prepare("INSERT INTO logs (job_id, level, step, message) VALUES (?, ?, ?, ?)")
    .run(jobId ?? null, level, step ?? null, message ?? "");
}

export function lastScheduledPublishAt() {
  const row = db.prepare(
    `SELECT publish_at FROM publications WHERE status = 'SCHEDULED'
     ORDER BY publish_at DESC LIMIT 1`
  ).get();
  return row?.publish_at ?? null;
}

export function scheduledSlots() {
  return db.prepare(
    `SELECT publish_at FROM publications WHERE status IN ('SCHEDULED', 'PUBLISHED')
     ORDER BY publish_at ASC`
  ).all().map((r) => r.publish_at);
}

export function schedulePublication(jobId, { title, publishAt, privacyStatus }) {
  db.prepare(
    `INSERT INTO publications (job_id, title, publish_at, privacy_status, status)
     VALUES (?, ?, ?, ?, 'SCHEDULED')`
  ).run(jobId, title, publishAt, privacyStatus ?? "private");
  return db.prepare("SELECT * FROM publications WHERE id = last_insert_rowid()").get();
}

export function markPublished(jobId, youtubeVideoId) {
  db.prepare(
    `UPDATE publications SET status = 'PUBLISHED', youtube_video_id = ?, updated_at = datetime('now')
     WHERE job_id = ?`
  ).run(youtubeVideoId, jobId);
  updateJob(jobId, { status: "PUBLISHED", step: "done" });
}
