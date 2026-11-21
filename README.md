# Pakistani Multilingual Voice Agent

One web page, four agent versions (Receptionist, Doctor's Clinic, Law Firm, Business Sales), four languages (English, Urdu, Punjabi, Pashto).

The home screen shows the four agents. Clicking one opens that agent's own call screen and starts the call right away. "All agents" (or the browser's Back button) ends the call and returns home. There is no language picker: every call starts in English, then the agent follows whatever language the caller speaks.

It is a static site with one small serverless function and no build step. Voice, speech recognition and the LLM run on ElevenLabs Agents.

## How it works

| Version | ElevenLabs agent | Agent name |
|---|---|---|
| Receptionist (Zenith Business Centre) | `agent_3801m7yrjctqf6p92swrf8rm50dq` | Sana (voice: Eman) |
| Doctor's Clinic (City Care Clinic) | `agent_0701m7yrjestfja89s7f60yy4b9d` | Ayesha (voice: Huda) |
| Law Firm (Qanoon Law Associates) | `agent_1001m7yrjgjsfd7at8dkv77ztcb6` | Ahmed (voice: Asad Raza) |
| Business Sales (Nexa Solutions) | `agent_7201m7yrjjdcek5b5jw16t5d3t91` | Bilal (voice: Salman Ahmad) |

- Each agent has English as its default language and **language presets** for `ur`, `pa` and `ps`, each with a translated greeting.
- Each persona uses **one voice for all four languages**, so the voice does not change when the language switches.
- The page passes the starting language when it starts a call (`overrides.agent.language`, English by default). Each agent allows only that one override.
- **Automatic switching mid-call:** the agent follows the language of the caller's latest sentence, in any direction and as often as the caller switches, without being asked. This comes from the built-in `language_detection` tool, a stricter tool description, and language rules in each prompt. Single borrowed words, names and numbers do not trigger a switch. Urdu transcribed in Hindi script is treated as Urdu.
- When the agent switches, the "Speaking …" label on the call screen updates and the transcript shows a "Switched to …" line. For this, the agents send the `agent_tool_response_full_payload` client event.
- LLM: `gemini-3.5-flash` with minimal reasoning, for low latency. Timezone: `Asia/Karachi`.
- The ElevenLabs agent names start with "PK Voice Demo" and carry the tag `pk-voice-demo`.

Files:

```
index.html                  page layout
style.css                   styling
app.js                      call logic (start/end, switching, transcript, mic, orb)
config.js                   personas, agent IDs, languages  <- edit this one
api/conversation-token.js   Vercel function: turns the secret API key into a short-lived call token
vercel.json                 Vercel settings (function timeout, security headers, caching)
vendor/                     ElevenLabs browser SDK 1.37.1 (MIT), bundled so no CDN is needed
.env.example                name of the one secret (the real value goes in Vercel, never in git)
```

**How a call is authorised.** On Vercel, the page asks `/api/conversation-token` for a short-lived token. The function uses `ELEVENLABS_API_KEY`, which is stored only in Vercel, and gives tokens only for the four agents listed in it. The key never reaches the browser or GitHub. On a plain local server the function does not exist, so the page connects with the public agent ID instead.

## Run locally

The microphone only works on `https://` or `localhost`.

```bash
npx serve .
# open http://localhost:3000
```

Direct link to one agent: `#doctor` (also `#receptionist`, `#lawyer`, `#sales`). A direct link opens the call screen but waits for "Start call", because browsers need a click before using the microphone. To start in another language, add `?lang=ur` (or `pa`, `ps`), for example `index.html?lang=ur#doctor`. To change the starting language for everyone, edit `defaultLanguage` in `config.js`.

## Deploy on Vercel through GitHub

**1. Create an ElevenLabs API key**

ElevenLabs → **Developers → API Keys → Create key**. Turn on **Restrict key** and allow only **ElevenLabs Agents**. If you can, set a credit limit on the key as a safety cap. Copy the key; you will paste it only into Vercel. Never put it in a file, a commit or a chat.

**2. Put the code on GitHub**

The code is in `github.com/21Sameer/voice-agent`, branch `master`. To publish your own changes:

```bash
git add -A
git commit -m "Describe the change"
git push
```

**3. Import into Vercel**

vercel.com → **Add New → Project** → pick the GitHub repo.
- Framework Preset: **Other**. Leave Build Command and Output Directory empty.
- **Environment Variables:** add `ELEVENLABS_API_KEY` with the key from step 1.
- Click **Deploy**.

If you add the key after the first deploy, open **Deployments** and **Redeploy**: environment variables only apply to new deployments.

**4. Test**

Open the `*.vercel.app` URL and make a short call. If the page shows "ELEVENLABS_API_KEY is not set", check step 3. If it shows "ElevenLabs rejected the API key", check the key and its Agents permission.

After this, every `git push` to `master` redeploys automatically.

## After deploying: protect your credits

1. **Make the agents private.** Once calls work on the Vercel URL, turn on authentication for each agent in ElevenLabs (agent → **Security** → enable authentication). Then only tokens from your Vercel function can start calls. A copied agent ID is no longer enough. Local testing with a plain static server stops working after this; use `vercel dev` with a `.env.local` file instead.
2. **Allowlist your domain** under each agent's **Security** settings (for example `your-app.vercel.app`).
3. Calls are capped at 10 minutes (the default). Change it under the agent's **Advanced** settings if you need to.
4. The token endpoint itself is public. Other websites can't use it from a browser, but a script could. For a public launch, add rate limiting (for example Vercel Firewall rules) and keep the credit limit on the API key.

## Agents as code

`scripts/setup-agents.mjs` holds the full definition of the four agents: prompts, greetings, voices, language presets, auto-switching and LLM settings. Running it creates them in the ElevenLabs account that owns the API key, or updates them if they already exist (matched by name). It then writes their IDs into `config.js`, `api/conversation-token.js` and this README.

```bash
# .env.local must contain ELEVENLABS_API_KEY=... (git-ignored)
node scripts/setup-agents.mjs
```

- The key needs **ElevenLabs Agents** write access.
- The four voices must already be in that account's **My Voices** (Voice Library → Add to My Voices): Eman, Huda, Asad Raza, Salman Ahmad. The script stops before creating anything if one is missing.
- Running the script overwrites changes made to these agents in the ElevenLabs dashboard. Make lasting changes in the script, or stop using the script once you edit in the dashboard.

## Customising

- **Business details, prices, timings:** edit the prompt in `scripts/setup-agents.mjs` and run it again, or edit the agent in ElevenLabs. Everything marked "demo data" is a placeholder.
- **Voices:** agent, then **Voice**. That one voice speaks all four languages. Avoid setting a different voice per language preset: the voice would change mid-call whenever the language switches, which confuses callers. Some Voice Library voices are not usable on every plan. If a call log in ElevenLabs shows "Voice … is unavailable. Fell back to default voice", pick another voice.
- **Add a fifth version:** duplicate an agent in ElevenLabs and change its prompt, presets and voice. Add an entry to `personas` in `config.js` with the new `agentId`. Also add the ID to `DEFAULT_AGENT_IDS` in `api/conversation-token.js`, or the token function will refuse it.

## Known limits

- The agents collect booking and lead details but do not save them anywhere yet. They tell callers the team will confirm. Next step: a webhook or tool that writes to Google Sheets, a CRM or a calendar, plus data collection fields so every call's name, phone number and reason show up in the ElevenLabs dashboard.
- Punjabi replies are written in Shahmukhi. Listen to how each voice pronounces Punjabi and Pashto, and have a native speaker review the Pashto and Punjabi greetings.
- Voice calls use credits quickly. On the free plan, a 3-minute call used about 3,300 credits. Use text mode or short calls for routine testing.
