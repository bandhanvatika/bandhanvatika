# 🚀 Bandhan Vatika — Deployment & Hosting Guide

Is software ko deploy karne ke liye **3 sabse aasan aur best tareeqe** hain. Aap apni zaroorat aur budget ke hisaab se koi bhi option chun sakte hain:

---

## 🌟 Option 1: Render.com (Sabse Aasan & Recommended)
> **Kyun chune?** 
> - Free/Low cost tier available.
> - PostgreSQL database aur Node.js app dono 1 jagah mil jaate hain.
> - Automatic SSL (`https://`) aur GitHub se auto-deploy hota hai.

### Steps:
1. **GitHub par push karein**:
   - Apne project ko GitHub repository me push karein.
2. **Render.com par account banayein**:
   - [render.com](https://render.com) par login karein.
3. **PostgreSQL Database banayein**:
   - **New +** -> **PostgreSQL** select karein.
   - Name: `bandhan-vatika-db`
   - Database: `bandhan_vatika`
   - **Create Database** par click karein.
   - Creation ke baad **Internal Database URL** copy kar lein.
4. **Web Service banayein**:
   - **New +** -> **Web Service** select karein.
   - Apni GitHub repo connect karein.
   - Settings:
     - **Runtime**: `Node`
     - **Build Command**: `npm install && npm run build`
     - **Start Command**: `npm start`
5. **Environment Variables set karein**:
   - `DATABASE_URL` = (Jo step 3 me PostgreSQL URL mila)
   - `NODE_ENV` = `production`
   - `JWT_SECRET` = `koi_bhi_strong_random_secret_key`
6. **Deploy**:
   - **Deploy Web Service** par click karein. 2 minute me aapka software live ho jayega (e.g., `https://bandhan-vatika.onrender.com`).

---

## 🚂 Option 2: Railway.app (Ultra Fast & Modern)
> **Kyun chune?**
> - Single click me app + PostgreSQL database dono setup ho jaate hain.
> - Indian payment cards easily support karta hai.

### Steps:
1. [railway.app](https://railway.app) par login karein.
2. **New Project** -> **Deploy from GitHub repo** select karein.
3. Project canvas par **+ New** -> **Database** -> **Add PostgreSQL** karein.
4. App settings me jaakar:
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
5. Variables me:
   - `DATABASE_URL` me `${{Postgres.DATABASE_URL}}` select kar lein (auto-linked).
   - `JWT_SECRET` = `apna_strong_secret`
   - `NODE_ENV` = `production`
6. Settings -> **Generate Domain** par click karein. Aapko live link mil jayega.

---

## 🖥️ Option 3: VPS / Cloud Server (DigitalOcean / Hostinger / AWS EC2 / Hetzner)
> **Kyun chune?**
> - Agar aapko monthly fixed ₹400 - ₹600 me apna custom domain (`https://erp.bandhanvatika.com`) chalana hai.
> - 100% full control over data.

### Method A: Docker se 1-Command Deploy (Sabse Aasan VPS par)
Server terminal (SSH) me jaakar:
```bash
# 1. Docker install karein (agar nahi hai)
curl -fsSL https://get.docker.com -o get-docker.sh && sh get-docker.sh

# 2. Project directory me jayein
cd bandhanvatikabillingsoft-main

# 3. Docker Compose run karein
docker compose up -d --build
```
Aapka application port `3000` par aur database background me automatically start ho jayenge.

### Method B: Ubuntu VPS par PM2 + Nginx + Free SSL
```bash
# 1. Node.js 20 install karein
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs postgresql postgresql-contrib nginx

# 2. Global packages
sudo npm install -g pm2 tsx

# 3. PostgreSQL database setup
sudo -u postgres psql -c "CREATE USER vatika WITH PASSWORD 'your_password';"
sudo -u postgres psql -c "CREATE DATABASE bandhan_vatika OWNER vatika;"

# 4. Project build
npm install
npm run build

# 5. .env file create karein
cp .env.example .env
nano .env  # Apna DATABASE_URL aur JWT_SECRET dalein

# 6. PM2 se start karein
pm2 start "npm start" --name "bandhan-vatika"
pm2 save
pm2 startup

# 7. Nginx reverse proxy aur Certbot SSL
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

---

## 🔑 Production Environment Variables Checklist

| Variable Name | Purpose | Example Value |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/bandhan_vatika?sslmode=require` |
| `NODE_ENV` | Mode | `production` |
| `PORT` | Web server listening port | `3000` (auto assigned by cloud) |
| `JWT_SECRET` | Auth Token encryption secret | `any_long_random_string_xyz123` |

---

## 🛡️ Default Admin Login Credentials (First Time)
Database initialize hote hi default admin account ready rehta hai:
- **Username**: `admin`
- **Password**: `admin123`
- *(Login karne ke baad Owner Settings/Users module se password change kar sakte hain).*
