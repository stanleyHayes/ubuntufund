/**
 * Self-contained OBS browser-source overlay page for a LIVE fundraising session.
 *
 * Served (public, HTML) at GET /live-sessions/:id/overlay/view?token=… — the host
 * pastes that URL into OBS as a Browser Source. The page is fully STATIC: it reads
 * its overlay token from `location.search` and derives the session's API base from
 * `location.pathname`, then pulls initial state from the token-gated overlay JSON
 * endpoint and streams live updates over the SSE gateway. Nothing is templated into
 * the HTML server-side, so there is no injection surface; all donor-supplied text is
 * rendered with `textContent` (never innerHTML).
 *
 * The bytes never change per session, so the controller can serve this constant
 * directly with long-lived caching.
 */
export const OVERLAY_PAGE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>Live Fundraising Overlay</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800;900&display=swap" rel="stylesheet" />
<style>
  :root {
    --forest: #2E3D2F;
    --forest-2: #24301F;
    --sage: #A8B5A0;
    --gold: #C7A24A;
    --parchment: #F2EFEA;
    --ink: #12180F;
    --radius: 18px;
    --shadow: 0 10px 34px rgba(0,0,0,0.45);
    --edge: rgba(255,255,255,0.14);
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    width: 100%; height: 100%;
    background: transparent;          /* OBS transparency */
    overflow: hidden;
    font-family: "Outfit", "Segoe UI", system-ui, -apple-system, sans-serif;
    color: #fff;
    -webkit-font-smoothing: antialiased;
  }
  .stage { position: fixed; inset: 0; }

  /* ── Donation alert stack (top-left) ─────────────────────────── */
  .alerts { position: absolute; top: 32px; left: 32px; display: flex; flex-direction: column; gap: 12px; width: 460px; }
  .alert {
    background: linear-gradient(135deg, var(--forest), var(--forest-2));
    border: 1px solid var(--edge);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    padding: 16px 20px;
    transform: translateX(-120%);
    opacity: 0;
    animation: alert-in .5s cubic-bezier(.2,.9,.25,1) forwards;
  }
  .alert.leaving { animation: alert-out .45s ease forwards; }
  .alert .who { font-weight: 800; font-size: 1.15rem; letter-spacing: .2px; text-shadow: 0 2px 6px rgba(0,0,0,.5); }
  .alert .amt { color: var(--gold); font-weight: 900; }
  .alert .msg { margin-top: 6px; font-size: .95rem; color: rgba(255,255,255,.86); line-height: 1.35; }
  @keyframes alert-in  { to { transform: translateX(0); opacity: 1; } }
  @keyframes alert-out { to { transform: translateX(-120%); opacity: 0; } }

  /* ── Goal panel (bottom) ─────────────────────────────────────── */
  .panel {
    position: absolute; left: 32px; right: 32px; bottom: 32px;
    background: linear-gradient(135deg, rgba(46,61,47,.94), rgba(36,48,31,.94));
    border: 1px solid var(--edge);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    padding: 20px 26px;
    backdrop-filter: blur(3px);
  }
  .panel .row { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; }
  .panel .title {
    font-weight: 800; font-size: 1.5rem; letter-spacing: .2px;
    text-shadow: 0 2px 8px rgba(0,0,0,.5);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 60%;
  }
  .panel .totals { text-align: right; font-variant-numeric: tabular-nums; }
  .panel .raised { font-size: 1.9rem; font-weight: 900; color: #fff; text-shadow: 0 2px 8px rgba(0,0,0,.5); }
  .panel .goal { font-size: 1rem; color: var(--sage); font-weight: 600; }
  .bar { position: relative; height: 16px; margin-top: 14px; border-radius: 999px; background: rgba(255,255,255,.12); overflow: hidden; }
  .bar .fill {
    position: absolute; inset: 0 auto 0 0; width: 100%;
    transform: scaleX(0); transform-origin: left center;
    background: linear-gradient(90deg, var(--gold), #E4C878);
    border-radius: 999px;
    transition: transform .9s cubic-bezier(.2,.8,.2,1);
    box-shadow: 0 0 18px rgba(199,162,74,.55);
  }
  .bar .pct {
    position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
    font-size: .72rem; font-weight: 800; color: var(--ink); mix-blend-mode: screen;
  }
  .meta { display: flex; gap: 20px; margin-top: 12px; font-size: .9rem; color: rgba(255,255,255,.82); }
  .meta b { color: var(--gold); font-weight: 800; }

  /* ── Milestone celebration (center) ──────────────────────────── */
  .milestone {
    position: absolute; top: 22%; left: 50%; transform: translate(-50%,-50%) scale(.6);
    background: linear-gradient(135deg, var(--gold), #E4C878);
    color: var(--forest-2); font-weight: 900; font-size: 2rem;
    padding: 18px 40px; border-radius: 999px; box-shadow: 0 16px 50px rgba(0,0,0,.5);
    opacity: 0; pointer-events: none; text-align: center;
  }
  .milestone.show { animation: pop .55s cubic-bezier(.22,1,.36,1) forwards; }
  .milestone.hide { animation: fade .5s ease forwards; }
  @keyframes pop  { to { transform: translate(-50%,-50%) scale(1); opacity: 1; } }
  @keyframes fade { to { opacity: 0; transform: translate(-50%,-50%) scale(1.08); } }

  /* ── Connection / error toast ────────────────────────────────── */
  .status {
    position: absolute; top: 16px; right: 16px;
    font-size: .78rem; color: rgba(255,255,255,.75);
    background: rgba(0,0,0,.42); border: 1px solid var(--edge);
    padding: 6px 12px; border-radius: 999px; opacity: 0; transition: opacity .3s;
  }
  .status.show { opacity: 1; }
  .status.err { color: #FFC9BD; border-color: rgba(255,120,90,.5); }

  @media (prefers-reduced-motion: reduce) {
    .alert, .milestone.show, .milestone.hide { animation: none; opacity: 1; transform: none; }
    .bar .fill { transition: none; }
  }

  @media (max-width: 600px) { .panel { left: 16px; right: 16px; bottom: 16px; padding: 16px; } .panel .row { display: block; } .panel .title { max-width: 100%; font-size: 1.1rem; } .panel .totals { text-align: left; } .panel .raised { font-size: 1.4rem; } .alerts { left: 16px; width: calc(100% - 32px); } .meta { font-size: .75rem; } }
  @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: .01ms !important; transition: none !important; } }
</style>
</head>
<body>
  <div class="stage">
    <div class="alerts" id="alerts" aria-live="polite"></div>
    <div class="milestone" id="milestone" role="status"></div>
    <div class="status" id="status" role="status"></div>
    <div class="panel" id="panel" hidden>
      <div class="row">
        <div class="title" id="title">Live Fundraiser</div>
        <div class="totals">
          <div class="raised" id="raised">GH₵ 0</div>
          <div class="goal">of <span id="goal">GH₵ 0</span> goal</div>
        </div>
      </div>
      <div class="bar"><div class="fill" id="fill"></div><span class="pct" id="pct">0%</span></div>
      <div class="meta">
        <span>Raised live <b id="sessionRaised">GH₵ 0</b></span>
        <span><b id="donations">0</b> donations</span>
      </div>
    </div>
  </div>
<script>
(function () {
  "use strict";

  var params = new URLSearchParams(location.search);
  // Session API base is this page's path minus the trailing /overlay/view.
  var sessionBase = location.pathname.replace(/\\/overlay\\/view\\/?$/, "");
  var token = new URLSearchParams(location.search).get("token") || "";
  var qs = token ? "?token=" + encodeURIComponent(token) : "";

  var el = function (id) { return document.getElementById(id); };
  var panel = el("panel"), titleEl = el("title"), raisedEl = el("raised"),
      goalEl = el("goal"), fillEl = el("fill"), pctEl = el("pct"),
      sessionRaisedEl = el("sessionRaised"), donationsEl = el("donations"),
      alertsEl = el("alerts"), milestoneEl = el("milestone"), statusEl = el("status");

  var goalAmount = 0;
  var seenMilestones = {};
  var stream = null;
  var refreshTimer = null;
  var lastPrivacy = "";

  function money(v) {
    if (v === null || v === undefined) return "GH₵ —";
    try { return "GH₵ " + Number(v).toLocaleString("en-GH"); }
    catch (e) { return "GH₵ " + v; }
  }

  function setStatus(msg, isError) {
    statusEl.textContent = msg;
    statusEl.className = "status show" + (isError ? " err" : "");
    if (!isError) {
      clearTimeout(setStatus._t);
      setStatus._t = setTimeout(function () { statusEl.className = "status"; }, 2500);
    }
  }

  function renderGoal(raised, goal) {
    if (typeof goal === "number" && goal > 0) goalAmount = goal;
    raisedEl.textContent = money(raised);
    goalEl.textContent = money(goalAmount);
    var pct = goalAmount > 0 ? Math.min(100, Math.round((Number(raised) / goalAmount) * 100)) : 0;
    fillEl.style.transform = "scaleX(" + (pct / 100) + ")";
    pctEl.textContent = pct + "%";
    var bar = fillEl.parentNode;
    bar.setAttribute("role", "progressbar");
    bar.setAttribute("aria-valuenow", String(pct));
    bar.setAttribute("aria-valuemin", "0");
    bar.setAttribute("aria-valuemax", "100");
  }

  function renderInitial(v) {
    if (v.status === "ended") {
      if (stream) stream.close();
      clearInterval(refreshTimer);
      alertsEl.textContent = "";
      setStatus("This broadcast has ended", true);
    }
    var privacy = JSON.stringify(v.config || {});
    if (lastPrivacy && lastPrivacy !== privacy) alertsEl.textContent = "";
    lastPrivacy = privacy;
    panel.hidden = false;
    if (v.title) titleEl.textContent = v.title;
    renderGoal(v.campaignRaisedAmount, v.campaignGoalAmount);
    if (v.totals) {
      sessionRaisedEl.textContent = v.totals.amountRaised === null ? "hidden" : money(v.totals.amountRaised);
      donationsEl.textContent = String(v.totals.successfulDonations || 0);
    }
  }

  function pushAlert(d) {
    var node = document.createElement("div");
    node.className = "alert";
    var who = document.createElement("div");
    who.className = "who";
    var name = document.createElement("span");
    name.textContent = d.name || "Someone";
    who.appendChild(name);
    if (d.amount !== null && d.amount !== undefined) {
      var amt = document.createElement("span");
      amt.className = "amt";
      amt.textContent = " · " + money(d.amount);
      who.appendChild(amt);
    }
    node.appendChild(who);
    if (d.message) {
      var msg = document.createElement("div");
      msg.className = "msg";
      msg.textContent = d.message;              // textContent — no HTML injection
      node.appendChild(msg);
    }
    alertsEl.appendChild(node);
    // Cap the visible stack.
    while (alertsEl.children.length > 4) alertsEl.removeChild(alertsEl.firstChild);
    setTimeout(function () {
      node.className = "alert leaving";
      setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, 480);
    }, 6500);
  }

  function celebrate(percent) {
    if (seenMilestones[percent]) return;
    seenMilestones[percent] = true;
    milestoneEl.textContent = percent >= 100 ? "🎉 Goal reached!" : "🎉 " + percent + "% of goal!";
    milestoneEl.className = "milestone show";
    setTimeout(function () { milestoneEl.className = "milestone hide"; }, 3600);
  }

  function loadInitial() {
    fetch(sessionBase + "/overlay" + qs, { headers: { Accept: "application/json" } })
      .then(function (r) {
        if (r.status === 403) { if (stream) stream.close(); clearInterval(refreshTimer); alertsEl.textContent = ""; throw new Error("This overlay link is invalid or was revoked."); }
        if (r.status === 404) throw new Error("Live session not found.");
        if (!r.ok) throw new Error("Could not load overlay (" + r.status + ").");
        return r.json();
      })
      .then(function (body) { renderInitial(body.data || body); })
      .catch(function (e) { setStatus(e.message || "Overlay error", true); panel.hidden = false; });
  }

  function connect() {
    var es = stream = new EventSource(sessionBase + "/events" + qs);
    es.addEventListener("open", function () { setStatus("Live"); });
    es.addEventListener("donation", function (ev) {
      try { pushAlert(JSON.parse(ev.data)); } catch (e) {}
    });
    es.addEventListener("total", function (ev) {
      try {
        var d = JSON.parse(ev.data);
        renderGoal(d.raisedAmount, d.goalAmount);
        if (d.sessionAmountRaised !== undefined) {
          sessionRaisedEl.textContent = d.sessionAmountRaised === null ? "hidden" : money(d.sessionAmountRaised);
        }
        // Authoritative donation count is refreshed from the overlay snapshot.
      } catch (e) {}
    });
    es.addEventListener("milestone", function (ev) {
      try { celebrate(JSON.parse(ev.data).percent); } catch (e) {}
    });
    es.onerror = function () { setStatus("Reconnecting…", true); };
  }

  if (params.get("preview") === "1") {
    var amount = Number(params.get("raised"));
    var goal = Number(params.get("goal"));
    renderInitial({ title: params.get("title") || "Your live fundraiser", campaignRaisedAmount: Number.isFinite(amount) ? Math.max(0, amount) : 0, campaignGoalAmount: Number.isFinite(goal) ? Math.max(0, goal) : 0, totals: { amountRaised: 0, successfulDonations: 0 } });
  } else {
    loadInitial();
    connect();
    refreshTimer = setInterval(loadInitial, 10000);
  }
})();
</script>
</body>
</html>`;
