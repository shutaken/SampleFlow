# Sample Flow MVP

FANZA動画を対象にした、片手操作前提のサンプル動画フィードMVPです。

## MVP条件

- サイト名: Sample Flow
- 対象: FANZA動画のみ
- 初期ジャンル: 巨乳
- 条件: 新着 × サンプル動画あり
- UI: 縦スクロールで次へ、右スワイプで公式商品ページへ
- 広告: 7本ごとにPRカード
- 技術: Next.js / Supabase / Vercel / GitHub

## 法令・規約遵守方針

- 動画ファイルの保存・編集・再配信は行いません。
- 公式APIまたは公式提供情報を利用します。
- 商品ページへの遷移はアフィリエイトリンクを利用します。
- PR / Affiliate 表記を画面上に表示します。
- 年齢確認画面を設置しています。

## セットアップ

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Supabase

1. Supabase SQL Editorを開く
2. `supabase/schema.sql` を貼り付けて実行
3. `.env.local` にSupabase URL / anon key / service role keyを設定

## DMM / FANZA API

API IDとアフィリエイトIDが発行されたら、`.env.local` に設定してください。

```env
DMM_API_ID=
DMM_AFFILIATE_ID=
```

手動取得テスト:

```bash
curl -X POST http://localhost:3000/api/fanza/fetch \
  -H "x-cron-secret: change_this_to_a_long_random_string"
```

## GitHubアップロード

```bash
git init
git add .
git commit -m "Initial Sample Flow MVP"
git branch -M main
git remote add origin https://github.com/<your-account>/<your-repo>.git
git push -u origin main
```

## Vercel環境変数

- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- DMM_API_ID
- DMM_AFFILIATE_ID
- CRON_SECRET
- NEXT_PUBLIC_SITE_URL

## 注意

初期状態ではSEOインデックスを無効にしています。規約表示、年齢確認、クレジット表示、PR表記、APIレスポンス内容の確認後に `app/layout.tsx` のrobotsを変更してください。
