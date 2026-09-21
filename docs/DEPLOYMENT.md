# Jowis Studio Enterprise Internship ERP — Production Deployment Guide

This guide details the institutional deployment architecture, production environment hardening, process management, reverse proxy configuration, automated database backups, and disaster recovery procedures for **Jowis Studio Enterprise Internship ERP**.

---

## 1. Production Architecture Overview

The Jowis Studio ERP production architecture employs a defense-in-depth, decoupled tier design:

```text
                             [ HTTPS / Internet ]
                                      │
                                      ▼
                        [ Nginx / Apache Reverse Proxy ]
                          TLS 1.2/1.3 Termination
                          Rate Limiting & Security Headers
                          Gzip / Brotli Compression
                          Static File Caching & SPA Fallback
                                      │
                 ┌────────────────────┴────────────────────┐
                 │                                         │
                 ▼                                         ▼
   [ Static SPA Assets ]                         [ REST API Reverse Proxy ]
   /var/www/jowis/frontend/dist                  http://127.0.0.1:5000/api
   (index.html, js, css, icons)                            │
                                                           ▼
                                                [ Node.js API (PM2 Cluster) ]
                                                Node v18+ / v20+ LTS
                                                Lagos Timezone (Africa/Lagos)
                                                JWT Authentication Engine
                                                           │
                                                           ▼
                                                [ MySQL 8.0 Relational DB ]
                                                utf8mb4_unicode_ci
                                                Strict SQL Mode
                                                Local Unix Socket / Port 3306
```

---

## 2. Prerequisites & System Requirements

### Hardware Sizing
* **Minimum (Up to 250 concurrent users):** 2 vCPU, 4 GB RAM, 40 GB SSD (NVMe recommended).
* **Recommended (Up to 1,500 concurrent users):** 4 vCPU, 8 GB RAM, 80 GB SSD (NVMe).

### Operating System & Packages
* **OS:** Ubuntu 22.04 LTS / Debian 12 (or Red Hat Enterprise Linux 9 / Rocky Linux 9).
* **Node.js:** Node.js v18 LTS or v20+ LTS (with npm v9+).
* **Process Manager:** PM2 (`npm install -g pm2`).
* **Database:** MySQL Server 8.0+ or MariaDB 10.6+.
* **Web Server:** Nginx 1.20+ (recommended) or Apache 2.4+ with `mod_rewrite`, `mod_proxy`, and `mod_headers`.
* **SSL / TLS:** Let's Encrypt Certbot (`snap install --classic certbot`).

---

## 3. Directory Structure & File Permissions

Deploy the application under `/var/www/jowis` with a dedicated system user:

```bash
# 1. Create unprivileged application system user
sudo useradd -m -s /bin/bash -d /var/www/jowis jowis-app
sudo usermod -aG www-data jowis-app

# 2. Recommended directory layout
/var/www/jowis/
├── backend/
│   ├── .env
│   ├── package.json
│   ├── server.js
│   ├── src/
│   ├── storage/
│   │   ├── documents/
│   │   └── certificates/
│   └── uploads/
├── frontend/
│   ├── dist/
│   │   ├── .htaccess
│   │   ├── index.html
│   │   └── assets/
│   └── package.json
├── database/
│   ├── backups/
│   ├── schema.sql
│   └── seed.sql
└── docs/
```

### Permission Hardening
```bash
# Set ownership
sudo chown -R jowis-app:www-data /var/www/jowis

# Standard directory and file permissions
sudo find /var/www/jowis -type d -exec chmod 755 {} \;
sudo find /var/www/jowis -type f -exec chmod 644 {} \;

# Restrict sensitive environment configuration file to app user only
sudo chmod 600 /var/www/jowis/backend/.env

# Grant write access to uploads and storage directories
sudo chmod -R 775 /var/www/jowis/backend/uploads
sudo chmod -R 775 /var/www/jowis/backend/storage
sudo chmod -R 770 /var/www/jowis/database/backups
```

---

## 4. Environment Variables & Secrets Management

Never commit production `.env` files to source control. Production configuration is isolated to `/var/www/jowis/backend/.env`.

### Production Configuration Reference (`backend/.env`)

```ini
# ==============================================================================
# JOWIS STUDIO ERP — PRODUCTION ENVIRONMENT CONFIGURATION
# ==============================================================================

# Execution Environment
NODE_ENV=production
PORT=5000

# Authoritative Institutional Timezone (DO NOT CHANGE: Enforces 9:00 AM Lagos Cutoff)
APP_TIMEZONE=Africa/Lagos
ATTENDANCE_CUTOFF_TIME=09:00:00

# Database Connectivity (Use dedicated MySQL production user)
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=jowis_prod_user
DB_PASSWORD=YOUR_STRONG_RANDOM_DB_PASSWORD_HERE
DB_NAME=jowis_studio_erp

# Cryptographic Authentication Secrets
# Generate using: node -e "console.log(crypto.randomBytes(64).toString('hex'))"
JWT_SECRET=PROD_64_CHAR_HEX_ENTROPY_STRING_NEVER_REUSE_DEV_KEYS
JWT_EXPIRES_IN=8h

# CORS Whitelist (Comma-separated strict origins; do NOT use wildcard *)
CORS_ORIGIN=https://erp.jowis.com,https://admin.jowis.com

# File Storage & Upload Caps
MAX_FILE_SIZE_MB=10
DOCUMENT_UPLOAD_DIR=storage/documents
CERTIFICATE_UPLOAD_DIR=storage/certificates
```

### Generating High-Entropy Secrets
```bash
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"
```

---

## 5. Database Setup & Migration Protocol

### Create Dedicated Production User & Database
```sql
CREATE DATABASE `jowis_studio_erp` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER 'jowis_prod_user'@'localhost' IDENTIFIED BY 'YOUR_STRONG_RANDOM_DB_PASSWORD_HERE';
GRANT ALL PRIVILEGES ON `jowis_studio_erp`.* TO 'jowis_prod_user'@'localhost';
FLUSH PRIVILEGES;
```

### Initial Provisioning
From `/var/www/jowis/backend`:
```bash
# Run initial schema and seed
npm run init-db

# Run incremental migration checkpoints if upgrading an existing deployment
npm run migrate:phase3
npm run migrate:phase4
npm run migrate:phase5
npm run migrate:phase6
npm run migrate:phase7
npm run migrate:phase8
npm run migrate:phase9
```

---

## 6. Automated Database Backup & Retention

Jowis Studio ERP provides an integrated, pure-JavaScript backup engine in `backend/src/scripts/backup_db.js`. It generates complete SQL dumps containing table schemas, constraints, foreign keys, and records without external CLI dependencies.

### Manual Backup Execution
```bash
cd /var/www/jowis/backend
npm run db:backup
```
*Dumps are written to `/var/www/jowis/database/backups/backup_jowis_studio_erp_<TIMESTAMP>.sql`.*

### Automated Daily Cron Job (with 14-Day Retention)
Configure root or application crontab:
```bash
sudo crontab -e
```

Add the following scheduled task (runs daily at 02:00 AM Lagos Time):
```cron
# Daily database backup for Jowis Studio ERP at 02:00 AM
0 2 * * * cd /var/www/jowis/backend && /usr/bin/node src/scripts/backup_db.js >> /var/log/jowis_backup.log 2>&1

# Prune SQL dumps older than 14 days
30 2 * * * find /var/www/jowis/database/backups -name "*.sql" -type f -mtime +14 -delete >> /var/log/jowis_backup.log 2>&1
```

---

## 7. Database Disaster Recovery Runbook

To restore the database from a backup dump:

### Standard Restoration
```bash
cd /var/www/jowis/backend

# Automatically restores the latest backup file in database/backups/
npm run db:restore

# Or restore a specific backup snapshot
node src/scripts/restore_db.js /var/www/jowis/database/backups/backup_jowis_studio_erp_2026-09-21T11-23-56-272Z.sql
```

### Disaster Recovery to an Alternate Staging Server
```bash
# Restore a dump to a custom database instance
node src/scripts/restore_db.js /path/to/backup.sql jowis_studio_erp_dr
```

---

## 8. Process Management with PM2

Use PM2 for zero-downtime cluster mode, automatic process restarts on crashes, and systemd boot persistence.

### PM2 Ecosystem File (`ecosystem.config.cjs`)
Create `/var/www/jowis/ecosystem.config.cjs`:

```javascript
module.exports = {
  apps: [
    {
      name: 'jowis-erp-api',
      cwd: '/var/www/jowis/backend',
      script: 'server.js',
      instances: 'max',       // Cluster across all CPU cores
      exec_mode: 'cluster',
      watch: false,
      max_memory_restart: '1G',
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000
      },
      error_file: '/var/log/jowis/pm2-error.log',
      out_file: '/var/log/jowis/pm2-out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    }
  ]
};
```

### PM2 Operational Commands
```bash
# Start cluster in production mode
pm2 start ecosystem.config.cjs --env production

# Zero-downtime rolling reload
pm2 reload jowis-erp-api

# View process status & memory consumption
pm2 status

# Tail live application logs
pm2 logs jowis-erp-api

# Save process list and generate systemd service for boot persistence
pm2 save
pm2 startup systemd -u jowis-app --hp /var/www/jowis
```

---

## 9. Nginx Reverse Proxy Configuration

Create `/etc/nginx/sites-available/jowis.conf`:

```nginx
# Rate limiting zone (10 requests per second per IP)
limit_req_zone $binary_remote_addr zone=jowis_api_limit:10m rate=10r/s;

# Upstream Node.js API cluster
upstream jowis_backend {
    server 127.0.0.1:5000;
    keepalive 32;
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name erp.jowis.com;
    return 301 https://$host$request_uri;
}

# HTTPS Server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name erp.jowis.com;

    # SSL TLS Certificates (Managed by Certbot)
    ssl_certificate /etc/letsencrypt/live/erp.jowis.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/erp.jowis.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; img-src 'self' data: blob: https:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://erp.jowis.com;" always;

    # Root Directory for Vite SPA Production Build
    root /var/www/jowis/frontend/dist;
    index index.html;

    # Client Upload Max Body Size
    client_max_body_size 12M;

    # 1. API Reverse Proxy
    location /api/ {
        limit_req zone=jowis_api_limit burst=20 nodelay;
        proxy_pass http://jowis_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
        proxy_connect_timeout 10s;
    }

    # 2. Uploads Storage Serving (Directory listing disabled)
    location /uploads/ {
        alias /var/www/jowis/backend/uploads/;
        autoindex off;
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }

    # 3. Static SPA Assets Caching
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    # 4. Frontend SPA Routing Fallback
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Enable configuration and reload Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/jowis.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 10. Apache / XAMPP Alternative Configuration

If hosting in an Apache or XAMPP environment:

### SPA Fallback Routing (`frontend/dist/.htaccess`)
```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

### Apache VirtualHost with Reverse Proxy
Ensure `mod_proxy`, `mod_proxy_http`, `mod_rewrite`, and `mod_headers` are enabled:
```apache
<VirtualHost *:80>
    ServerName erp.jowis.com
    Redirect permanent / https://erp.jowis.com/
</VirtualHost>

<VirtualHost *:443>
    ServerName erp.jowis.com
    DocumentRoot "C:/xamp/htdocs/jowis/frontend/dist"

    SSLEngine on
    SSLCertificateFile "conf/ssl.crt/server.crt"
    SSLCertificateKeyFile "conf/ssl.key/server.key"

    # API Reverse Proxy
    ProxyPreserveHost On
    ProxyPass /api/ http://127.0.0.1:5000/api/
    ProxyPassReverse /api/ http://127.0.0.1:5000/api/

    <Directory "C:/xamp/htdocs/jowis/frontend/dist">
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>
</VirtualHost>
```

---

## 11. SSL / TLS Certificate Automation with Certbot

```bash
# Install Certbot via Snap
sudo snap install core && sudo snap refresh core
sudo snap install --classic certbot
sudo ln -s /snap/bin/certbot /usr/bin/certbot

# Obtain and install certificate for Nginx automatically
sudo certbot --nginx -d erp.jowis.com

# Verify automated renewal timer
sudo systemctl status snap.certbot.renew.service
sudo certbot renew --dry-run
```

---

## 12. File Storage Hardening & Security

All document submissions, identification scans, and generated certificate PDFs reside in `backend/storage/` and `backend/uploads/`.

* **Execution Prevention:** The web server strictly serves these files as static binary payloads and never invokes PHP, shell, or scripting engines.
* **Extension Filtering:** The backend file upload filter blocks `.exe`, `.bat`, `.cmd`, `.sh`, `.php`, `.phtml`, `.js`, `.jsp`, `.asp`, `.aspx`, and dotfiles.
* **Directory Indexing Denied:** `autoindex` is disabled on Nginx and Express static middleware (`{ dotfiles: 'ignore', index: false }`).

---

## 13. Security Hardening Checklist

| Security Control | Implementation | Verification |
| :--- | :--- | :--- |
| **Strict Database Charset** | `utf8mb4` configured on database pool | `SHOW VARIABLES LIKE 'character_set_connection'` |
| **CORS Origin Whitelisting** | Rejected unless explicitly permitted in `CORS_ORIGIN` | Untrusted origin returns CORS alert error |
| **Production Error Sanitization** | Stack traces omitted from 4xx/5xx responses in production | `NODE_ENV=production` hides `err.stack` |
| **Password Cryptography** | Bcrypt hashing (cost factor 10) | No plaintext passwords in DB or API |
| **Privilege Escalation Protection** | Server-authoritative RBAC middleware | Mentors/Interns blocked from `/api/admin/*` |
| **Audit Immutability** | `PUT` and `DELETE` on `/api/admin/audit-logs` return 405 | Audit logs are strictly append-only |
| **Live Database Health Probe** | `/api/health` queries live `SELECT 1` | Returns 200 connected / 503 unavailable |

---

## 14. Health Checks & Monitoring

The backend exposes a live health and uptime probe at `GET /api/health`:

### HTTP Response (Connected) — `200 OK`
```json
{
  "status": "ok",
  "system": "Jowis Studio Internship ERP API",
  "database": "connected",
  "uptime": 86400.12,
  "timezone": "Africa/Lagos",
  "timestamp": "2026-09-21T12:00:00.000Z"
}
```

### HTTP Response (Degraded / DB Down) — `503 Service Unavailable`
```json
{
  "status": "error",
  "system": "Jowis Studio Internship ERP API",
  "database": "disconnected",
  "error": "Database unavailable",
  "timestamp": "2026-09-21T12:00:00.000Z"
}
```

### Uptime Monitoring Integration
Configure external uptime monitors (UptimeRobot, BetterUptime, Datadog, Prometheus Blackbox Exporter):
* **Target:** `https://erp.jowis.com/api/health`
* **Expected Status:** `200`
* **Expected Body Keyword:** `"database":"connected"`
* **Check Interval:** Every 60 seconds

---

## 15. Zero-Downtime Deployment Runbook

Follow this runbook when deploying system updates:

```bash
# Step 1: Switch to application directory
cd /var/www/jowis

# Step 2: Pull latest verified release tag
git fetch --tags
git checkout tags/v1.0.0

# Step 3: Update Backend Dependencies & Run Database Migrations
cd /var/www/jowis/backend
npm ci --omit=dev
npm run db:backup   # Always snapshot database prior to migration!
npm run migrate:phase9

# Step 4: Build Frontend Production Bundle
cd /var/www/jowis/frontend
npm ci
npm run build

# Step 5: Reload Backend with Zero-Downtime via PM2
pm2 reload jowis-erp-api --update-env

# Step 6: Post-Deployment Sanity Verification
curl -I https://erp.jowis.com/api/health
```

---

## 16. Rollback & Emergency Procedures

If a deployment introduces a critical defect:

```bash
# 1. Rollback Git release tag
cd /var/www/jowis
git checkout tags/v_PREVIOUS_STABLE

# 2. Re-build frontend from previous stable code
cd /var/www/jowis/frontend
npm run build

# 3. Restore database snapshot if schema migrations were applied
cd /var/www/jowis/backend
node src/scripts/restore_db.js /var/www/jowis/database/backups/backup_jowis_studio_erp_PRE_DEPLOY.sql

# 4. Reload PM2 processes
pm2 reload jowis-erp-api

# 5. Verify system recovery
curl -s https://erp.jowis.com/api/health | grep '"status":"ok"'
```
