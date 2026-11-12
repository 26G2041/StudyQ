import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-database.js";

// Firebase Console > Project settings > Your apps の設定値です。
// 別のFirebaseプロジェクトを使う場合は、この部分だけ差し替えてください。
const firebaseConfig = {
  apiKey: "AIzaSyDj9gUq0f8UL45YRiW7NdbZ5XusqPc4yQc",
  authDomain: "studyq-cc90e.firebaseapp.com",
  databaseURL: "https://studyq-cc90e-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "studyq-cc90e",
  appId: "1:920201679011:web:a5bb69b4fa0e299cc32f16"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getDatabase(app);
