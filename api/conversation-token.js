// Vercel serverless function: GET /api/conversation-token?agent_id=...&type=webrtc|websocket
//
// Gives the browser a short-lived credential for ONE of our agents, so the
// ElevenLabs API key never leaves the server. Set ELEVENLABS_API_KEY in
// Vercel: Project → Settings → Environment Variables.
//
// Only the agents listed below get credentials, so the key can't be used to
// start calls with any other agent in the ElevenLabs account.
// When you add a persona in config.js, add its agent ID here too
// (or set ALLOWED_AGENT_IDS in Vercel as a comma-separated list).

const DEFAULT_AGENT_IDS = [
  "agent_3801m7yrjctqf6p92swrf8rm50dq", // Receptionist
  "agent_0701m7yrjestfja89s7f60yy4b9d", // Doctor's Clinic
  "agent_1001m7yrjgjsfd7at8dkv77ztcb6", // Law Firm
  "agent_7201m7yrjjdcek5b5jw16t5d3t91", // Business Sales
];

const API_BASE = "https://api.elevenlabs.io/v1/convai/conversation";

function allowedAgentIds() {
  const fromEnv = (process.env.ALLOWED_AGENT_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return new Set(fromEnv.length ? fromEnv : DEFAULT_AGENT_IDS);
}

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return send(res, 405, { error: "method_not_allowed" });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return send(res, 500, { error: "missing_api_key" });

  const url = new URL(req.url, "http://localhost");
  const agentId = url.searchParams.get("agent_id") || "";
  const type = url.searchParams.get("type") === "websocket" ? "websocket" : "webrtc";

  if (!allowedAgentIds().has(agentId)) return send(res, 400, { error: "unknown_agent" });

  const endpoint =
    type === "webrtc"
      ? `${API_BASE}/token?agent_id=${encodeURIComponent(agentId)}`
      : `${API_BASE}/get-signed-url?agent_id=${encodeURIComponent(agentId)}`;

  let upstream;
  try {
    upstream = await fetch(endpoint, { headers: { "xi-api-key": apiKey } });
  } catch (e) {
    return send(res, 502, { error: "elevenlabs_unreachable" });
  }
  if (!upstream.ok) {
    // 401/403 usually means a wrong key or a key without Agents permission.
    return send(res, 502, { error: "elevenlabs_error", status: upstream.status });
  }

  const data = await upstream.json().catch(() => ({}));
  if (type === "webrtc") {
    if (!data.token) return send(res, 502, { error: "no_token_in_response" });
    return send(res, 200, { token: data.token });
  }
  if (!data.signed_url) return send(res, 502, { error: "no_signed_url_in_response" });
  return send(res, 200, { signedUrl: data.signed_url });
};
