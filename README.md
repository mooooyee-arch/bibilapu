# 比比拉普 BIBILAPU — 遊戲代練工作室

## 本地開發

```bash
npm install
npm run dev
```

瀏覽器開 http://localhost:3000

## 部署到 Railway

### 1. 上傳到 GitHub
1. 在 GitHub 建新 repo，名字取 `bibilapu`
2. 在這個資料夾執行：
```bash
git init
git add .
git commit -m "init: bibilapu"
git branch -M main
git remote add origin https://github.com/你的帳號/bibilapu.git
git push -u origin main
```

### 2. 連接 Railway
1. 去 railway.app 用 GitHub 登入
2. New Project → Deploy from GitHub repo
3. 選 `bibilapu` repo
4. Railway 會自動偵測 Vite 專案並部署

### 3. 設定環境變數（可選）
在 Railway 的 Variables 頁面加入：
- `VITE_SUPABASE_URL` = 你的 Supabase URL
- `VITE_SUPABASE_ANON_KEY` = 你的 anon key

（目前已經寫在程式碼裡了，環境變數是更安全的做法，之後再改也行）

### 4. 設定自訂網域（可選）
Railway Settings → Custom Domain → 加入你的網域

## 首次使用
1. 在網站上註冊帳號
2. 去 Supabase → Table Editor → profiles
3. 找到你的帳號，把 role 從 customer 改成 admin
4. 重新登入網站，就能看到後台管理了

## 技術架構
- 前端：React + Vite
- 後端/資料庫：Supabase (PostgreSQL)
- 部署：Railway
