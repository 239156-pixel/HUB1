/**
 * LearnHub AI Assistant Logic
 * Handles all AI chat, streaming, and math rendering.
 */

const SYSTEM_PROMPT = `You are LearnHub AI, an expert academic tutor. When a user asks a general question, respond using EXACTLY this format:

📖 **Definition:**
[A clear, simple 1-2 sentence definition.]

💡 **Concept:**
[A concise explanation of the core idea in 2-4 sentences.]

🌍 **Real-life Example:**
[One vivid, relatable real-world example.]

🧮 **Formula / Reaction:**
[Follow the formula rules below strictly.]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FORMULA RULES — READ CAREFULLY:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RULE 1 — The $$ block must contain ONLY the formula, nothing else.
  ✅ CORRECT:
  $$V = IR$$
  where V = Voltage (V), I = Current (A), R = Resistance (Ω)

  ❌ WRONG (never do this):
  $$V = IR, where $V$ = voltage$$
  ❌ WRONG (never do this):
  $$V = IR where V = voltage (V) I = current (A)$$

RULE 2 — Variable explanations go on a SEPARATE LINE after the $$ block, as plain text with NO dollar signs.
  Write: "where V = Voltage (Volts), I = Current (Amperes), R = Resistance (Ohms)"
  NOT: "where $V$ = Voltage" — never put $ signs in variable explanations.

RULE 3 — Always use $$ on its own line, never inline. Always close with $$.
  ✅ $$F = ma$$
  ❌ The formula is $$F = ma$$ as shown above.

RULE 4 — For chemistry reactions, use $$\\ce{...}$$ syntax:
  ✅ $$\\ce{6CO2 + 6H2O -> C6H12O6 + 6O2}$$
  ❌ NEVER use \\mathrm{} for chemical elements.

RULE 5 — If there is no formula, write: Not applicable.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

If the user asks for a specific calculation or problem, answer directly using $$ ... $$ for math only (no text inside the $$ block).`;

const aiState = {
    history: [],
    isTyping: false
};

let messageCounter = 0;

// Repairs common AI-generated LaTeX mistakes before KaTeX sees them
function sanitizeLatex(latex) {
    let s = latex;

    // Fix missing backslash on common commands (e.g. \mathrm -> already ok, but mathrm -> \mathrm)
    s = s.replace(/(?<!\\)\b(mathrm|mathbf|mathit|text|operatorname|rightarrow|leftarrow|leftrightarrow|Rightarrow|cdot|times|div|pm|approx|neq|leq|geq|infty|alpha|beta|gamma|delta|theta|lambda|mu|pi|sigma|omega|ce)\b\s*\{/g, '\\$1{');
    s = s.replace(/(?<!\\)\b(rightarrow|leftarrow|to|cdot|times|pm)\b(?!\{)/g, '\\$1');

    // Fix \,mathrm -> \,\mathrm (backslash before comma-space commands)
    s = s.replace(/\\,([a-zA-Z])/g, (_, c) => `\\,\\${c}`);

    // Fix missing opening brace: e.g. \mathrmO} -> \mathrm{O}
    s = s.replace(/\\mathrm([A-Za-z0-9_\^]+)\}/g, '\\mathrm{$1}');

    // Fix +text{ -> +\text{
    s = s.replace(/\+text\{/g, '+\\text{');

    // Convert broken \mathrm{} chemistry patterns to \ce{} notation
    // Detect if the expression looks like chemistry (has element symbols with mathrm)
    if (/\\mathrm\{[A-Z][a-z]?\}/.test(s) || /\\ce\{/.test(s)) {
        // Already using \ce or has \mathrm element patterns — try to clean up \mathrm chemistry
        s = s.replace(/\\mathrm\{([A-Z][a-z]?)\}_\{?(\d+)\}?/g, (_, el, n) => `${el}_{${n}}`);
        s = s.replace(/\\mathrm\{([A-Z][a-z]?)\}/g, '$1');
    }

    // Balance unmatched closing braces (remove extra })
    let opens = (s.match(/\{/g) || []).length;
    let closes = (s.match(/\}/g) || []).length;
    if (closes > opens) s = s.replace(/\}$/, '');

    return s;
}

function cleanAIResponse(text) {
    // Step 1: Fix unclosed $$ — if there's an odd number of $$, close the last one
    const ddCount = (text.match(/\$\$/g) || []).length;
    if (ddCount % 2 !== 0) text = text + '$$';

    // Step 2: Strip text accidentally inside $$ blocks (e.g. $$V = IR where V = voltage$$)
    // If a $$ block contains "where", strip everything from "where" onward before the closing $$
    text = text.replace(/\$\$([\s\S]+?)\$\$/g, (match, inner) => {
        // Remove any prose after the actual formula (e.g. ", where ..." or "\nwhere ...")
        const clean = inner.replace(/[,\s]*(where|such that|and|note:)[\s\S]*$/i, '').trim();
        return `$$${clean}$$`;
    });

    // Step 3: Remove stray single $ signs that appear in plain-text variable explanations
    // e.g. "where $V$ = voltage" → "where V = voltage"
    // Only strip $ signs that are OUTSIDE of $$ blocks
    const parts = text.split(/(\$\$[\s\S]+?\$\$)/g);
    const cleaned = parts.map((part, i) => {
        if (i % 2 === 1) return part; // inside $$ block — leave alone
        // Outside $$ — remove all $ signs (they're stray inline math markers)
        return part.replace(/\$([^$\n]{1,40}?)\$/g, '$1');
    });
    return cleaned.join('');
}

function formatText(text) {
    if (!window.marked || !text) return text;
    text = cleanAIResponse(text);
    const mathBlocks = [];
    const protect = (match) => {
        // Sanitize LaTeX inside $$ blocks before protecting
        const inner = match.replace(/\$\$([\s\S]+?)\$\$/g, (_, m) => `$$${sanitizeLatex(m)}$$`);
        mathBlocks.push(inner);
        return `%%%MB_${mathBlocks.length - 1}%%%`;
    };
    let t = text;
    // Protect all math blocks from markdown processing (order matters: longest first)
    t = t.replace(/\$\$[\s\S]+?\$\$/g, protect);       // $$...$$  display math
    t = t.replace(/\\\[[\s\S]+?\\\]/g, protect);        // \[...\]  display math
    t = t.replace(/\\\([\s\S]+?\\\)/g, protect);        // \(...\)  inline math
    t = marked.parse(t);
    mathBlocks.forEach((b, i) => { t = t.replace(`%%%MB_${i}%%%`, b); });
    return t;
}

function renderMath(el) {
    if (window.renderMathInElement) {
        renderMathInElement(el, {
            delimiters: [
                { left: '$$', right: '$$', display: true },
                { left: '\\[', right: '\\]', display: true },
                { left: '\\(', right: '\\)', display: false },
                { left: '$',  right: '$',  display: false }
            ],
            throwOnError: false,
            strict: false
        });
    }
}

function appendMessage(chatLog, role, text, isStreaming = false) {
    messageCounter++;
    const msgId = `msg-${messageCounter}`;
    const formatted = isStreaming ? text : formatText(text);

    const avatarSVG = role === 'ai'
        ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a8 8 0 0 0-8 8v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a8 8 0 0 0-8-8z"/><path d="M9 12H9.01M15 12H15.01"/><path d="M8 16s1.5 2 4 2 4-2 4-2"/></svg>`
        : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;

    const div = document.createElement('div');
    div.id = msgId;
    div.className = `message-bubble ${role}-message`;
    div.innerHTML = `
        <div class="message-avatar">${avatarSVG}</div>
        <div class="message-wrapper">
            <div class="message-content">${formatted}</div>
            <span class="message-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>`;
    chatLog.appendChild(div);
    chatLog.scrollTop = chatLog.scrollHeight;
    if (!isStreaming) renderMath(div);
    return msgId;
}

function updateMessage(chatLog, msgId, newText, isComplete = false) {
    const div = document.getElementById(msgId);
    if (!div) return;
    const content = div.querySelector('.message-content');
    if (content) {
        content.innerHTML = isComplete ? formatText(newText) : newText;
    }
    if (isComplete) renderMath(div);
    chatLog.scrollTop = chatLog.scrollHeight;
}

function showTyping(chatLog) {
    const div = document.createElement('div');
    div.id = 'ai-typing';
    div.className = 'message-bubble ai-message';
    div.innerHTML = `
        <div class="message-avatar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a8 8 0 0 0-8 8v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a8 8 0 0 0-8-8z"/></svg></div>
        <div class="message-wrapper">
            <div class="message-content typing-indicator">
                <span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>
            </div>
        </div>`;
    chatLog.appendChild(div);
    chatLog.scrollTop = chatLog.scrollHeight;
}

async function getAIAnswer(query, onChunk) {
    const geminiKey = localStorage.getItem('geminiApiKey');

    if (geminiKey) {
        try {
            const geminiHistory = aiState.history.map(m => ({
                role: m.role,
                parts: m.parts || [{ text: m.content }]
            }));
            const contents = [
                { role: 'user', parts: [{ text: SYSTEM_PROMPT }] },
                { role: 'model', parts: [{ text: 'Understood.' }] },
                ...geminiHistory,
                { role: 'user', parts: [{ text: query }] }
            ];
            const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:streamGenerateContent?alt=sse&key=${geminiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents })
            });
            if (!resp.ok) {
                const errText = await resp.text();
                if (errText.includes('API key not valid')) { localStorage.removeItem('geminiApiKey'); }
                throw new Error(`API Error: ${resp.status}`);
            }
            const reader = resp.body.getReader();
            const decoder = new TextDecoder();
            let full = '';
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                for (const line of decoder.decode(value, { stream: true }).split('\n').filter(l => l.startsWith('data: '))) {
                    try {
                        const d = JSON.parse(line.substring(6));
                        if (d.candidates?.[0]?.content?.parts) {
                            full += d.candidates[0].content.parts[0].text;
                            if (onChunk) onChunk(full);
                        }
                    } catch (_) {}
                }
            }
            aiState.history.push({ role: 'user', parts: [{ text: query }] });
            aiState.history.push({ role: 'model', parts: [{ text: full }] });
            return full;
        } catch (err) {
            return `Error using Gemini: ${err.message}. Try clearing your API key.`;
        }
    }

    // ── Free AI Fallback (no API key required) ───────────────────────
    // Short system prompt for GET requests (URL length limit ~2000 chars)
    const SHORT_SYSTEM = `You are LearnHub AI, an academic tutor. For general questions use exactly these 4 sections:
📖 **Definition:** (1-2 sentences)
💡 **Concept:** (2-4 sentences)
🌍 **Real-life Example:** (1 example)
🧮 **Formula / Reaction:** put formula inside $$...$$ on its own line, explain variables in plain text after (no $ signs in explanations). For chemistry use $$\\ce{...}$$. If none, write: Not applicable.`;

    // Helper: is this response a deprecation/error notice we should reject?
    const isNotice = (t) => {
        const l = t.toLowerCase();
        return t.length < 30
            || l.includes('important notice')
            || l.includes('pollinations legacy')
            || l.includes('deprecated')
            || l.includes('migrate to our new service')
            || l.includes('enter.pollinations.ai');
    };

    // Helper: fetch with timeout
    const fetchWithTimeout = (url, opts = {}, ms = 15000) => {
        const ctrl = new AbortController();
        const id = setTimeout(() => ctrl.abort(), ms);
        return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(id));
    };

    // ── Tier 1: Pollinations GET (short prompt, most stable) ─────────
    try {
        const resp = await fetchWithTimeout(
            `https://text.pollinations.ai/${encodeURIComponent(query)}?model=openai&system=${encodeURIComponent(SHORT_SYSTEM)}&seed=${Date.now() % 99999}`,
            {}, 15000
        );
        if (resp.ok) {
            const text = (await resp.text()).trim();
            if (!isNotice(text)) {
                if (onChunk) onChunk(text);
                aiState.history.push({ role: 'user',  parts: [{ text: query }] });
                aiState.history.push({ role: 'model', parts: [{ text: text }] });
                return text;
            }
        }
    } catch (_) {}

    // ── Tier 2: Pollinations POST, stream:false (bypasses streaming issue) ─
    for (const model of ['openai', 'mistral', 'llama']) {
        try {
            const messages = [
                { role: 'system', content: SHORT_SYSTEM },
                ...aiState.history.map(m => ({
                    role: m.role === 'model' ? 'assistant' : 'user',
                    content: m.parts?.[0]?.text || m.content
                })),
                { role: 'user', content: query }
            ];
            const resp = await fetchWithTimeout('https://text.pollinations.ai/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages, model, stream: false, seed: Date.now() % 99999 })
            }, 20000);
            if (!resp.ok) continue;
            const data = await resp.json().catch(() => null);
            const text = (data?.choices?.[0]?.message?.content || data?.content || '').trim();
            if (text && !isNotice(text)) {
                if (onChunk) onChunk(text);
                aiState.history.push({ role: 'user',  parts: [{ text: query }] });
                aiState.history.push({ role: 'model', parts: [{ text: text }] });
                return text;
            }
        } catch (_) { continue; }
    }

    // ── Tier 3: Pollinations POST streaming fallback ─────────────────
    for (const model of ['openai', 'mistral']) {
        try {
            const messages = [
                { role: 'system', content: SHORT_SYSTEM },
                { role: 'user',   content: query }
            ];
            const resp = await fetchWithTimeout('https://text.pollinations.ai/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages, model, stream: true })
            }, 25000);
            if (!resp.ok) continue;
            const reader = resp.body.getReader();
            const decoder = new TextDecoder();
            let full = '';
            outer: while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                for (const line of decoder.decode(value, { stream: true }).split('\n')) {
                    if (!line.startsWith('data: ')) continue;
                    const raw = line.slice(6).trim();
                    if (raw === '[DONE]') break outer;
                    try {
                        const d = JSON.parse(raw);
                        const chunk = d.choices?.[0]?.delta?.content || '';
                        if (chunk) { full += chunk; if (onChunk) onChunk(full); }
                    } catch (_) {}
                }
            }
            const trimmed = full.trim();
            if (trimmed && !isNotice(trimmed)) {
                aiState.history.push({ role: 'user',  parts: [{ text: query }] });
                aiState.history.push({ role: 'model', parts: [{ text: trimmed }] });
                return trimmed;
            }
        } catch (_) { continue; }
    }

    return `⚠️ The free AI is temporarily unavailable. For a guaranteed response, click the 🔑 button and add a **free** Gemini API key — takes 30 seconds at [aistudio.google.com/apikey](https://aistudio.google.com/apikey)`;
}


function initAssistant(chatFormId, chatInputId, chatLogId) {
    const form = document.getElementById(chatFormId);
    const input = document.getElementById(chatInputId);
    const log = document.getElementById(chatLogId);
    if (!form || !input || !log) return;

    if (window.marked) marked.setOptions({ gfm: true, breaks: true });

    appendMessage(log, 'ai', '👋 Hi! I\'m your AI tutor. Ask me anything — I\'ll explain with simple definitions, concepts, real-life examples, and formulas!');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const val = input.value.trim();
        if (!val || aiState.isTyping) return;
        aiState.isTyping = true;
        input.value = '';
        appendMessage(log, 'user', val);
        showTyping(log);
        let streamingId = null;

        const response = await getAIAnswer(val, (chunk) => {
            document.getElementById('ai-typing')?.remove();
            if (!streamingId) {
                streamingId = appendMessage(log, 'ai', chunk, true);
            } else {
                updateMessage(log, streamingId, chunk, false);
            }
        });

        document.getElementById('ai-typing')?.remove();
        if (!streamingId) {
            appendMessage(log, 'ai', response);
        } else {
            updateMessage(log, streamingId, response, true);
        }
        aiState.isTyping = false;
    });

    // Suggestion chips
    document.querySelectorAll('.suggestion-chip-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            input.value = btn.dataset.prompt;
            form.dispatchEvent(new Event('submit'));
        });
    });

    // API Key button
    document.getElementById('chat-api-btn')?.addEventListener('click', () => {
        const cur = localStorage.getItem('geminiApiKey') || '';
        const key = prompt('Enter your Gemini API Key for blazing-fast responses.\nLeave blank to use the free public AI.', cur);
        if (key !== null) {
            if (key.trim() === '') { localStorage.removeItem('geminiApiKey'); alert('API Key removed.'); }
            else { localStorage.setItem('geminiApiKey', key.trim()); alert('Gemini API Key saved!'); }
        }
    });

    // Clear chat
    document.getElementById('chat-clear-btn')?.addEventListener('click', () => {
        log.innerHTML = '';
        aiState.history = [];
        appendMessage(log, 'ai', 'Chat cleared. Ask me anything!');
    });
}
