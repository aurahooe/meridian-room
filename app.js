import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SUPABASE_URL = "https://tqfocdktvjuwoiyfgesb.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxZm9jZGt0dmp1d29peWZnZXNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5MDg0NTIsImV4cCI6MjEwNTQ4NDQ1Mn0.8TW4fQCQHc4c_xTNBEwOK3lSC9HYCbkTbfXuYQB-S8g";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

const HOUSE = [
  ["Still dark", "The room is mostly lamp and paper. Write short."],
  ["First shift", "Whatever you leave now will look like it arrived before the city did."],
  ["Low traffic", "A good hour for a private note you do not intend to explain."],
  ["Kettle hour", "Keep the slip to one idea. The wall gets noisy later."],
  ["Blue window", "Name a thing you noticed, not a thing you concluded."],
  ["Early board", "Public slips from this hour sit higher than yesterday's."],
  ["Commuter margin", "A sentence is enough. Titles are optional."],
  ["Opened shutters", "If it is for the wall, write as if a stranger will read it cold."],
  ["Desk light", "The feature above the wall is this hour's only editorial. The rest is yours."],
  ["Working quiet", "Private stays in the drawer. Public is the room, not a feed."],
  ["Mid-morning", "Leave a correction, a scrap, or a small argument."],
  ["Before lunch", "Short slips read better than manifestos. The tape only holds so much."],
  ["Noon mark", "The clock turns. Older public slips stay; they just stop being this hour."],
  ["After the bell", "If you changed your mind, the drawer still lets you unpublish."],
  ["Slow stretch", "Write the thing you would pin above a desk, not a status."],
  ["Long light", "Names on the wall are the names you chose at signup."],
  ["Late errands", "A public slip is a small commitment. Edit it if it is wrong."],
  ["Shutting drawers", "Private notes are still saved. They simply do not leave the account."],
  ["Lamp again", "The room does not rank you. It only sorts by time."],
  ["Evening board", "Read the wall before you add to it. Repetition shows."],
  ["Quiet returns", "This hour's feature is a prompt, not a rule."],
  ["Last public", "If it should not be seen, leave the switch off."],
  ["Closing", "Tomorrow's first hour starts empty unless someone writes into it."],
  ["Night watch", "The clock keeps moving. Your drawer does not empty itself."],
];

const app = document.querySelector("#app");
const nav = document.querySelector("#nav");
const sessionSlot = document.querySelector("#sessionSlot");
const tickLabel = document.querySelector("#tickLabel");
const dialog = document.querySelector("#authDialog");
const authForm = document.querySelector("#authForm");
const nameField = document.querySelector("#nameField");
const authTitle = document.querySelector("#authTitle");
const authSubmit = document.querySelector("#authSubmit");
const authSwitch = document.querySelector("#authSwitch");
const authNote = document.querySelector("#authNote");
const authClose = document.querySelector("#authClose");

let mode = "in";
let session = null;
let profile = null;
let wallFilter = "hour";
let lastHour = hourKey();
let channel;

function hourKey(date = new Date()) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  const h = String(date.getUTCHours()).padStart(2, "0");
  return `${y}-${m}-${d}T${h}`;
}

function localStamp(iso) {
  const date = new Date(iso);
  return date.toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

function route() {
  const name = (location.hash || "#wall").slice(1);
  return ["wall", "desk", "drawer"].includes(name) ? name : "wall";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&")
    .replaceAll("<", "<")
    .replaceAll(">", ">")
    .replaceAll('"', """);
}

function tilt(id) {
  let n = 0;
  for (const ch of id) n = (n + ch.charCodeAt(0)) % 7;
  return (n - 3) * 0.35;
}

function paintClock() {
  const now = new Date();
  const minute = now.getMinutes() + now.getSeconds() / 60;
  const hour = (now.getHours() % 12) + minute / 60;
  document.querySelector(".hand.hour").style.transform = `translateX(-50%) rotate(${hour * 30}deg)`;
  document.querySelector(".hand.minute").style.transform = `translateX(-50%) rotate(${minute * 6}deg)`;
  tickLabel.textContent = now.toLocaleString(undefined, {
    weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

function paintSession() {
  if (session && profile) {
    sessionSlot.innerHTML = `<span class="who">${escapeHtml(profile.display_name)}</span><button type="button" id="signOut">Sign out</button>`;
    document.querySelector("#signOut").onclick = () => supabase.auth.signOut();
  } else if (session) {
    sessionSlot.innerHTML = `<button type="button" class="ink" id="openAuth">Finish account</button>`;
    document.querySelector("#openAuth").onclick = openAuth;
  } else {
    sessionSlot.innerHTML = `<button type="button" class="ink" id="openAuth">Sign in</button>`;
    document.querySelector("#openAuth").onclick = openAuth;
  }
  for (const link of nav.querySelectorAll("a")) {
    link.classList.toggle("active", link.dataset.route === route());
  }
}

function openAuth() {
  authNote.textContent = "";
  dialog.showModal();
}

function setMode(next) {
  mode = next;
  const signingUp = mode === "up";
  nameField.hidden = !signingUp;
  authTitle.textContent = signingUp ? "Take a name" : "Come in";
  authSubmit.textContent = signingUp ? "Create account" : "Sign in";
  authSwitch.textContent = signingUp ? "Already have one?" : "Need an account?";
  authForm.password.autocomplete = signingUp ? "new-password" : "current-password";
}

authSwitch.onclick = () => setMode(mode === "in" ? "up" : "in");
authClose.onclick = () => dialog.close();

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  authNote.textContent = "";
  authSubmit.disabled = true;
  const email = authForm.email.value.trim();
  const password = authForm.password.value;
  try {
    if (mode === "up") {
      const display_name = authForm.display_name.value.trim() || email.split("@")[0];
      const { data, error } = await supabase.auth.signUp({
        email, password, options: { data: { display_name } },
      });
      if (error) throw error;
      if (!data.session) {
        authNote.textContent = "Check your email to confirm, then sign in. The room will keep the name you chose.";
      } else {
        dialog.close();
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      dialog.close();
    }
  } catch (error) {
    authNote.textContent = error.message || "Could not sign in.";
  } finally {
    authSubmit.disabled = false;
  }
});

async function loadProfile() {
  if (!session) { profile = null; return; }
  const { data } = await supabase.from("profiles").select("id, display_name").eq("id", session.user.id).maybeSingle();
  profile = data;
  if (!profile) {
    const display_name = session.user.user_metadata?.display_name || session.user.email.split("@")[0];
    const inserted = await supabase.from("profiles").insert({ id: session.user.id, display_name }).select().maybeSingle();
    profile = inserted.data;
  }
}

async function currentMark() {
  const key = hourKey();
  const { data } = await supabase.from("hour_marks").select("headline, note, accent, hour_key").eq("hour_key", key).maybeSingle();
  if (data) return data;
  const brief = HOUSE[new Date().getUTCHours()];
  return { headline: brief[0], note: brief[1], accent: "#7a2e2e", hour_key: key, fallback: true };
}

function featureHtml(mark) {
  const label = mark.fallback ? "Standing brief" : "This hour";
  return `
    <aside class="feature is-swapping" style="--accent:${escapeHtml(mark.accent || "#7a2e2e")}">
      <p class="eyebrow">${label} · ${escapeHtml(mark.hour_key)} UTC</p>
      <h1>${escapeHtml(mark.headline)}</h1>
      <p>${escapeHtml(mark.note)}</p>
      <div class="meta-row"><span>Changes at the top of the hour</span><span id="countLabel"></span></div>
    </aside>`;
}

async function renderWall() {
  const mark = await currentMark();
  const start = new Date();
  start.setUTCMinutes(0, 0, 0);
  let query = supabase.from("slips").select("id, title, body, created_at, profiles(display_name)").eq("is_public", true).order("created_at", { ascending: false }).limit(60);
  if (wallFilter === "hour") query = query.gte("created_at", start.toISOString());
  const { data, error } = await query;
  const slips = data || [];
  app.innerHTML = `
    <section class="layout">
      ${featureHtml(mark)}
      <div>
        <div class="wall-head">
          <div>
            <p class="eyebrow">Public wall</p>
            <h2 style="font-family:var(--serif);font-weight:560;letter-spacing:-0.03em;margin:0">What people left out</h2>
          </div>
          <div class="filters">
            <button type="button" data-filter="hour" aria-pressed="${wallFilter === "hour"}">This hour</button>
            <button type="button" data-filter="all" aria-pressed="${wallFilter === "all"}">All public</button>
          </div>
        </div>
        ${error ? `<p class="form-note">${escapeHtml(error.message)}</p>` : ""}
        ${slips.length ? `<div class="slips">${slips.map((slip, i) => `
          <article class="slip" style="animation-delay:${i * 40}ms;transform:rotate(${tilt(slip.id)}deg)">
            <h3>${escapeHtml(slip.title || "Untitled slip")}</h3>
            <p>${escapeHtml(slip.body)}</p>
            <footer><span>${escapeHtml(slip.profiles?.display_name || "unsigned")}</span><span>${localStamp(slip.created_at)}</span></footer>
          </article>`).join("")}</div>` : `<p class="empty">Nothing public ${wallFilter === "hour" ? "in this hour" : "yet"}. The desk is open.</p>`}
      </div>
    </section>`;
  const count = document.querySelector("#countLabel");
  if (count) count.textContent = `${slips.length} on view`;
  app.querySelectorAll("[data-filter]").forEach((button) => {
    button.onclick = () => { wallFilter = button.dataset.filter; render(); };
  });
}

async function renderDesk() {
  const mark = await currentMark();
  if (!session) {
    app.innerHTML = `<section class="layout">${featureHtml(mark)}<div class="panel"><p class="eyebrow">Desk</p><h2>Sign in to leave a slip</h2><p>Accounts are email and password. Public slips appear on the wall. Private ones stay in your drawer.</p><button type="button" class="ink" id="needAuth">Sign in</button></div></section>`;
    document.querySelector("#needAuth").onclick = openAuth;
    return;
  }
  app.innerHTML = `
    <section class="layout">
      ${featureHtml(mark)}
      <form class="panel" id="slipForm">
        <p class="eyebrow">Desk</p>
        <h2>Leave something</h2>
        <label class="field"><span>Title, if it needs one</span><input name="title" maxlength="80" placeholder="Optional" /></label>
        <label class="field"><span>Slip</span><textarea name="body" required maxlength="800" placeholder="Write it once. You can still edit it in the drawer."></textarea></label>
        <label class="switch"><input type="checkbox" name="is_public" /> Put this on the public wall</label>
        <p class="form-note" id="slipNote"></p>
        <div class="form-row"><button class="ink" type="submit">Save slip</button></div>
      </form>
    </section>`;
  document.querySelector("#slipForm").onsubmit = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const note = document.querySelector("#slipNote");
    note.textContent = "";
    const body = form.body.value.trim();
    if (!body) return;
    const { error } = await supabase.from("slips").insert({
      author_id: session.user.id,
      title: form.title.value.trim(),
      body,
      is_public: form.is_public.checked,
    });
    if (error) { note.textContent = error.message; return; }
    form.reset();
    note.textContent = form.is_public.checked ? "On the wall." : "Saved to your drawer.";
    if (form.is_public?.checked === false) location.hash = "#drawer";
  };
}

async function renderDrawer() {
  if (!session) {
    app.innerHTML = `<section class="panel"><p class="eyebrow">Drawer</p><h2>Yours, once you sign in</h2><button type="button" class="ink" id="needAuth">Sign in</button></section>`;
    document.querySelector("#needAuth").onclick = openAuth;
    return;
  }
  const { data, error } = await supabase.from("slips").select("id, title, body, is_public, created_at").eq("author_id", session.user.id).order("created_at", { ascending: false });
  const slips = data || [];
  app.innerHTML = `
    <section class="panel">
      <p class="eyebrow">Drawer</p>
      <h2>${escapeHtml(profile?.display_name || "Your slips")}</h2>
      <form id="nameForm" class="form-row" style="margin-bottom:18px">
        <label class="field" style="flex:1;margin:0"><span>Name on the wall</span><input name="display_name" maxlength="40" value="${escapeHtml(profile?.display_name || "")}" /></label>
        <button type="submit">Save name</button>
      </form>
      ${error ? `<p class="form-note">${escapeHtml(error.message)}</p>` : ""}
      <div class="list">${slips.length ? slips.map((slip) => `
        <article class="row-slip" data-id="${slip.id}">
          <div>
            <h3>${escapeHtml(slip.title || "Untitled slip")}</h3>
            <p>${escapeHtml(slip.body)}</p>
            <footer class="meta-row"><span>${localStamp(slip.created_at)}</span><span class="badge ${slip.is_public ? "public" : ""}">${slip.is_public ? "Public" : "Private"}</span></footer>
          </div>
          <div class="row-actions">
            <button type="button" data-act="toggle">${slip.is_public ? "Make private" : "Make public"}</button>
            <button type="button" data-act="delete">Delete</button>
          </div>
        </article>`).join("") : `<p class="empty">The drawer is empty.</p>`}</div>
    </section>`;
  document.querySelector("#nameForm").onsubmit = async (event) => {
    event.preventDefault();
    const display_name = event.currentTarget.display_name.value.trim();
    if (!display_name) return;
    await supabase.from("profiles").update({ display_name }).eq("id", session.user.id);
    profile = { ...profile, display_name };
    paintSession();
    render();
  };
  app.querySelectorAll(".row-slip").forEach((row) => {
    const id = row.dataset.id;
    row.querySelector('[data-act="toggle"]').onclick = async () => {
      const slip = slips.find((item) => item.id === id);
      await supabase.from("slips").update({ is_public: !slip.is_public }).eq("id", id);
      render();
    };
    row.querySelector('[data-act="delete"]').onclick = async () => {
      await supabase.from("slips").delete().eq("id", id);
      render();
    };
  });
}

async function render() {
  paintSession();
  const name = route();
  if (name === "desk") await renderDesk();
  else if (name === "drawer") await renderDrawer();
  else await renderWall();
}

async function boot() {
  const { data } = await supabase.auth.getSession();
  session = data.session;
  await loadProfile();
  paintClock();
  paintSession();
  await render();
  channel = supabase.channel("public-slips")
    .on("postgres_changes", { event: "*", schema: "public", table: "slips" }, () => {
      if (route() === "wall") renderWall();
    })
    .subscribe();
}

supabase.auth.onAuthStateChange(async (_event, next) => {
  session = next;
  await loadProfile();
  paintSession();
  render();
});

window.addEventListener("hashchange", render);
setInterval(() => {
  paintClock();
  const key = hourKey();
  if (key !== lastHour) {
    lastHour = key;
    render();
  }
}, 1000);

setMode("in");
boot();
