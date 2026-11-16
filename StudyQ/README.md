# StudyQ

StudyQ は Firebase Authentication と Realtime Database を使った、スマートフォン対応の1問1答アプリです。

## ファイル構成

- `index.html` : 画面の構造
- `style.css` : デザインとスマートフォン対応
- `firebase.js` : Firebase の接続設定
- `app.js` : ログイン、問題演習、復習、学習履歴、管理機能
- `database.rules.json` : Realtime Database のルール例

## 既存Firebaseプロジェクト

`firebase.js` には、現在使用中の StudyQ Firebase プロジェクトの設定を入れてあります。別のプロジェクトに切り替える場合は、Firebase Console の「プロジェクトの設定」→「マイアプリ」から設定値を差し替えてください。

## 起動方法

ES Modules を使うため、`index.html` を直接ダブルクリックして開くのではなく、ローカルWebサーバーまたは Firebase Hosting で開いてください。

VS Code を使う場合は、Live Server 拡張機能などを利用できます。

## Firebase 側で必要な設定

1. Authentication で Email/Password を有効にする。
2. Realtime Database を作成する。
3. `database.rules.json` のルールを Realtime Database の「ルール」に反映する。
4. 管理者にするアカウントの UID を確認し、Realtime Database のデータに `/admins/UID: true` を設定する。

## 注意

この構成では、ログイン済みユーザーが問題データを読み取る設計です。問題の正解もブラウザーに配信されるため、テストや試験のように正解を秘匿する用途には適しません。公開利用前に、Firebase のセキュリティルールと利用範囲を確認してください。
