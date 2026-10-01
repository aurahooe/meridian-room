const SUPABASE_URL = "https://tqfocdktvjuwoiyfgesb.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxZm9jZGt0dmp1d29peWZnZXNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5MDg0NTIsImV4cCI6MjEwNTQ4NDQ1Mn0.8TW4fQCQHc4c_xTNBEwOK3lSC9HYCbkTbfXuYQB-S8g";

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const app = document.getElementById("app");
const sessionSlot = document.getElementById("sessionSlot");
const dialog = document.getElementById("authDialog");
const form = document.getElementById("authForm");
const nameField = document.getElementById("nameField");
const authTitle = document.getElementById("authTitle");
const authSubmit = document.getElementById("authSubmit");
const authSwitch = document.getElementById("authSwitch");
const authNote = document.getElementById("authNote");
const tickLabel = document.getElementById("tickLabel");

let mode = "signin";
let session = null;
let profile = null;
let route = location.hash.replace("#", "") || "wall";

const $ = (sel, root = document) => root.querySelector(sel);
const escapeHtml = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[c]));

function hourKey(d = new Date()) {
  const x = new Date(d);
  x.setMinutes(0, 0, 0);
  return x.toISOString().slice(0, 13);
}

function fmt(ts) {
  return new Date(ts).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
  });
}

function tick() {
  const now = new Date();
  const next = new Date(now);
  next.setMinutes(0, 0, 0);
  next.setHours(now.getHours() + 1);
  const left = Math.max(0, next - now);
  const m = Math.floor(left / 60000);
  const s = Math.floor((left % 60000) / 1000);
  tickLabel.textContent = `Next turn ${m}:${String(s).padStart(2, "0")}`;
}

function setAuthMode(next) {
  mode = next;
  const signup = mode === "signup";
  nameField.style.display = signup ? "grid" : "none";
  authTitle.textContent = signup ? "Take a desk" : "Come in";
  authSubmit.textContent = signup ? "Create account" : "Sign in";
  authSwitch.textContent = signup ? "Have an account?" : "Need an account?";
  authNote.textContent = "";
}

function renderSession() {
  if (session) {
    sessionSlot.innerHTML = `<button class="ghost" id="who">${escapeHtml(profile?.display_name || profile?.handle || "You")}</button>
      <button class="ghost" id="out">Leave</button>`;
    $("#out").onclick = () => sb.auth.signOut();
    $("#who").onclick = () => { location.hash = "drawer"; };
  } else {
    sessionSlot.innerHTML = `<button class="ink" id="enter">Sign in</button>`;
    $("#enter").onclick = () => dialog.showModal();
  }
}

function slipHTML(n, extra = "") {
  const who = n.meridian_profiles?.display_name || n.meridian_profiles?.handle || "someone";
  return `<article class="slip">
    <h3>${escapeHtml(n.title || "Untitled")}</h3>
    <div class="body">${escapeHtml(n.body)}</div>
    <div class="meta"><span>${escapeHtml(who)}</span><span>${fmt(n.created_at)}</span></div>
    ${extra}
  </article>`;
}

async function loadHour() {
  const { data } = await sb.from("meridian_hours").select("*").eq("hour_key", hourKey()).maybeSingle();
  if (data) return data;
  const { data: last } = await sb.from("meridian_hours").select("*").order("created_at", { ascending: false }).limit(1);
  return last?.[0] || null;
}

async function loadPublic() {
  const { data } = await sb
    .from("meridian_notes")
    .select("id,title,body,is_public,created_at,author_id,meridian_profiles(handle,display_name)")
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(48);
  return data || [];
}

async function loadMine() {
  if (!session) return [];
  const { data } = await sb
    .from("meridian_notes")
    .select("id,title,body,is_public,created_at,author_id,meridian_profiles(handle,display_name)")
    .eq("author_id", session.user.id)
    .order("created_at", { ascending: false });
  return data || [];
}

async function ensureProfile() {
  if (!session) { profile = null; return; }
  const { data } = await sb.from("meridian_profiles").select("*").eq("id", session.user.id).maybeSingle();
  profile = data;
}

function navOn() {
  document.querySelectorAll(".nav a").forEach((a) => {
    a.classList.toggle("on", a.dataset.route === route);
  });
}

async function render() {
  navOn();
  renderSession();
  if (route === "desk") return renderDesk();
  if (route === "drawer") return renderDrawer();
  return renderWall();
}

async function renderWall() {
  const [hour, notes] = await Promise.all([loadHour(), loadPublic()]);
  app.innerHTML = `
    <section class="hero">
      <div>
        <p class="kicker">This hour</p>
        <h1>${escapeHtml(hour?.title || "The room is still opening.")}</h1>
        <p class="lede">${escapeHtml(hour?.body || "Leave a public slip and it will hang on the wall. Private notes stay in your drawer.")}</p>
      </div>
      <aside class="hour-card">
        <p class="kicker">${escapeHtml(hour?.kicker || "edition")}</p>
        <p>${escapeHtml(hour?.body || "A new feature lands on the hour.")}</p>
      </aside>
    </section>
    <div class="section-head"><h2>The wall</h2><span class="kicker">public only</span></div>
    <div class="grid">${notes.length ? notes.map((n) => slipHTML(n)).join("") : `<p class="empty">No public slips yet. Sign in and pin one.</p>`}</div>`;
}

async function renderDesk() {
  if (!session) {
    app.innerHTML = `<section class="hero"><div><p class="kicker">Desk</p><h1>Sit down first.</h1><p class="lede">Create an account to write. Public slips go on the wall. Private ones stay in the drawer.</p><p><button class="ink" id="needIn">Sign in</button></p></div></section>`;
    $("#needIn").onclick = () => dialog.showModal();
    return;
  }
  app.innerHTML = `
    <section class="hero"><div>
      <p class="kicker">Desk</p>
      <h1>Write a slip.</h1>
      <p class="lede">Tick public if you want it on the wall. Leave it private and only you will see it.</p>
    </div></section>
    <form class="compose" id="noteForm">
      <input name="title" maxlength="80" placeholder="A short title" required />
      <textarea name="body" maxlength="2000" placeholder="What belongs on paper this hour?" required></textarea>
      <label class="check"><input type="checkbox" name="is_public" /> Mark public — show on the wall</label>
      <button class="ink" type="submit">Keep this slip</button>
      <p class="form-note" id="noteErr"></p>
    </form>`;
  $("#noteForm").onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = {
      author_id: session.user.id,
      title: String(fd.get("title") || "").trim(),
      body: String(fd.get("body") || "").trim(),
      is_public: fd.get("is_public") === "on"
    };
    const { error } = await sb.from("meridian_notes").insert(payload);
    if (error) { $("#noteErr").textContent = error.message; return; }
    location.hash = payload.is_public ? "wall" : "drawer";
  };
}

async function renderDrawer() {
  if (!session) {
    app.innerHTML = `<section class="hero"><div><p class="kicker">Drawer</p><h1>Your private stack.</h1><p class="lede">Sign in to see what you kept back.</p><p><button class="ink" id="needIn">Sign in</button></p></div></section>`;
    $("#needIn").onclick = () => dialog.showModal();
    return;
  }
  const notes = await loadMine();
  app.innerHTML = `
    <div class="section-head"><h2>Drawer</h2><span class="kicker">yours</span></div>
    <div class="grid">${notes.length ? notes.map((n) => slipHTML(n, `
      <div class="form-row">
        <button class="ghost" data-toggle="${n.id}" data-public="${n.is_public}">${n.is_public ? "Make private" : "Put on the wall"}</button>
        <button class="ghost" data-del="${n.id}">Throw away</button>
      </div>`)).join("") : `<p class="empty">Nothing in the drawer yet.</p>`}</div>`;
  app.onclick = async (e) => {
    const t = e.target.closest("[data-toggle]");
    const d = e.target.closest("[data-del]");
    if (t) {
      const next = t.dataset.public !== "true";
      await sb.from("meridian_notes").update({ is_public: next, updated_at: new Date().toISOString() }).eq("id", t.dataset.toggle);
      render();
    }
    if (d) {
      await sb.from("meridian_notes").delete().eq("id", d.dataset.del);
      render();
    }
  };
}

form.onsubmit = async (e) => {
  e.preventDefault();
  authNote.textContent = "";
  const fd = new FormData(form);
  const email = String(fd.get("email") || "").trim();
  const password = String(fd.get("password") || "");
  const display_name = String(fd.get("display_name") || "").trim();
  try {
    if (mode === "signup") {
      const handle = (display_name || email.split("@")[0]).toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 24) || "reader";
      const { data, error } = await sb.auth.signUp({ email, password });
      if (error) throw error;
      if (data.user) {
        await sb.from("meridian_profiles").upsert({
          id: data.user.id,
          handle,
          display_name: display_name || handle
        });
      }
      authNote.textContent = data.session ? "Desk is ready." : "Check your email if confirmation is on.";
      if (data.session) dialog.close();
    } else {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
      dialog.close();
    }
  } catch (err) {
    authNote.textContent = err.message || "Could not continue.";
  }
};

authSwitch.onclick = () => setAuthMode(mode === "signin" ? "signup" : "signin");
document.getElementById("authClose").onclick = () => dialog.close();

window.addEventListener("hashchange", () => {
  route = location.hash.replace("#", "") || "wall";
  render();
});

sb.auth.onAuthStateChange(async (_e, sess) => {
  session = sess;
  await ensureProfile();
  render();
});

setAuthMode("signin");
tick();
setInterval(tick, 1000);
setInterval(() => { if (route === "wall") renderWall(); }, 60_000);
render();
