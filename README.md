# Alpha Signal AI

正式版網站專案，包含：

- Express 後端 API
- PostgreSQL 資料庫
- Google OAuth 登入
- 信箱註冊 / 登入
- 會員中心
- 管理後台
- 訊號掃描與保存
- Telegram 推播
- 人工付款紀錄與後台批准

## Railway 部署

1. Railway 專案加入 GitHub repo：`TOBTLEE/alpha-signal-ai`
2. 加入 PostgreSQL 服務
3. 在 Web Service 的 Variables 設定：

```env
DATABASE_URL=${{Postgres.DATABASE_URL}}
JWT_SECRET=請改成一串很長的隨機字串
ADMIN_EMAIL=你的管理員信箱
ADMIN_PASSWORD=你的管理員密碼
ADMIN_NAME=站長
BASE_URL=https://你的Railway網址
TELEGRAM_BOT_TOKEN=你的TelegramBotToken
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://你的Railway網址/api/auth/google/callback
```

## 注意

系統不保存明文密碼。管理後台只會顯示安全雜湊預覽或 Google 登入狀態。
