(function () {
  "use strict";

  var cfg = window.VOICE_DEMO_CONFIG;
  var SDK = window.ElevenLabsClient;

  var ICONS = {
    receptionist:
      '<svg viewBox="0 0 24 24"><path d="M3 18h18"/><path d="M5 18a7 7 0 0 1 14 0"/><path d="M12 11V9"/><path d="M10 9h4"/></svg>',
    doctor:
      '<svg viewBox="0 0 24 24"><path d="M6 3v6a4 4 0 0 0 8 0V3"/><path d="M10 13v2a5 5 0 0 0 10 0v-2"/><circle cx="20" cy="11" r="2"/></svg>',
    lawyer:
      '<svg viewBox="0 0 24 24"><path d="M12 3v18"/><path d="M7 21h10"/><path d="M4 7h16"/><path d="M4 7l-2.5 6a3 3 0 0 0 5 0L4 7"/><path d="M20 7l-2.5 6a3 3 0 0 0 5 0L20 7"/></svg>',
    sales: '<svg viewBox="0 0 24 24"><path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/></svg>',
    _default:
      '<svg viewBox="0 0 24 24"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12Z"/></svg>',
  };
  var ARROW = '<svg viewBox="0 0 24 24"><path d="M5 12h14"/><path d="M13 6l6 6-6 6"/></svg>';

  // Letters that only Pashto uses. Text with them gets a Naskh font;
  // other Arabic-script text (Urdu, Shahmukhi Punjabi) gets Nastaliq.
  var PASHTO_ONLY = /[ټځڅډړږښګڼۍې]/;
  var ARABIC_SCRIPT = /[؀-ۿ]/;

  var $ = function (id) { return document.getElementById(id); };
  var els = {
    title: $("app-title"),
    homeView: $("home-view"),
    agentView: $("agent-view"),
    personas: $("personas"),
    backBtn: $("back-btn"),
    orb: $("orb"),
    agentName: $("agent-name"),
    agentOrg: $("agent-org"),
    statusDot: $("status-dot"),
    statusText: $("status-text"),
    timer: $("timer"),
    langPill: $("lang-pill"),
    callBtn: $("call-btn"),
    callBtnLabel: $("call-btn-label"),
    muteBtn: $("mute-btn"),
    error: $("error"),
    transcript: $("transcript"),
    clearBtn: $("clear-btn"),
  };

  // Every call starts in this language; the agent then follows the caller.
  var startLang = cfg.defaultLanguage;

  var state = {
    view: "home", // home | agent
    personaId: null,
    lang: startLang,
    conversation: null,
    phase: "idle", // idle | connecting | live
    mode: "listening",
    gen: 0, // bumps whenever a call is started or ended; stale callbacks are ignored
    attempt: 0, // bumps for every connection attempt (WebRTC, then WebSocket fallback)
    muted: false,
    startedAt: 0,
    timerId: 0,
    raf: 0,
  };

  // ---------- helpers ----------

  function findPersona(id) {
    return cfg.personas.find(function (p) { return p.id === id; }) || null;
  }
  function persona() {
    return findPersona(state.personaId) || cfg.personas[0];
  }
  function language() {
    return cfg.languages.find(function (l) { return l.code === state.lang; }) || cfg.languages[0];
  }
  function agentDisplayName(p, lang) {
    var n = p.agentName || {};
    return n[lang] || n.en || p.title;
  }

  function showError(msg) {
    els.error.textContent = msg;
    els.error.hidden = false;
  }
  function hideError() {
    els.error.hidden = true;
    els.error.textContent = "";
  }

  // ---------- home ----------

  function renderPersonas() {
    els.personas.innerHTML = "";
    cfg.personas.forEach(function (p) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "persona";
      b.style.setProperty("--c", p.accent);

      var top = document.createElement("div");
      top.className = "persona-top";
      var icon = document.createElement("span");
      icon.className = "persona-icon";
      icon.innerHTML = ICONS[p.id] || ICONS._default;
      var names = document.createElement("div");
      var t = document.createElement("div");
      t.className = "persona-title";
      t.textContent = p.title;
      var o = document.createElement("div");
      o.className = "persona-org";
      o.textContent = p.org;
      names.append(t, o);
      top.append(icon, names);

      var d = document.createElement("p");
      d.className = "persona-desc";
      d.textContent = p.description;

      var cta = document.createElement("span");
      cta.className = "persona-cta";
      cta.textContent = "Talk to " + agentDisplayName(p, "en");
      cta.insertAdjacentHTML("beforeend", ARROW);

      b.append(top, d, cta);
      b.addEventListener("click", function () {
        history.pushState({ fromHome: true }, "", "#" + p.id);
        enterAgent(p.id, true); // the click is the user gesture the mic needs
      });
      els.personas.appendChild(b);
    });
  }

  function showHome() {
    state.view = "home";
    state.personaId = null;
    els.agentView.hidden = true;
    els.homeView.hidden = false;
    document.documentElement.style.removeProperty("--accent");
    document.title = cfg.appTitle || "Voice Agent";
  }

  // ---------- agent view ----------

  function renderAgentHeader() {
    var p = persona();
    var l = language();
    document.documentElement.style.setProperty("--accent", p.accent);
    // The name stays in English; the pill below shows the current language.
    els.agentName.textContent = agentDisplayName(p, "en");
    els.agentOrg.textContent = p.title + " · " + p.org;
    document.title = agentDisplayName(p, "en") + " · " + p.title;

    els.langPill.innerHTML = "";
    els.langPill.append("Speaking ");
    var strong = document.createElement("strong");
    strong.textContent = l.label;
    els.langPill.append(strong);
    if (l.native !== l.label) {
      els.langPill.append(" · ");
      var native = document.createElement("bdi"); // keeps RTL text from reordering the pill
      native.className = "native";
      native.lang = l.code;
      native.textContent = l.native;
      els.langPill.append(native);
    }
  }

  function enterAgent(id, autoStart) {
    state.view = "agent";
    state.personaId = id;
    state.lang = startLang;
    state.startedAt = 0;
    els.homeView.hidden = true;
    els.agentView.hidden = false;
    hideError();
    resetTranscript();
    renderAgentHeader();
    setPhase("idle");
    window.scrollTo(0, 0);
    if (autoStart) startCall();
  }

  function setPhase(phase) {
    state.phase = phase;
    var name = agentDisplayName(persona(), state.lang);

    els.orb.classList.toggle("idle", phase === "idle");
    els.orb.classList.toggle("connecting", phase === "connecting");
    els.orb.style.removeProperty("--s");

    els.statusDot.className = "status-dot" + (phase === "live" ? " live" : phase === "connecting" ? " busy" : "");
    els.callBtn.classList.toggle("end", phase !== "idle");
    els.muteBtn.hidden = phase !== "live";

    if (phase === "idle") {
      els.callBtnLabel.textContent = state.startedAt ? "Call again" : "Start call";
      els.statusText.textContent = "Ready";
      els.timer.hidden = true;
      stopVisualizer();
    } else if (phase === "connecting") {
      els.callBtnLabel.textContent = "Cancel";
      els.statusText.textContent = "Connecting to " + name + "…";
    } else {
      els.callBtnLabel.textContent = "End call";
      updateModeText();
      startVisualizer();
    }
  }

  function updateModeText() {
    if (state.phase !== "live") return;
    var name = agentDisplayName(persona(), state.lang);
    els.statusText.textContent = state.mode === "speaking" ? name + " is speaking" : "Listening…";
  }

  // ---------- transcript ----------

  function resetTranscript() {
    els.transcript.innerHTML = '<p class="empty">The conversation will appear here.</p>';
  }

  function ensureNotEmpty() {
    var empty = els.transcript.querySelector(".empty");
    if (empty) empty.remove();
  }

  function addSystem(text) {
    ensureNotEmpty();
    var el = document.createElement("div");
    el.className = "msg system";
    el.textContent = text;
    els.transcript.appendChild(el);
    els.transcript.scrollTop = els.transcript.scrollHeight;
  }

  function addMessage(m) {
    var role = m.role || (m.source === "ai" ? "agent" : "user");
    var raw = String(m.message || "");
    var text = (typeof SDK.stripAudioTags === "function" ? SDK.stripAudioTags(raw) : raw).trim();
    if (!text) return;

    ensureNotEmpty();
    var el = document.createElement("div");
    el.className = "msg " + (role === "user" ? "user" : "agent");
    el.dir = "auto";
    if (ARABIC_SCRIPT.test(text)) {
      el.classList.add("rtl-text");
      if (!PASHTO_ONLY.test(text)) el.classList.add("nastaliq");
    }
    el.textContent = text;
    els.transcript.appendChild(el);
    els.transcript.scrollTop = els.transcript.scrollHeight;
  }

  // ---------- timer + orb ----------

  function startTimer() {
    stopTimer();
    state.startedAt = Date.now();
    els.timer.textContent = "00:00";
    els.timer.hidden = false;
    state.timerId = setInterval(function () {
      var s = Math.floor((Date.now() - state.startedAt) / 1000);
      els.timer.textContent = String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
    }, 1000);
  }
  function stopTimer() {
    clearInterval(state.timerId);
    state.timerId = 0;
  }

  function startVisualizer() {
    if (state.raf) return;
    var tick = function () {
      var c = state.conversation;
      if (c && state.phase === "live") {
        var v = 0;
        try {
          v = state.mode === "speaking" ? c.getOutputVolume() : c.getInputVolume();
        } catch (e) { v = 0; }
        var s = 1 + Math.min(1, (v || 0) * 1.8) * 0.35;
        els.orb.style.setProperty("--s", s.toFixed(3));
      }
      state.raf = requestAnimationFrame(tick);
    };
    state.raf = requestAnimationFrame(tick);
  }
  function stopVisualizer() {
    cancelAnimationFrame(state.raf);
    state.raf = 0;
  }

  // ---------- calls ----------

  async function ensureMic() {
    if (!window.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("insecure");
    }
    var stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(function (t) { t.stop(); });
  }

  var TOKEN_ERRORS = {
    missing_api_key: "ELEVENLABS_API_KEY is not set in Vercel (Settings → Environment Variables), or the site was not redeployed after adding it.",
    unknown_agent: "This agent ID is not in the allowed list in api/conversation-token.js.",
    elevenlabs_error: "ElevenLabs rejected the API key. Check the key and that it has access to ElevenLabs Agents.",
  };

  // Asks our server function for a short-lived credential.
  // Returns null when there is no server function (local static hosting),
  // which means "connect with the public agent ID".
  async function getCredentials(agentId, connectionType) {
    if (!cfg.tokenEndpoint) return null;
    var r;
    try {
      r = await fetch(
        cfg.tokenEndpoint + "?agent_id=" + encodeURIComponent(agentId) + "&type=" + connectionType,
        { cache: "no-store" }
      );
    } catch (e) {
      return null;
    }
    if (r.status === 404) return null;
    var data = await r.json().catch(function () { return {}; });
    if (!r.ok) {
      var code = data && data.error;
      throw new Error(TOKEN_ERRORS[code] || "Token server error (" + (code || r.status) + ")");
    }
    return connectionType === "webrtc" ? { conversationToken: data.token } : { signedUrl: data.signedUrl };
  }

  async function openSession(p, myGen, connectionType) {
    var myAttempt = ++state.attempt;
    var current = function () { return myGen === state.gen && myAttempt === state.attempt; };
    var guard = function (fn) {
      return function () { if (current()) fn.apply(null, arguments); };
    };

    var creds = await getCredentials(p.agentId, connectionType);
    var auth = creds || { agentId: p.agentId };

    return SDK.Conversation.startSession({
      agentId: auth.agentId,
      conversationToken: auth.conversationToken,
      signedUrl: auth.signedUrl,
      connectionType: connectionType,
      overrides: { agent: { language: state.lang } },
      onConnect: guard(function () {
        setPhase("live");
        startTimer();
      }),
      onDisconnect: guard(function (details) { handleEnded(details); }),
      onMessage: guard(addMessage),
      onModeChange: guard(function (e) {
        state.mode = e && e.mode === "speaking" ? "speaking" : "listening";
        updateModeText();
      }),
      onAgentToolResponse: guard(handleToolResponse),
      onError: guard(function (message) {
        showError("Voice error: " + (message || "unknown problem"));
      }),
    });
  }

  async function startCall() {
    var myGen = ++state.gen;
    var p = persona();

    hideError();
    if (!SDK || !SDK.Conversation) {
      showError("The voice library did not load. Check that vendor/elevenlabs-client-1.37.1.js is deployed.");
      return;
    }
    if (!p.agentId) {
      showError("No ElevenLabs agent ID is set for \"" + p.title + "\" in config.js.");
      return;
    }

    state.lang = startLang;
    state.mode = "listening";
    state.muted = false;
    els.muteBtn.setAttribute("aria-pressed", "false");
    els.muteBtn.textContent = "Mute";
    renderAgentHeader();
    resetTranscript();
    addSystem("Calling " + agentDisplayName(p, "en") + " · " + p.title);
    setPhase("connecting");

    try {
      await ensureMic();
    } catch (e) {
      if (myGen !== state.gen) return;
      setPhase("idle");
      showError(
        e && e.message === "insecure"
          ? "Microphone needs a secure page. Open this site over https:// (or on localhost)."
          : "Microphone permission was blocked. Allow microphone access in the browser and try again."
      );
      return;
    }
    if (myGen !== state.gen) return;

    var preferred = cfg.connectionType || "webrtc";
    var conv = null;
    var lastErr = null;
    try {
      conv = await openSession(p, myGen, preferred);
    } catch (err) {
      lastErr = err;
      if (myGen === state.gen && preferred === "webrtc") {
        try {
          conv = await openSession(p, myGen, "websocket");
        } catch (err2) {
          lastErr = err2;
        }
      }
    }

    if (myGen !== state.gen) {
      // The user cancelled or left while we were connecting.
      if (conv) conv.endSession().catch(function () {});
      return;
    }
    if (!conv) {
      setPhase("idle");
      var reason = String((lastErr && lastErr.message) || "connection failed").replace(/\.+$/, "");
      showError("Could not start the call: " + reason + ".");
      return;
    }
    state.conversation = conv;
  }

  // The agent switched language by itself (language_detection tool).
  // Only the "full payload" event carries the new language code.
  function handleToolResponse(p) {
    if (!p || p.tool_name !== "language_detection" || p.is_error) return;
    if (typeof p.full_tool_result !== "string") return;
    var match = p.full_tool_result.match(/"language"\s*:\s*"([a-zA-Z-]+)"/);
    var code = match && match[1].toLowerCase();
    if (!code || code === state.lang) return;
    if (!cfg.languages.some(function (l) { return l.code === code; })) return;
    state.lang = code; // update the screen only; the call keeps running
    renderAgentHeader();
    updateModeText();
    addSystem("Switched to " + language().label);
  }

  function handleEnded(details) {
    state.conversation = null;
    stopTimer();
    setPhase("idle");
    if (details && details.reason === "error") {
      showError("The call dropped: " + (details.message || "connection problem") + ".");
    }
    addSystem("Call ended");
  }

  async function endCall() {
    state.gen++; // ignore any callbacks from the call being closed
    var conv = state.conversation;
    var wasActive = state.phase !== "idle";
    state.conversation = null;
    stopTimer();
    if (state.view === "agent") setPhase("idle");
    else stopVisualizer();
    if (conv) {
      try { await conv.endSession(); } catch (e) { /* already closed */ }
    }
    if (wasActive && state.view === "agent") addSystem("Call ended");
  }

  // ---------- routing (#receptionist, #doctor, ...) ----------

  function idFromHash() {
    return decodeURIComponent(location.hash.replace(/^#\/?/, ""));
  }

  function route() {
    var id = idFromHash();
    if (findPersona(id)) {
      if (state.view !== "agent" || state.personaId !== id) {
        endCall();
        enterAgent(id, false); // opened from a link or history: wait for a click
      }
    } else {
      endCall();
      showHome();
    }
  }

  function goHome() {
    if (history.state && history.state.fromHome) {
      history.back(); // fires popstate, which ends the call and shows home
    } else {
      history.pushState(null, "", location.pathname + location.search);
      route();
    }
  }

  // ---------- wiring ----------

  els.callBtn.addEventListener("click", function () {
    if (state.phase === "idle") startCall();
    else endCall();
  });

  els.muteBtn.addEventListener("click", function () {
    if (!state.conversation) return;
    state.muted = !state.muted;
    try { state.conversation.setMicMuted(state.muted); } catch (e) { /* ignore */ }
    els.muteBtn.setAttribute("aria-pressed", String(state.muted));
    els.muteBtn.textContent = state.muted ? "Unmute" : "Mute";
  });

  els.clearBtn.addEventListener("click", resetTranscript);
  els.backBtn.addEventListener("click", goHome);
  window.addEventListener("popstate", route);
  window.addEventListener("pagehide", function () {
    if (state.conversation) state.conversation.endSession().catch(function () {});
  });

  // ---------- boot ----------

  (function boot() {
    var q = new URLSearchParams(location.search);
    var l = q.get("lang");
    if (l && cfg.languages.some(function (x) { return x.code === l; })) startLang = l;
    // Old links used ?persona=doctor; turn them into #doctor.
    var legacy = q.get("persona");
    if (!location.hash && legacy && findPersona(legacy)) {
      history.replaceState(null, "", location.pathname + "#" + legacy);
    }

    if (cfg.appTitle) els.title.textContent = cfg.appTitle;
    renderPersonas();
    route();
    if (!SDK || !SDK.Conversation) {
      showError("The voice library did not load. Check that vendor/elevenlabs-client-1.37.1.js is deployed.");
    }
  })();
})();
