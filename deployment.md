# UBIX Deployment Guide

This guide explains how to deploy the UBIX Platform to various environments.

## Prerequisites
- Node.js (v18+)
- SQLite (built-in with `better-sqlite3`)

## Deployment Options

### 1. VPS (DigitalOcean, Linode, AWS EC2)
This is the recommended approach for SQLite-based applications as it provides persistent disk storage by default.

1. **SSH into your server**.
2. **Clone the repository**.
3. **Install dependencies**: `npm install`.
4. **Seed the database**: `npm run seed`.
5. **Start with PM2**: `pm2 start server/index.js --name ubix`.

### 2. Railway (Recommended for PaaS)
Railway supports persistent volumes, which is crucial for SQLite.
1. Connect GitHub repo to Railway.
2. Add a **Volume** and mount it to `/app/data`.
3. Set `DATABASE_PATH=/app/data/ubix.db`.

### 3. Vercel (Serverless)
Vercel is great for the frontend, but has limitations for SQLite.

#### **Persistence Warning**
Vercel's file system is **ephemeral**. Any data saved to `ubix.db` will be wiped when the serverless function restarts.

#### **Recommended: Turso**
To use SQLite on Vercel with persistence:
1. Create a Turso DB at [turso.tech](https://turso.tech).
2. Install `@libsql/client`.
3. Update `server/db/database.js` to use Turso in production.

#### **Quick Deploy**
1. Ensure `vercel.json` exists in root.
2. Run `vercel`.
3. The app will work, but data will reset frequently.

---

## Production Checklist
- [ ] Set `NODE_ENV=production`.
- [ ] Ensure `data/` directory is writable.
- [ ] Set up daily backups for the `.db` file.
