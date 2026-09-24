# AZ斜め壁補助計算Web-CAD デプロイ・サーバー同期仕様書 (DEPLOYMENT.md)

本ドキュメントは、本システムを GitHub および Xserver 本番環境（`az.mdo3.com`）へ安全かつ迅速にデプロイ・同期するための運用仕様を定義するものです。

---

## 1. サーバー環境仕様

- **本番ドメイン**: [https://az.mdo3.com](https://az.mdo3.com)
- **サーバーID / ホスト**: `mdo3@mdo3.xsrv.jp`
- **SSHポート**: `10022`
- **サーバー保存先ディレクトリ**: `/home/mdo3/mdo3.com/public_html/az`
- **GitHubリポジトリ**: `git@github.com:mdo3-system/az.git`
- **運用ブランチ**: `main`

---

## 2. 日常のデプロイフロー (日常運用)

開発作業時の基本サイクルは以下の通りです。

```bash
# 1. 最新コードの取得
git pull origin main

# 2. 変更のバックアップ・コミット
git add .
git commit -m "Backup before: [作業内容・バージョン更新]"

# 3. GitHubへプッシュ
git push origin main

# 4. Xserver本番環境への自動デプロイ
ssh -o BatchMode=yes -p 10022 mdo3@mdo3.xsrv.jp "cd mdo3.com/public_html/az && git pull origin main"
```

---

## 3. Webルーティング設定

リポジトリ内の主要なWeb画面は `frontend/index.html` に格納されています。  
ルートドメイン `https://az.mdo3.com/` にアクセスした際、自動的に `frontend/index.html` が表示・実行されるよう、ルート直下に以下の設定を配置しています。

- **[.htaccess](.htaccess)**: Apacheの `DirectoryIndex` および `mod_rewrite` により、`/` へのアクセスを `frontend/index.html` に内部転送。
- **[index.html](index.html)**: 万が一 `.htaccess` が機能しない場合でも即座に `./frontend/index.html` へ自動遷移するJavaScript/Meta Refreshフォールバック。

---

## 4. バージョン管理・同期項目

バージョンを更新する際は、以下のファイルすべてでバージョン番号（例：`v3.2.7`）を同期して更新します。

1. `Version.js` (`window.APP_VERSION`)
2. `frontend/assets/js/modules/foundation/core/constants.js` (`APP_VERSION`)
3. `frontend/index.html` (ヘッダー `topbar-version` およびフッター `app-version`)
4. `frontend/assets/js/modules/foundation/foundation_main.js` (コンソールログ)
5. `frontend/assets/js/modules/foundation/events/global_bridge.js` (コンソールログ)

---

## 5. 初回初期化手順 (Initial Setup)

初回デプロイ時、サーバー側ディレクトリが未Git化状態である場合は以下の手順で初期化します。

1. ローカル側でリモート `origin` を設定し、`main` ブランチへ初回プッシュ：
   ```bash
   git remote add origin git@github.com:mdo3-system/az.git
   git branch -M main
   git push -u origin main
   ```
2. サーバー側（Xserver）で初期ファイルを整理し、`git clone` を実行：
   ```bash
   ssh -o BatchMode=yes -p 10022 mdo3@mdo3.xsrv.jp "cd mdo3.com/public_html/az && rm -f default_page.png index.html && git clone git@github.com:mdo3-system/az.git .temp && mv .temp/.git . && rm -rf .temp && git checkout -f main"
   ```
