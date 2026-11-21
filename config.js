// Everything you would normally change lives in this file.
// Each persona is a separate ElevenLabs agent. Each agent has
// English as its default language plus Urdu, Punjabi and Pashto presets.
window.VOICE_DEMO_CONFIG = {
  appTitle: "Pakistani Multilingual Voice Agent",

  // Every call starts (and greets) in this language. After that the agent
  // follows whatever language the caller speaks. A link can override it
  // with ?lang=ur, for example index.html?lang=ur#doctor
  defaultLanguage: "en",

  // "webrtc" gives better audio (echo cancellation). The app falls back
  // to "websocket" automatically if WebRTC fails to connect.
  connectionType: "webrtc",

  // On Vercel, the page gets a short-lived token from this serverless
  // function (api/conversation-token.js), so the ElevenLabs API key stays
  // on the server. Where the function doesn't exist (a plain local static
  // server returns 404), the page connects with the public agent ID instead.
  // Set to null to always use the public agent ID.
  tokenEndpoint: "/api/conversation-token",

  languages: [
    { code: "en", label: "English", native: "English", dir: "ltr" },
    { code: "ur", label: "Urdu", native: "اردو", dir: "rtl" },
    { code: "pa", label: "Punjabi", native: "پنجابی", dir: "rtl" },
    { code: "ps", label: "Pashto", native: "پښتو", dir: "rtl" },
  ],

  personas: [
    {
      id: "receptionist",
      title: "Receptionist",
      org: "Zenith Business Centre",
      description: "Front desk: answers questions, books meeting rooms and takes messages.",
      agentName: { en: "Sana", ur: "ثنا", pa: "ثنا", ps: "ثنا" },
      accent: "#0891b2",
      agentId: "agent_4901m7yk5053fytbxeghpz9j4p9z",
    },
    {
      id: "doctor",
      title: "Doctor's Clinic",
      org: "City Care Clinic",
      description: "Books patient appointments and points callers to the right specialist. Never diagnoses.",
      agentName: { en: "Ayesha", ur: "عائشہ", pa: "عائشہ", ps: "عایشه" },
      accent: "#059669",
      agentId: "agent_7001m7yk9cwtezjb5mvc90svv3j8",
    },
    {
      id: "lawyer",
      title: "Law Firm",
      org: "Qanoon Law Associates",
      description: "Client intake: understands the legal matter and books a consultation. Never gives legal advice.",
      agentName: { en: "Ahmed", ur: "احمد", pa: "احمد", ps: "احمد" },
      accent: "#7c3aed",
      agentId: "agent_3901m7yk9mkjf4xr30h12av06y5t",
    },
    {
      id: "sales",
      title: "Business Sales",
      org: "Nexa Solutions",
      description: "Qualifies leads, handles objections and books a demo meeting.",
      agentName: { en: "Bilal", ur: "بلال", pa: "بلال", ps: "بلال" },
      accent: "#ea580c",
      agentId: "agent_8801m7yk9pn6e79taqrj9qv03agk",
    },
  ],
};
