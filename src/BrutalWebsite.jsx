import { useState, useEffect } from "react";

const C = {
  forest:    "#0d2119",
  forestMid: "#132a20",
  forestCard:"#182f25",
  coral:     "#ff5230",
  coralDark: "#c83a1e",
  coralPale: "#ff7a5a",
  cream:     "#fbf4ec",
  creamDim:  "#b8ac9e",
  creamFaint:"#6a5e54",
};

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Bagel+Fat+One&family=Nunito:wght@400;600;700;800;900&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,400&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: ${C.forest}; color: ${C.cream}; font-family: 'DM Sans', sans-serif; }
  input, textarea { font-family: 'DM Sans', sans-serif; }
  input:focus, textarea:focus { outline: none; border-color: ${C.coral} !important; }
  @keyframes spin    { to { transform: rotate(360deg); } }
  @keyframes fadeUp  { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
  @keyframes popIn   { from { opacity:0; transform:scale(.65) rotate(-6deg); } to { opacity:1; transform:scale(1) rotate(-2deg); } }
  @keyframes marquee { from { transform:translateX(0); } to { transform:translateX(-50%); } }
  @keyframes breathe { 0%,100% { opacity:.15; } 50% { opacity:.4; } }
  @keyframes pulse   { 0%,100% { opacity:1; } 50% { opacity:.3; } }
  .fade  { animation: fadeUp .4s ease both; }
  .pop   { animation: popIn .8s cubic-bezier(.34,1.56,.64,1) both; }
  ::-webkit-scrollbar { width:3px; } ::-webkit-scrollbar-thumb { background:#2a3d32; border-radius:2px; }
`;

const SEV = {
  critical: { color: C.coral,    bg: "rgba(255,82,48,.08)",  border: "rgba(255,82,48,.2)",  label: "Critical" },
  moderate: { color: "#f5a623",  bg: "rgba(245,166,35,.07)", border: "rgba(245,166,35,.2)", label: "Moderate" },
  minor:    { color: "#22c55e",  bg: "rgba(34,197,94,.06)",  border: "rgba(34,197,94,.18)", label: "Minor"    },
};

function Badge({ sev }) {
  const s = SEV[sev] || SEV.minor;
  return (
    <span style={{ display:"inline-block", padding:"3px 10px", borderRadius:20, fontSize:9,
      fontFamily:"'Nunito',sans-serif", fontWeight:800, letterSpacing:"2px", textTransform:"uppercase",
      color:s.color, background:s.bg, border:`1px solid ${s.border}`, flexShrink:0 }}>
      {s.label}
    </span>
  );
}

function Spinner() {
  return <div style={{ width:18, height:18, border:`2px solid rgba(255,255,255,.1)`,
    borderTop:`2px solid ${C.coral}`, borderRadius:"50%", animation:"spin .8s linear infinite", flexShrink:0 }} />;
}

function useTimer(running) {
  const [s, setS] = useState(0);
  useEffect(() => {
    if (!running) { setS(0); return; }
    setS(0);
    const iv = setInterval(() => setS(x => x+1), 1000);
    return () => clearInterval(iv);
  }, [running]);
  return s;
}

async function roast(url, product, audience, goal) {
  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), 35000);

  const prompt = `You are a senior UX designer and conversion specialist who has reviewed hundreds of landing pages. You are brutally honest. You do not soften feedback. You do not say "great job." You reference specific elements, not generic advice.

Review this landing page and provide a UX audit:

URL: ${url}
${product  ? `What it does: ${product}`   : ""}
${audience ? `Target audience: ${audience}` : ""}
${goal     ? `Desired action: ${goal}`     : ""}

Return ONLY valid JSON, no markdown, no explanation:
{
  "first_impression": "In one sentence: what does a stranger understand in the first 5 seconds?",
  "confusion": "In one sentence: what is the single most confusing thing they encounter immediately?",
  "whats_working": ["One specific thing that is genuinely effective on this page.", "A second specific thing that is working well — design, copy, structure, or trust signal."],
  "findings": [
    {
      "title": "short specific finding title",
      "severity": "critical",
      "description": "1-2 sentences. Specific. Reference actual page elements. No generic advice.",
      "fix": "One concrete action to fix this. Specific enough to act on today."
    }
  ],
  "rewrite": {
    "element": "what element (e.g. hero headline, main Call to Action (CTA))",
    "before": "the current weak copy — make it sound like typical vague startup speak",
    "after": "a sharper, clearer rewrite that speaks directly to the target user's pain"
  },
  "fix_first": "One sentence: the single highest-impact change they should make this week."
}

Rules: 3-5 findings. Severity must reflect the actual state of the page — do not default to one critical and the rest minor or moderate. A weak page like a generic lead gen tool with vague headlines, unanswered objections, and cluttered UI should return 2-3 criticals. Only assign minor if the issue genuinely has low conversion impact. Ask yourself: would this issue cause a first-time visitor to leave or not convert? If yes, it is critical. Distribute severity honestly per site, not by formula.

Do not be charitable. These are AI product founders who need the truth. If the headline is generic, say it is generic. If the value prop is unclear, say it is unclear. Do not soften findings to seem balanced. Be specific — mention what you see on the page. No "consider improving" — say exactly what to do.`;

  try {
    const res = await fetch("/api/messages", {
      method: "POST", signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 900,
        messages: [{ role: "user", content: prompt }]
      })
    });
    clearTimeout(to);
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);

    // Extract text from content blocks (may include tool_use blocks)
    const textBlock = data.content?.find(b => b.type === "text");
    if (!textBlock) throw new Error("No text response received.");
    const match = textBlock.text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Could not parse response.");
    return JSON.parse(match[0]);
  } catch(e) {
    clearTimeout(to);
    if (e.name === "AbortError") throw new Error("Took too long. Try again.");
    throw e;
  }
}

export default function BrutalWebsite() {
  const [step, setStep]       = useState("input"); // input | loading | results
  const [url, setUrl]         = useState("");
  const [product, setProduct] = useState("");
  const [audience, setAudience] = useState("");
  const [goal, setGoal]       = useState("");
  const [results, setResults] = useState(null);
  const [err, setErr]         = useState("");
  const [loading, setLoading] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [showExample, setShowExample] = useState(false);
  const elapsed = useTimer(loading);

  const run = async () => {
    if (!url.trim()) { setErr("Drop in a URL first."); return; }
    if (!url.startsWith("http")) { setErr("URL needs to start with https://"); return; }
    setErr(""); setLoading(true); setStep("loading");
    try {
      const data = await roast(url, product, audience, goal);
      setResults(data);
      setStep("results");
    } catch(e) {
      setErr(e.message || "Something went wrong. Try again.");
      setStep("input");
    } finally { setLoading(false); }
  };

  const reset = () => {
    setStep("input"); setUrl(""); setProduct(""); setAudience(""); setGoal("");
    setResults(null); setErr(""); setShowMore(false);
  };

  const st = {
    wrap:   { minHeight:"100vh", background:C.forest, paddingBottom:80, position:"relative" },
    inner:  { maxWidth:760, margin:"0 auto", padding:"0 24px" },

    // Logo
    logo: { fontFamily:"'Bagel Fat One',cursive", fontSize:28, color:C.coral, letterSpacing:3,
      textShadow:`0 3px 0 ${C.coralDark}, 0 5px 14px rgba(255,82,48,.2)`,
      display:"inline-block", transform:"rotate(-1.5deg)",
      filter:"url(#pill)" },

    // Wordmark hero
    wm: { fontFamily:"'Bagel Fat One',cursive", fontSize:"clamp(90px,17vw,165px)",
      color:C.coral, letterSpacing:10, lineHeight:.95, display:"block",
      textShadow:`0 3px 0 ${C.coralDark}, 0 6px 0 #8a2509, 0 10px 22px rgba(0,0,0,.4), 0 0 40px rgba(255,82,48,.1)`,
      filter:"url(#bubble)" },

    // Inputs
    inp: { width:"100%", background:"#0c1f15", border:`1.5px solid rgba(255,255,255,.07)`,
      borderRadius:10, padding:"13px 16px", color:C.cream, fontSize:14,
      transition:"border-color .2s" },
    ta: { width:"100%", background:"#0c1f15", border:`1.5px solid rgba(255,255,255,.07)`,
      borderRadius:10, padding:"13px 16px", color:C.cream, fontSize:13,
      resize:"vertical", lineHeight:1.65, transition:"border-color .2s" },

    // Buttons
    btnPrimary: { fontFamily:"'Nunito',sans-serif", fontWeight:800, fontSize:15,
      padding:"15px 32px", background:C.coral, color:C.forest,
      border:"none", borderRadius:60, cursor:"pointer", transition:"all .2s",
      boxShadow:`0 4px 0 ${C.coralDark}, 0 6px 20px rgba(255,82,48,.22)`,
      width:"100%", marginTop:8 },
    btnGhost: { fontFamily:"'Nunito',sans-serif", fontWeight:700, fontSize:13,
      padding:"10px 20px", background:"transparent", color:C.creamDim,
      border:`1.5px solid rgba(255,255,255,.1)`, borderRadius:40, cursor:"pointer", transition:"all .2s" },

    // Cards
    card: { background:C.forestMid, border:`1.5px solid rgba(255,255,255,.06)`,
      borderRadius:16, padding:"22px 24px", marginBottom:12 },

    // Labels
    lbl: { display:"block", fontFamily:"'Nunito',sans-serif", fontWeight:800, fontSize:10,
      letterSpacing:"2.5px", textTransform:"uppercase", color:C.creamFaint, marginBottom:8 },
    eyebrow: { fontFamily:"'Nunito',sans-serif", fontWeight:800, fontSize:10,
      letterSpacing:"3px", textTransform:"uppercase", color:C.coral },
    err: { background:"rgba(255,82,48,.08)", border:"1px solid rgba(255,82,48,.22)",
      borderRadius:10, padding:"12px 16px", fontSize:13, color:C.coral, marginBottom:18 },
  };

  return (
    <div style={st.wrap}>
      <style>{css}</style>

      {/* SVG filters */}
      <svg style={{position:"absolute",width:0,height:0,overflow:"hidden"}} aria-hidden="true">
        <defs>
          <filter id="bubble" x="-8%" y="-15%" width="116%" height="140%" colorInterpolationFilters="sRGB">
            <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur"/>
            <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -8" result="blob"/>
            <feComposite in="SourceGraphic" in2="blob" operator="atop"/>
          </filter>
          <filter id="pill" x="-5%" y="-20%" width="110%" height="150%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur"/>
            <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -6" result="blob"/>
            <feComposite in="SourceGraphic" in2="blob" operator="atop"/>
          </filter>
        </defs>
      </svg>

      {/* ── NAV ── */}
      <nav style={{ padding:"18px 28px", display:"flex", justifyContent:"space-between",
        alignItems:"center", borderBottom:`1px solid rgba(255,255,255,.04)` }}>
        <span style={st.logo}>BRUTAL</span>
        {step === "results" && (
          <button style={st.btnGhost} onClick={reset}>← New roast</button>
        )}
      </nav>

      {/* ══════════ INPUT ══════════ */}
      {step === "input" && (
        <>
        <div style={st.inner}>
          {/* Hero wordmark */}
          <div style={{ textAlign:"center", padding:"52px 0 40px", position:"relative", overflow:"hidden" }}>
            {/* Ambient blobs */}
            <div style={{ position:"absolute", width:500, height:500, background:C.coral,
              borderRadius:"50%", filter:"blur(100px)", opacity:.07, top:-200, right:-150, pointerEvents:"none" }} />
            <div style={{ position:"absolute", width:400, height:400, background:"#ff8040",
              borderRadius:"50%", filter:"blur(90px)", opacity:.06, bottom:-150, left:-100, pointerEvents:"none" }} />

            <div style={{ display:"inline-block" }} className="pop">
              <span style={st.wm}>BRUTAL</span>
            </div>

            <p className="fade" style={{ fontFamily:"'Nunito',sans-serif", fontWeight:900,
              fontSize:"clamp(18px,3vw,26px)", color:C.cream, marginTop:16, lineHeight:1.3,
              animationDelay:".3s" }}>
              Your landing page is losing people.<br/>Find out exactly why.
            </p>
            <p className="fade" style={{ fontSize:14, color:C.creamDim, marginTop:10,
              lineHeight:1.75, animationDelay:".5s" }}>
              Paste your URL. Get the honest critique your friends were too polite to give.
            </p>
          </div>

          {/* Form */}
          <div className="fade" style={{ animationDelay:".6s" }}>
            {err && <div style={st.err}>{err}</div>}

            <div style={st.card}>
              {/* URL — required */}
              <div style={{ marginBottom:20 }}>
                <label style={st.lbl}>Your URL *</label>
                <input style={st.inp} type="url" placeholder="https://yourproduct.com"
                  value={url} onChange={e => setUrl(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && run()} />
              </div>

              {/* Optional context toggle */}
              <button style={{ ...st.btnGhost, fontSize:12, marginBottom: showMore ? 20 : 0 }}
                onClick={() => setShowMore(s => !s)}>
                {showMore ? "▲ Hide context (optional)" : "▼ Add context for sharper results"}
              </button>

              {showMore && (
                <div style={{ display:"grid", gap:14, marginTop:4 }}>
                  <div>
                    <label style={st.lbl}>What does your product do?</label>
                    <textarea style={{ ...st.ta, minHeight:72 }}
                      placeholder="e.g. AI scheduling tool that helps freelancers track billable hours automatically"
                      value={product} onChange={e => setProduct(e.target.value)} />
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                    <div>
                      <label style={st.lbl}>Who is it for?</label>
                      <input style={st.inp} placeholder="e.g. Freelance designers"
                        value={audience} onChange={e => setAudience(e.target.value)} />
                    </div>
                    <div>
                      <label style={st.lbl}>Desired action</label>
                      <input style={st.inp} placeholder="e.g. Sign up for free trial"
                        value={goal} onChange={e => setGoal(e.target.value)} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <p style={{ fontSize:13, color:C.creamDim, textAlign:"center", marginTop:16, marginBottom:8 }}>
              Free · No signup · Results in ~30 seconds
            </p>
            <button style={st.btnPrimary} onClick={run}>
              Show me what's broken →
            </button>
          </div>

          {/* Example roast */}
          <div style={{ marginTop:24 }}>
            <button style={{ ...st.btnGhost, fontSize:12, display:"block", margin:"0 auto" }}
              onClick={() => setShowExample(s => !s)}>
              {showExample ? "▲ Hide example" : "See an example →"}
            </button>
            {showExample && (
              <div style={{ ...st.card, marginTop:16 }} className="fade">
                <div style={{ ...st.eyebrow, marginBottom:12 }}>Example · linear.app</div>

                <div style={{ ...st.card, borderLeft:`3px solid ${C.coral}`, marginBottom:12 }}>
                  <div style={{ ...st.eyebrow, marginBottom:10 }}>The 5-second test</div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
                    <div>
                      <div style={{ fontSize:10, fontFamily:"'Nunito',sans-serif", fontWeight:800, letterSpacing:"2px", textTransform:"uppercase", color:"#22c55e", marginBottom:6 }}>Visitors understand</div>
                      <p style={{ fontSize:13, color:C.cream, lineHeight:1.7 }}>A project management tool built for speed — the headline and demo video make the core value immediately clear.</p>
                    </div>
                    <div>
                      <div style={{ fontSize:10, fontFamily:"'Nunito',sans-serif", fontWeight:800, letterSpacing:"2px", textTransform:"uppercase", color:C.coral, marginBottom:6 }}>Visitors get confused by</div>
                      <p style={{ fontSize:13, color:C.cream, lineHeight:1.7 }}>It's unclear who this is for — "built for modern product teams" is vague enough to apply to any B2B tool on the market.</p>
                    </div>
                  </div>
                </div>

                {[
                  { title:"Hero Call to Action (CTA) competes with itself", severity:"critical", description:"There are two primary CTAs above the fold — 'Start for free' and 'See how it works' — at the same visual weight. Users hesitate when asked to make two decisions at once.", fix:"Make 'Start for free' the single dominant CTA. Demote 'See how it works' to a text link below the button." },
                  { title:"Social proof is buried", severity:"moderate", description:"The customer logos appear below the fold, after a full-screen product screenshot. Most users won't scroll far enough to see them.", fix:"Move at least one recognisable logo row immediately below the headline, before the product demo." },
                ].map((f, i) => {
                  const s = SEV[f.severity] || SEV.minor;
                  return (
                    <div key={i} style={{ background:C.forest, border:`1.5px solid rgba(255,255,255,.06)`, borderLeft:`3px solid ${s.color}`, borderRadius:12, padding:"18px 20px", marginBottom:10 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8, gap:12 }}>
                        <span style={{ fontFamily:"'Nunito',sans-serif", fontWeight:800, fontSize:15, color:C.cream, flex:1 }}>{f.title}</span>
                        <Badge sev={f.severity} />
                      </div>
                      <p style={{ fontSize:13, color:C.creamDim, lineHeight:1.75, marginBottom:10 }}>{f.description}</p>
                      <div style={{ padding:"10px 14px", background:s.bg, border:`1px solid ${s.border}`, borderRadius:8 }}>
                        <span style={{ fontSize:9, fontFamily:"'Nunito',sans-serif", fontWeight:800, letterSpacing:"2px", textTransform:"uppercase", color:s.color, display:"block", marginBottom:4 }}>Fix</span>
                        <span style={{ fontSize:13, color:C.cream, lineHeight:1.7 }}>{f.fix}</span>
                      </div>
                    </div>
                  );
                })}

                <div style={{ background:`rgba(255,82,48,.08)`, border:`1.5px solid rgba(255,82,48,.2)`, borderRadius:12, padding:"16px 20px" }}>
                  <div style={{ ...st.eyebrow, marginBottom:6 }}>Fix this first</div>
                  <p style={{ fontSize:14, color:C.cream, lineHeight:1.7 }}>Consolidate to a single CTA above the fold — every extra choice you give visitors reduces the chance they take any action.</p>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Marquee */}
        <div style={{ overflow:"hidden", marginTop:48 }}>
          <div style={{ background:C.coral, padding:"12px 0" }}>
            <div style={{ display:"flex", width:"max-content", animation:"marquee 28s linear infinite" }}>
              {[0,1].map(i => (
                <div key={i} style={{ display:"flex", alignItems:"center", flexShrink:0 }}>
                  {["NO FLUFF","JUST THE HARD TRUTH","THE FEEDBACK YOUR FRIENDS WERE TOO POLITE TO GIVE","FIX IT BEFORE YOUR USERS DO","NO SUGARCOATING","JUST WHAT NEEDS FIXING"].map((t,j) => (
                    <span key={j} style={{ display:"flex", alignItems:"center", gap:20 }}>
                      <span style={{ fontFamily:"'Bagel Fat One',cursive", fontSize:18, color:C.forest, whiteSpace:"nowrap", padding:"0 20px" }}>{t}</span>
                      <span style={{ width:6, height:6, background:"rgba(13,33,25,.3)", borderRadius:"50%", flexShrink:0 }} />
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
        </>
      )}

      {/* ══════════ LOADING ══════════ */}
      {step === "loading" && (
        <div style={{ ...st.inner, textAlign:"center", paddingTop:80 }} className="fade">
          <div style={{ fontFamily:"'Bagel Fat One',cursive", fontSize:60, color:C.coral,
            textShadow:`0 3px 0 ${C.coralDark}`, filter:"url(#bubble)",
            animation:"breathe 2s ease-in-out infinite", display:"inline-block", marginBottom:32 }}>
            BRUTAL
          </div>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:10, marginBottom:16 }}>
            <Spinner />
            <span style={{ fontFamily:"'Nunito',sans-serif", fontWeight:700, fontSize:15, color:C.cream }}>
              Reading your page…
            </span>
          </div>
          <p style={{ fontSize:13, color:C.creamFaint, marginBottom:6 }}>
            Being brutally honest takes a second.
          </p>
          <p style={{ fontFamily:"'DM Sans',monospace", fontSize:12, color:"rgba(255,255,255,.2)" }}>
            {elapsed}s
          </p>
        </div>
      )}

      {/* ══════════ RESULTS ══════════ */}
      {step === "results" && results && (
        <div style={{ ...st.inner, paddingTop:40 }} className="fade">

          {/* Header */}
          <div style={{ marginBottom:32 }}>
            <div style={{ ...st.eyebrow, marginBottom:8 }}>Roast complete · {url}</div>
            <h1 style={{ fontFamily:"'Bagel Fat One',cursive", fontSize:"clamp(34px,6vw,56px)",
              color:C.cream, lineHeight:1.05, letterSpacing:"-.5px" }}>
              Here's the <span style={{ color:C.coral }}>hard truth.</span>
            </h1>
          </div>

          {/* 5-second test */}
          <div style={{ ...st.card, borderLeft:`3px solid ${C.coral}`, marginBottom:20 }}>
            <div style={{ ...st.eyebrow, marginBottom:12 }}>The 5-second test</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
              <div>
                <div style={{ fontSize:10, fontFamily:"'Nunito',sans-serif", fontWeight:800,
                  letterSpacing:"2px", textTransform:"uppercase", color:"#22c55e", marginBottom:6 }}>
                  Visitors understand
                </div>
                <p style={{ fontSize:14, color:C.cream, lineHeight:1.7 }}>{results.first_impression}</p>
              </div>
              <div>
                <div style={{ fontSize:10, fontFamily:"'Nunito',sans-serif", fontWeight:800,
                  letterSpacing:"2px", textTransform:"uppercase", color:C.coral, marginBottom:6 }}>
                  Visitors get confused by
                </div>
                <p style={{ fontSize:14, color:C.cream, lineHeight:1.7 }}>{results.confusion}</p>
              </div>
            </div>
          </div>

          {/* What's working */}
          {results.whats_working?.length > 0 && (
            <div style={{ ...st.card, borderLeft:`3px solid #22c55e`, marginBottom:20 }}>
              <div style={{ fontSize:10, fontFamily:"'Nunito',sans-serif", fontWeight:800,
                letterSpacing:"3px", textTransform:"uppercase", color:"#22c55e", marginBottom:12 }}>
                What's working
              </div>
              {results.whats_working.map((item, i) => (
                <div key={i} style={{ display:"flex", gap:10, marginBottom: i < results.whats_working.length - 1 ? 10 : 0 }}>
                  <span style={{ color:"#22c55e", flexShrink:0 }}>✓</span>
                  <p style={{ fontSize:14, color:C.cream, lineHeight:1.7 }}>{item}</p>
                </div>
              ))}
            </div>
          )}

          {/* Findings */}
          <div style={{ ...st.eyebrow, marginBottom:14 }}>The findings</div>
          {results.findings?.map((f, i) => {
            const s = SEV[f.severity] || SEV.minor;
            return (
              <div key={i} style={{ ...st.card, borderLeft:`3px solid ${s.color}` }}
                className="fade" style2={{ animationDelay:`${i*.1}s` }}>
                <div style={{ display:"flex", justifyContent:"space-between",
                  alignItems:"flex-start", marginBottom:10, gap:12 }}>
                  <span style={{ fontFamily:"'Nunito',sans-serif", fontWeight:800,
                    fontSize:16, color:C.cream, flex:1 }}>{f.title}</span>
                  <Badge sev={f.severity} />
                </div>
                <p style={{ fontSize:13, color:C.creamDim, lineHeight:1.75, marginBottom:12 }}>
                  {f.description}
                </p>
                <div style={{ padding:"10px 14px", background:s.bg,
                  border:`1px solid ${s.border}`, borderRadius:8 }}>
                  <span style={{ fontSize:9, fontFamily:"'Nunito',sans-serif", fontWeight:800,
                    letterSpacing:"2px", textTransform:"uppercase", color:s.color,
                    display:"block", marginBottom:4 }}>Fix</span>
                  <span style={{ fontSize:13, color:C.cream, lineHeight:1.7 }}>{f.fix}</span>
                </div>
              </div>
            );
          })}

          {/* Rewrite */}
          {results.rewrite && (
            <div style={{ marginTop:8, marginBottom:12 }}>
              <div style={{ ...st.eyebrow, marginBottom:14 }}>The rewrite</div>
              <div style={{ ...st.card }}>
                <div style={{ fontSize:10, fontFamily:"'Nunito',sans-serif", fontWeight:800,
                  letterSpacing:"2px", textTransform:"uppercase", color:C.creamFaint, marginBottom:16 }}>
                  {results.rewrite.element}
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr auto 1fr", gap:12, alignItems:"center" }}>
                  <div style={{ background:C.forest, borderRadius:10, padding:"14px 16px" }}>
                    <div style={{ fontSize:9, fontFamily:"'Nunito',sans-serif", fontWeight:800,
                      letterSpacing:"2px", textTransform:"uppercase", color:"rgba(255,255,255,.2)",
                      marginBottom:6 }}>Before</div>
                    <p style={{ fontSize:13, color:"rgba(255,255,255,.3)", lineHeight:1.65,
                      textDecoration:"line-through", textDecorationColor:"rgba(255,255,255,.15)" }}>
                      {results.rewrite.before}
                    </p>
                  </div>
                  <span style={{ fontFamily:"'Bagel Fat One',cursive", fontSize:22, color:C.coral,
                    textShadow:`0 2px 0 ${C.coralDark}` }}>→</span>
                  <div style={{ background:C.forest, borderRadius:10, padding:"14px 16px",
                    border:`1.5px solid rgba(255,82,48,.2)` }}>
                    <div style={{ fontSize:9, fontFamily:"'Nunito',sans-serif", fontWeight:800,
                      letterSpacing:"2px", textTransform:"uppercase", color:C.coral, marginBottom:6 }}>After</div>
                    <p style={{ fontSize:13, color:C.cream, lineHeight:1.65, fontWeight:500 }}>
                      {results.rewrite.after}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Fix first */}
          {results.fix_first && (
            <div style={{ background:`rgba(255,82,48,.08)`, border:`1.5px solid rgba(255,82,48,.25)`,
              borderRadius:16, padding:"20px 24px", marginBottom:16 }}>
              <div style={{ ...st.eyebrow, marginBottom:8 }}>Fix this first</div>
              <p style={{ fontSize:15, color:C.cream, lineHeight:1.7, fontWeight:500 }}>
                {results.fix_first}
              </p>
            </div>
          )}

          {/* Bottom actions */}
          <div style={{ display:"flex", gap:12, marginTop:24, flexWrap:"wrap" }}>
            <button style={{ ...st.btnPrimary, flex:1, marginTop:0 }} onClick={reset}>
              Roast another site →
            </button>
          </div>

          <p style={{ fontSize:11, color:C.creamFaint, textAlign:"center", marginTop:16, lineHeight:1.8 }}>
            The more context you add — audience, goal, and product description — the sharper your roast.
          </p>

        </div>
      )}
    </div>
  );
}
