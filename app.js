import { auth, db } from "./firebase.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import {
  ref,
  get,
  set,
  push,
  update,
  remove,
  onValue,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-database.js";

const $ = (id) => document.getElementById(id);
let currentUser = null;
let isAdmin = false;
let questions = {};
let profile = {};
let currentSet = [];
let currentIndex = 0;
let answered = false;
let activeMode = "quiz";
let questionsListenerStarted = false;
let profileListenerStarted = false;

const msg = (id, text) => { $(id).textContent = text; };
const normalize = (value) =>
  String(value ?? "").trim().toLocaleLowerCase().replace(/\s+/g, " ");
const values = (object) =>
  Object.entries(object || {}).map(([id, value]) => ({ id, ...value }));
const attempts = () =>
  values(profile.attempts || {}).sort((a, b) => (b.at || 0) - (a.at || 0));
const stats = () => {
  const records = attempts();
  const correct = records.filter((record) => record.correct).length;
  return {
    total: records.length,
    correct,
    rate: records.length ? Math.round(correct / records.length * 100) : 0
  };
};

function friendly(error) {
  const messages = {
    "auth/weak-password": "パスワードは6文字以上にしてください。",
    "auth/email-already-in-use": "このメールアドレスは登録済みです。",
    "auth/invalid-email": "メールアドレスの形式を確認してください。",
    "auth/invalid-credential": "メールアドレスまたはパスワードを確認してください。",
    "auth/network-request-failed": "ネットワーク接続を確認してください。"
  };
  return messages[error.code] || "処理できませんでした。入力内容とFirebase設定を確認してください。";
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function showTab(tab) {
  if (tab === "admin" && !isAdmin) return;
  document.querySelectorAll(".tab").forEach((section) => section.classList.add("hidden"));
  $(tab).classList.remove("hidden");
  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tab);
  });
}

document.querySelectorAll("[data-tab]").forEach((button) => {
  button.addEventListener("click", () => showTab(button.dataset.tab));
});
document.querySelectorAll("[data-go]").forEach((button) => {
  button.addEventListener("click", () => showTab(button.dataset.go));
});

$("loginBtn").addEventListener("click", async () => {
  try {
    await signInWithEmailAndPassword(auth, $("email").value.trim(), $("password").value);
    msg("authMessage", "ログインしました。");
  } catch (error) {
    msg("authMessage", friendly(error));
  }
});

$("signupBtn").addEventListener("click", async () => {
  try {
    await createUserWithEmailAndPassword(auth, $("email").value.trim(), $("password").value);
    msg("authMessage", "登録しました。");
  } catch (error) {
    msg("authMessage", friendly(error));
  }
});

$("logoutBtn").addEventListener("click", async () => {
  try {
    await signOut(auth);
  } catch {
    msg("globalMessage", "ログアウトできませんでした。通信状態を確認してください。");
  }
});

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  $("authView").classList.toggle("hidden", Boolean(user));
  $("appView").classList.toggle("hidden", !user);

  if (!user) {
    $("userLabel").textContent = "ログインしていません";
    isAdmin = false;
    $("adminNav").classList.add("hidden");
    questions = {};
    profile = {};
    questionsListenerStarted = false;
    profileListenerStarted = false;
    return;
  }

  $("userLabel").textContent = user.email || "ログイン中";

  try {
    const adminSnapshot = await get(ref(db, `admins/${user.uid}`));
    if (currentUser?.uid !== user.uid) return;
    isAdmin = adminSnapshot.val() === true;
    $("adminNav").classList.toggle("hidden", !isAdmin);

    if (!questionsListenerStarted) {
      questionsListenerStarted = true;
      onValue(ref(db, "questions"), (snapshot) => {
        questions = snapshot.val() || {};
        renderAdminList();
        renderCategoryOptions();
        renderReviewCount();
      }, () => {
        msg("globalMessage", "問題を読み込めませんでした。データベースの読み取りルールを確認してください。");
      });
    }

    if (!profileListenerStarted) {
      profileListenerStarted = true;
      onValue(ref(db, `users/${user.uid}`), (snapshot) => {
        profile = snapshot.val() || {};
        renderStats();
        renderReviewCount();
        renderHistory();
      }, () => {
        msg("globalMessage", "学習記録を読み込めませんでした。データベースルールを確認してください。");
      });
    }
  } catch {
    msg("globalMessage", "アカウント情報を確認できませんでした。Firebaseの接続とルールを確認してください。");
  }
});

function renderStats() {
  const result = stats();
  ["homeAttempts", "histAttempts"].forEach((id) => { $(id).textContent = result.total; });
  ["homeCorrect", "histCorrect"].forEach((id) => { $(id).textContent = result.correct; });
  ["homeRate", "histRate"].forEach((id) => { $(id).textContent = `${result.rate}%`; });
}

function renderReviewCount() {
  const mistakeIds = Object.keys(profile.mistakes || {}).filter((id) => questions[id]);
  msg("reviewCount", `${mistakeIds.length}問が復習対象です。`);
}

function renderHistory() {
  const records = attempts().slice(0, 30);
  $("historyList").innerHTML = records.length
    ? records.map((record) => `
      <div class="item">
        <b>${escapeHtml(record.questionText || "問題")}</b>
        <div class="muted">${record.correct ? "正解" : "不正解"} ・ ${new Date(record.at || Date.now()).toLocaleString("ja-JP")}</div>
      </div>
    `).join("")
    : "まだ学習記録はありません。";
}

function renderCategoryOptions() {
  const select = $("quizCategorySelect");
  const selected = select.value;
  const categories = [...new Set(
    values(questions)
      .map((question) => String(question.category || "").trim())
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b, "ja"));

  select.replaceChildren();
  const allOption = document.createElement("option");
  allOption.value = "all";
  allOption.textContent = "すべてのカテゴリ";
  select.appendChild(allOption);

  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    select.appendChild(option);
  });

  if ([...select.options].some((option) => option.value === selected)) {
    select.value = selected;
  }
}

function start(mode) {
  const allQuestions = values(questions);
  let filtered = allQuestions;

  // カテゴリ選択は通常の問題演習にだけ適用。復習は全カテゴリから抽出する。
  if (mode === "quiz") {
    const selectedCategory = $("quizCategorySelect").value;
    if (selectedCategory !== "all") {
      filtered = filtered.filter((question) =>
        String(question.category || "").trim() === selectedCategory
      );
    }
  } else if (mode === "review") {
    filtered = filtered.filter((question) => Boolean(profile.mistakes?.[question.id]));
  }

  currentSet = filtered.sort(() => Math.random() - 0.5);
  currentIndex = 0;
  activeMode = mode;

  if (!currentSet.length) {
    msg("qText", mode === "review"
      ? "復習する問題はありません。"
      : "このカテゴリにはまだ問題が登録されていません。");
    $("qCategory").textContent = "";
    $("qCounter").textContent = "";
    $("answerInput").value = "";
    $("answerInput").disabled = true;
    $("checkBtn").disabled = true;
    $("nextBtn").disabled = true;
    $("feedback").classList.add("hidden");
    showTab("quiz");
    return;
  }

  showTab("quiz");
  showQuestion();
}

function showQuestion() {
  const question = currentSet[currentIndex];
  answered = false;
  $("qCategory").textContent = question.category || "未分類";
  $("qCounter").textContent = `${currentIndex + 1} / ${currentSet.length}`;
  $("qText").textContent = question.question || "";
  $("answerInput").value = "";
  $("answerInput").disabled = false;
  $("checkBtn").disabled = false;
  $("nextBtn").disabled = true;
  $("feedback").classList.add("hidden");
}

$("startQuizBtn").addEventListener("click", () => start("quiz"));
$("startReviewBtn").addEventListener("click", () => start("review"));

$("checkBtn").addEventListener("click", async () => {
  if (answered || !currentUser) return;
  const question = currentSet[currentIndex];
  const userAnswer = $("answerInput").value;
  if (!userAnswer.trim()) {
    msg("globalMessage", "解答を入力してください。");
    return;
  }

  const correct = normalize(userAnswer) === normalize(question.answer);
  answered = true;
  $("answerInput").disabled = true;
  $("checkBtn").disabled = true;
  $("nextBtn").disabled = false;

  const feedback = $("feedback");
  feedback.classList.remove("hidden", "good", "bad");
  feedback.classList.add(correct ? "good" : "bad");
  feedback.innerHTML = `
    <b>${correct ? "正解！" : "不正解"}</b><br>
    正解：${escapeHtml(question.answer)}
    ${question.explanation ? `<br>解説：${escapeHtml(question.explanation)}` : ""}
  `;

  const attemptId = push(ref(db, `users/${currentUser.uid}/attempts`)).key;
  const updates = {};
  updates[`users/${currentUser.uid}/attempts/${attemptId}`] = {
    questionId: question.id,
    questionText: question.question,
    userAnswer,
    correct,
    at: Date.now()
  };
  updates[`users/${currentUser.uid}/mistakes/${question.id}`] = correct ? null : true;

  try {
    await update(ref(db), updates);
    msg("globalMessage", "");
  } catch {
    msg("globalMessage", "学習記録を保存できませんでした。データベースルールを確認してください。");
  }
});

$("nextBtn").addEventListener("click", () => {
  currentIndex += 1;
  if (currentIndex >= currentSet.length) {
    msg("qText", "このセットは終了です！");
    $("qCounter").textContent = "完了";
    $("qCategory").textContent = "";
    $("answerInput").value = "";
    $("answerInput").disabled = true;
    $("checkBtn").disabled = true;
    $("nextBtn").disabled = true;
    return;
  }
  showQuestion();
});

$("addQuestionBtn").addEventListener("click", async () => {
  if (!isAdmin) return;
  const category = $("newCategory").value.trim();
  const question = $("newQuestion").value.trim();
  const answer = $("newAnswer").value.trim();
  const explanation = $("newExplanation").value.trim();

  if (!question || !answer) {
    msg("adminMessage", "問題文と正解を入力してください。");
    return;
  }

  try {
    await set(push(ref(db, "questions")), {
      category,
      question,
      answer,
      explanation,
      createdAt: serverTimestamp()
    });
    ["newCategory", "newQuestion", "newAnswer", "newExplanation"].forEach((id) => {
      $(id).value = "";
    });
    msg("adminMessage", "問題を登録しました。");
  } catch {
    msg("adminMessage", "登録できませんでした。管理者設定とデータベースルールを確認してください。");
  }
});

function renderAdminList() {
  if (!isAdmin) return;
  const list = values(questions);
  $("questionList").innerHTML = list.length
    ? list.map((question) => `
      <div class="item">
        <b>${escapeHtml(question.question)}</b>
        <div class="muted">${escapeHtml(question.category || "未分類")}</div>
        <button class="danger" data-delete="${escapeHtml(question.id)}" type="button">削除</button>
      </div>
    `).join("")
    : "登録済み問題はありません。";

  document.querySelectorAll("[data-delete]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!isAdmin || !confirm("この問題を削除しますか？")) return;
      try {
        await remove(ref(db, `questions/${button.dataset.delete}`));
        msg("adminMessage", "問題を削除しました。");
      } catch {
        msg("adminMessage", "削除できませんでした。管理者設定とデータベースルールを確認してください。");
      }
    });
  });
}
