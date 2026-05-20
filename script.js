/**
 * LearnHub — Main Script
 * Handles navigation, board browsing, text viewer, and theme.
 */

/* ─── BOARD DATA ─────────────────────────────────────────────── */
const BOARDS_DATA = {
    cbse: {
        label: 'CBSE',
        icon: '🇮🇳',
        classes: {
            class10: {
                label: 'Class 10',
                subjects: {
                    maths:         { label: 'Mathematics', icon: '📐', chapters: ['chapter1','chapter2','chapter3','chapter4','chapter5'] },
                    science:       { label: 'Science',     icon: '🔬', chapters: ['chapter1','chapter2','chapter3'] },
                    social_science:{ label: 'Social Science', icon: '🌍', chapters: ['chapter1','chapter2'] },
                    english:       { label: 'English',     icon: '📚', chapters: ['chapter1','chapter2'] }
                }
            },
            class12: {
                label: 'Class 12',
                subjects: {
                    physics:   { label: 'Physics',   icon: '⚡', chapters: ['chapter1','chapter2','chapter3'] },
                    chemistry: { label: 'Chemistry', icon: '🧪', chapters: ['chapter1','chapter2','chapter3'] },
                    maths:     { label: 'Mathematics',icon: '📐', chapters: ['chapter1','chapter2','chapter3'] },
                    biology:   { label: 'Biology',   icon: '🌱', chapters: ['chapter1','chapter2'] }
                }
            }
        }
    },
    maharashtra: {
        label: 'Maharashtra Board',
        icon: '🏛️',
        classes: {
            class10: {
                label: 'Class 10',
                subjects: {
                    maths:     { label: 'Mathematics', icon: '📐', chapters: ['chapter1','chapter2','chapter3'] },
                    science:   { label: 'Science',     icon: '🔬', chapters: ['chapter1','chapter2'] },
                    history:   { label: 'History',     icon: '📜', chapters: ['chapter1','chapter2'] },
                    geography: { label: 'Geography',   icon: '🗺️', chapters: ['chapter1','chapter2'] }
                }
            },
            class12: {
                label: 'Class 12',
                subjects: {
                    physics:   { label: 'Physics',   icon: '⚡', chapters: ['chapter1','chapter2','chapter3'] },
                    chemistry: { label: 'Chemistry', icon: '🧪', chapters: ['chapter1','chapter2','chapter3'] },
                    maths:     { label: 'Mathematics',icon: '📐', chapters: ['chapter1','chapter2','chapter3'] },
                    biology:   { label: 'Biology',   icon: '🌱', chapters: ['chapter1','chapter2'] }
                }
            }
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {

    /* ─── THEME ─────────────────────────────────────────────── */
    const applyTheme = (t) => {
        document.documentElement.setAttribute('data-theme', t);
        localStorage.setItem('theme', t);
    };
    applyTheme(localStorage.getItem('theme') || 'dark');
    document.getElementById('theme-toggle')?.addEventListener('click', () => {
        const cur = document.documentElement.getAttribute('data-theme');
        applyTheme(cur === 'dark' ? 'light' : 'dark');
    });

    /* ─── NAVIGATION ─────────────────────────────────────────── */
    const handleRoute = () => {
        const hash = window.location.hash || '#/home';
        const target = hash.replace('#/', '');
        document.querySelectorAll('.app-section').forEach(s => s.classList.toggle('active', s.id === `${target}-section`));
        document.querySelectorAll('.nav-link').forEach(l => l.classList.toggle('active', l.getAttribute('href') === hash));
        window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', handleRoute);
    handleRoute();

    /* ─── MOBILE MENU ────────────────────────────────────────── */
    const mobileToggle = document.getElementById('mobile-toggle');
    const mobileDrawer = document.getElementById('mobile-drawer');
    const overlay      = document.getElementById('drawer-overlay');
    const toggleDrawer = () => { mobileDrawer?.classList.toggle('open'); overlay?.classList.toggle('open'); };
    mobileToggle?.addEventListener('click', toggleDrawer);
    overlay?.addEventListener('click', toggleDrawer);
    document.querySelectorAll('.mobile-nav-link').forEach(l => l.addEventListener('click', toggleDrawer));

    /* ─── SCROLL PROGRESS ────────────────────────────────────── */
    window.addEventListener('scroll', () => {
        const el = document.getElementById('scroll-progress');
        if (!el) return;
        const pct = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100;
        el.style.width = pct + '%';
    });

    /* ─── NOTES BROWSER ──────────────────────────────────────── */
    const notesContainer = document.getElementById('notes-browser');
    if (!notesContainer) return;

    let currentPath = { board: null, cls: null, subject: null };

    function renderBoards() {
        currentPath = { board: null, cls: null, subject: null };
        notesContainer.innerHTML = `
            <div class="section-header animate-fadeIn">
                <div class="section-tag">📚 Study Materials</div>
                <h2 class="section-title">Choose Your Board</h2>
                <p class="section-subtitle">Select your education board to browse class-wise notes and Q&A.</p>
            </div>
            <div class="boards-grid">
                ${Object.entries(BOARDS_DATA).map(([key, b]) => `
                    <div class="board-card animate-fadeIn" data-board="${key}">
                        <div class="board-icon">${b.icon}</div>
                        <div class="board-title">${b.label}</div>
                        <div class="board-subtitle">Select a class to explore chapters</div>
                        <div class="board-chips">
                            ${Object.values(b.classes).map(c => `<span class="board-chip">${c.label}</span>`).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>`;
        notesContainer.querySelectorAll('[data-board]').forEach(el => {
            el.addEventListener('click', () => renderClasses(el.dataset.board));
        });
    }

    function renderClasses(boardKey) {
        currentPath.board = boardKey;
        const board = BOARDS_DATA[boardKey];
        notesContainer.innerHTML = `
            <div class="breadcrumb">
                <a id="bc-home">🏠 Home</a> › <span>${board.label}</span>
            </div>
            <div class="section-header animate-fadeIn">
                <div class="section-tag">${board.icon} ${board.label}</div>
                <h2 class="section-title">Select a Class</h2>
            </div>
            <div class="subject-grid">
                ${Object.entries(board.classes).map(([key, cls]) => `
                    <div class="subject-card animate-fadeIn" data-class="${key}">
                        <div class="subject-icon">🎓</div>
                        <div class="subject-name">${cls.label}</div>
                    </div>
                `).join('')}
            </div>`;
        document.getElementById('bc-home').addEventListener('click', renderBoards);
        notesContainer.querySelectorAll('[data-class]').forEach(el => {
            el.addEventListener('click', () => renderSubjects(boardKey, el.dataset.class));
        });
    }

    function renderSubjects(boardKey, classKey) {
        currentPath.cls = classKey;
        const board = BOARDS_DATA[boardKey];
        const cls   = board.classes[classKey];
        notesContainer.innerHTML = `
            <div class="breadcrumb">
                <a id="bc-home">🏠 Home</a> ›
                <a id="bc-board">${board.label}</a> ›
                <span>${cls.label}</span>
            </div>
            <div class="section-header animate-fadeIn">
                <h2 class="section-title">${cls.label} — Subjects</h2>
            </div>
            <div class="subject-grid">
                ${Object.entries(cls.subjects).map(([key, sub]) => `
                    <div class="subject-card animate-fadeIn" data-subject="${key}">
                        <div class="subject-icon">${sub.icon}</div>
                        <div class="subject-name">${sub.label}</div>
                    </div>
                `).join('')}
            </div>`;
        document.getElementById('bc-home').addEventListener('click', renderBoards);
        document.getElementById('bc-board').addEventListener('click', () => renderClasses(boardKey));
        notesContainer.querySelectorAll('[data-subject]').forEach(el => {
            el.addEventListener('click', () => renderChapters(boardKey, classKey, el.dataset.subject));
        });
    }

    function renderChapters(boardKey, classKey, subjectKey) {
        currentPath.subject = subjectKey;
        const board   = BOARDS_DATA[boardKey];
        const cls     = board.classes[classKey];
        const subject = cls.subjects[subjectKey];
        notesContainer.innerHTML = `
            <div class="breadcrumb">
                <a id="bc-home">🏠 Home</a> ›
                <a id="bc-board">${board.label}</a> ›
                <a id="bc-class">${cls.label}</a> ›
                <span>${subject.label}</span>
            </div>
            <div class="section-header animate-fadeIn">
                <h2 class="section-title">${subject.icon} ${subject.label}</h2>
                <p class="section-subtitle">Click "Notes" to read chapter content or "Q&A" for practice questions.</p>
            </div>
            <div class="chapters-list">
                ${subject.chapters.map((ch, i) => `
                    <div class="chapter-item animate-fadeIn">
                        <div>
                            <div class="chapter-name">Chapter ${i + 1}</div>
                            <div class="chapter-meta">${subject.label} · ${board.label} · ${cls.label}</div>
                        </div>
                        <div class="chapter-btns">
                            <button class="chapter-btn" data-file="boards/${boardKey}/${classKey}/${subjectKey}/${ch}.txt" data-title="Chapter ${i+1} Notes">📄 Notes</button>
                            <button class="chapter-btn qa" data-file="boards/${boardKey}/${classKey}/${subjectKey}/${ch}_QA.txt" data-title="Chapter ${i+1} Q&A">❓ Q&A</button>
                        </div>
                    </div>
                `).join('')}
            </div>`;
        document.getElementById('bc-home').addEventListener('click', renderBoards);
        document.getElementById('bc-board').addEventListener('click', () => renderClasses(boardKey));
        document.getElementById('bc-class').addEventListener('click', () => renderSubjects(boardKey, classKey));
        notesContainer.querySelectorAll('[data-file]').forEach(btn => {
            btn.addEventListener('click', () => openViewer(btn.dataset.file, btn.dataset.title));
        });
    }

    /* ─── TEXT FILE VIEWER MODAL ─────────────────────────────── */
    const viewerModal   = document.getElementById('viewer-modal');
    const viewerTitle   = document.getElementById('viewer-title');
    const viewerContent = document.getElementById('viewer-content');
    const viewerClose   = document.getElementById('viewer-close');

    async function openViewer(filePath, title) {
        viewerTitle.textContent = title;
        viewerContent.innerHTML = '<pre>Loading...</pre>';
        viewerModal.classList.add('open');
        try {
            const res = await fetch(filePath);
            if (!res.ok) throw new Error('File not found');
            const text = await res.text();
            viewerContent.innerHTML = `<pre>${escapeHtml(text)}</pre>`;
        } catch (e) {
            viewerContent.innerHTML = `<pre style="color:#ef4444">⚠️ Could not load file: ${filePath}\n\nMake sure you have replaced the placeholder .txt files with your actual content.</pre>`;
        }
    }

    function escapeHtml(str) {
        return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    viewerClose?.addEventListener('click', () => viewerModal.classList.remove('open'));
    viewerModal?.addEventListener('click', (e) => { if (e.target === viewerModal) viewerModal.classList.remove('open'); });

    /* ─── INITIAL RENDER ─────────────────────────────────────── */
    renderBoards();

    /* ─── AI ASSISTANT INIT ──────────────────────────────────── */
    if (typeof initAssistant === 'function') {
        initAssistant('chat-submit-form', 'chat-user-input', 'chat-message-log');
    }

});
