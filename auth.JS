// ============================================================
// auth.js — controle de licença (login + senha + trava por aparelho)
// Usa o Supabase como banco de dados de licenças.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://jjacaqcleowqsnylnrvx.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_VLSY_53Fp8Yqr9_N0rwz-w_1yQPFgRO";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const DEVICE_KEY = "xpt_device_id_v1";
const SESSION_KEY = "xpt_session_v1";

function getDeviceId() {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

function getStoredSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
  } catch {
    return null;
  }
}

function saveSession(username, expiresAt) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ username, expiresAt }));
  } catch {
    // localStorage indisponível — segue sem salvar (vai pedir login de novo)
  }
}

function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // ignora
  }
}

function reasonMessage(reason) {
  const map = {
    invalid_credentials: "Usuário ou senha incorretos.",
    device_mismatch: "Essa licença já está em uso em outro computador.",
    expired: "Sua licença expirou. Fale com quem vendeu o seu acesso.",
    revoked: "Esse acesso foi revogado.",
  };
  return map[reason] || "Não foi possível entrar. Tente novamente.";
}

function daysRemaining(expiresAt) {
  const diff = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86400000));
}

function updateLicenseBadge(expiresAt) {
  const badge = document.getElementById("licenseBadge");
  if (!badge) return;
  const days = daysRemaining(expiresAt);
  badge.innerText = `🔑 ${days} dia${days === 1 ? "" : "s"} restante${days === 1 ? "" : "s"}`;
  badge.title = "Renove seu acesso com quem vendeu a licença";
}

function unlockDashboard(expiresAt) {
  const gate = document.getElementById("authGate");
  if (gate) gate.style.display = "none";
  updateLicenseBadge(expiresAt);
}

function showError(message) {
  const el = document.getElementById("authError");
  if (!el) return;
  el.innerText = message;
  el.style.display = "block";
}

function setLoading(isLoading) {
  const btn = document.getElementById("authSubmit");
  if (!btn) return;
  btn.disabled = isLoading;
  btn.innerText = isLoading ? "Entrando..." : "Entrar";
}

async function attemptLogin(username, password) {
  setLoading(true);
  const device = getDeviceId();

  const { data, error } = await supabase.rpc("login_and_check", {
    p_username: username,
    p_password: password,
    p_device: device,
  });

  setLoading(false);

  if (error) {
    console.error(error);
    showError("Erro de conexão. Verifique sua internet e tente de novo.");
    return;
  }
  if (!data.ok) {
    showError(reasonMessage(data.reason));
    return;
  }

  saveSession(username, data.expires_at);
  unlockDashboard(data.expires_at);
}

async function trySilentSession() {
  const session = getStoredSession();
  if (!session) return false;

  const device = getDeviceId();
  const { data, error } = await supabase.rpc("check_session", {
    p_username: session.username,
    p_device: device,
  });

  if (error || !data || !data.ok) {
    clearSession();
    return false;
  }

  unlockDashboard(data.expires_at);
  return true;
}

async function initAuthGate() {
  const ok = await trySilentSession();
  if (ok) return;

  const submitBtn = document.getElementById("authSubmit");
  const userInput = document.getElementById("authUsername");
  const passInput = document.getElementById("authPassword");
  if (!submitBtn || !userInput || !passInput) return;

  function submit() {
    const username = userInput.value.trim();
    const password = passInput.value;
    if (!username || !password) {
      showError("Preencha usuário e senha.");
      return;
    }
    document.getElementById("authError").style.display = "none";
    attemptLogin(username, password);
  }

  submitBtn.addEventListener("click", submit);
  [userInput, passInput].forEach((input) => {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") submit();
    });
  });
}

initAuthGate();