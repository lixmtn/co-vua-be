'use strict';
/* Cờ Vua Bé — chess basics for a 4-year-old.
   Pedagogy: one piece at a time on mini boards (5×5), learn by "collect the stars"
   and "capture" puzzles, legal-move dots always shown, voice prompts (pre-reader),
   no fail states — mistakes get a gentle hint or an undo. */

const $ = s => document.querySelector(s);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rnd = n => Math.floor(Math.random() * n);
const pick = a => a[rnd(a.length)];
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };

/* ---------- state ---------- */
const KEY = 'covua-be-v1';
const S = { done: {}, stars: 0, unlockAll: false, voice: true, rate: 0.9 };
try { Object.assign(S, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };

/* ---------- audio ---------- */
let viVoice = null;
function pickVoice() {
  const vs = speechSynthesis.getVoices();
  viVoice = vs.find(v => /^vi/i.test(v.lang) && /linh/i.test(v.name)) || vs.find(v => /^vi/i.test(v.lang)) || null;
}
if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }

let speakSeq = 0;
function speak(text, onEnd) {
  const seq = ++speakSeq;
  let fired = false;
  const end = () => { if (fired || seq !== speakSeq) return; fired = true; onEnd && onEnd(); };
  // fallback in case onend never fires (no voice / muted)
  if (onEnd) setTimeout(end, Math.min(7000, Math.max(2200, text.length * 60 / S.rate)));
  if (!S.voice || !('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/\p{Extended_Pictographic}/gu, ''));
  u.lang = 'vi-VN'; if (viVoice) u.voice = viVoice;
  u.rate = S.rate; u.pitch = 1.1;
  u.onend = () => setTimeout(end, 250);
  speechSynthesis.speak(u);
}

let AC = null;
function ac() {
  if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
  if (AC && AC.state === 'suspended') AC.resume();
  return AC;
}
function tone(f, t0, dur, type = 'sine', vol = 0.16) {
  const a = ac(); if (!a) return;
  const o = a.createOscillator(), g = a.createGain(), t = a.currentTime + t0;
  o.type = type; o.frequency.setValueAtTime(f, t);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.05);
}
const SFX = {
  pick: () => tone(660, 0, 0.08, 'triangle', 0.12),
  move: () => { tone(392, 0, 0.09, 'triangle'); tone(523, 0.06, 0.1, 'triangle'); },
  star: () => { tone(880, 0, 0.1); tone(1175, 0.08, 0.16); },
  cap:  () => { tone(240, 0, 0.1, 'square', 0.06); tone(360, 0.07, 0.14, 'triangle'); },
  no:   () => { tone(230, 0, 0.14, 'sine', 0.14); tone(196, 0.12, 0.18, 'sine', 0.12); },
  win:  () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.26, 'triangle', 0.14)),
  magic:() => [784, 988, 1175, 1568, 1976].forEach((f, i) => tone(f, i * 0.07, 0.22, 'sine', 0.11)),
};

/* ---------- pieces (hand-drawn SVG with friendly faces) ---------- */
const NAME = { K: 'Vua', Q: 'Hậu', R: 'Xe', B: 'Tượng', N: 'Mã', P: 'Tốt' };
const STORY = {
  R: 'Đây là con Xe, giống tòa lâu đài. Xe chạy thẳng tắp: lên, xuống, sang trái, sang phải.',
  B: 'Đây là con Tượng, đội chiếc mũ nhọn. Tượng đi đường chéo, nghiêng nghiêng như cầu trượt.',
  Q: 'Đây là Hậu, đội vương miện. Hậu mạnh nhất: đi thẳng cũng được, đi chéo cũng được.',
  K: 'Đây là Vua, có dấu cộng trên đầu. Vua quan trọng nhất, mỗi lần chỉ đi một bước thôi.',
  N: 'Đây là con Mã, chú ngựa nhỏ. Mã nhảy hình chữ L, nhảy qua đầu các quân khác được.',
  P: 'Đây là con Tốt, chú lính nhỏ. Tốt đi thẳng về phía trước, mỗi lần một ô.',
};
function pieceSVG(t, col = 'w') {
  const f = col === 'w' ? '#fffaf0' : '#4b3f72', s = col === 'w' ? '#3b2f5c' : '#1d1633', gold = '#ffc93c';
  const eye = (x, y, r = 4.6) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" stroke="${s}" stroke-width="1.5"/><circle cx="${x + 0.8}" cy="${y + 0.6}" r="${r * 0.52}" fill="#1d1633"/><circle cx="${x + 1.8}" cy="${y - 0.8}" r="1" fill="#fff"/>`;
  const smile = (x, y) => `<path d="M${x - 4} ${y} Q${x} ${y + 4} ${x + 4} ${y}" fill="none" stroke="${s}" stroke-width="2.2" stroke-linecap="round"/>`;
  const cheeks = (x1, x2, y) => `<circle cx="${x1}" cy="${y}" r="3" fill="#ff8fa3" opacity=".55"/><circle cx="${x2}" cy="${y}" r="3" fill="#ff8fa3" opacity=".55"/>`;
  const base = `<rect x="22" y="80" width="56" height="12" rx="6"/><rect x="29" y="71" width="42" height="11" rx="4"/>`;
  let body = '', face = '';
  switch (t) {
    case 'P':
      body = `<path d="M38 47 Q50 52 62 47 L69 73 L31 73 Z"/><ellipse cx="50" cy="46" rx="15" ry="5"/><circle cx="50" cy="28" r="16"/>`;
      face = eye(44, 27) + eye(56, 27) + smile(50, 35) + cheeks(38, 62, 33); break;
    case 'R':
      body = `<path d="M33 34 L67 34 L70 73 L30 73 Z"/><path d="M27 12 h10 v8 h7 v-8 h12 v8 h7 v-8 h10 v24 h-46 Z"/>`;
      face = eye(43, 49) + eye(57, 49) + smile(50, 58) + cheeks(37, 63, 56); break;
    case 'B':
      body = `<path d="M38 50 L62 50 L69 73 L31 73 Z"/><ellipse cx="50" cy="50" rx="15" ry="5"/><path d="M50 11 C67 23 69 39 61 48 L39 48 C31 39 33 23 50 11 Z"/><circle cx="50" cy="9" r="5" fill="${gold}"/><path d="M58 19 L50 29" stroke-width="3" stroke-linecap="round"/>`;
      face = eye(44, 35, 4.2) + eye(56, 35, 4.2) + smile(50, 42); break;
    case 'Q':
      body = `<path d="M35 51 L65 51 L70 73 L30 73 Z"/><path d="M25 22 L37 43 L42 17 L50 40 L58 17 L63 43 L75 22 L67 52 L33 52 Z"/>` +
        [[25, 20], [42, 15], [58, 15], [75, 20]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4.5" fill="${gold}"/>`).join('') + `<circle cx="50" cy="36" r="4" fill="#ff6b9a"/>`;
      face = eye(44, 60, 4) + eye(56, 60, 4) + smile(50, 67); break;
    case 'K':
      body = `<path d="M35 53 L65 53 L70 73 L30 73 Z"/><path d="M29 52 C27 31 39 25 50 27 C61 25 73 31 71 52 Z"/><path d="M46 4 h8 v7 h7 v7 h-7 v9 h-8 v-9 h-7 v-7 h7 Z" fill="${gold}"/>`;
      face = eye(43, 39) + eye(57, 39) + smile(50, 47) + cheeks(36, 64, 45); break;
    case 'N':
      body = `<path d="M67 73 L33 73 C33 61 41 55 46 48 C38 51 30 52 25 46 C21 40 27 32 35 28 C39 20 46 14 55 14 L58 5 L64 14 C75 22 77 41 73 55 C71 63 69 67 67 73 Z"/><path d="M62 17 Q71 31 68 47" fill="none" stroke-width="3" stroke-linecap="round"/>`;
      face = eye(46, 27, 5.2) + `<circle cx="30" cy="42" r="2.2" fill="${s}"/>` + `<path d="M31 48 Q36 50 40 47" fill="none" stroke="${s}" stroke-width="2.2" stroke-linecap="round"/>` + `<circle cx="40" cy="37" r="3" fill="#ff8fa3" opacity=".55"/>`; break;
  }
  return `<svg viewBox="0 0 100 100" class="piece"><g fill="${f}" stroke="${s}" stroke-width="3" stroke-linejoin="round">${base}${body}</g>${face}</svg>`;
}
const miniBoardSVG = () => `<svg viewBox="0 0 40 40" class="piece">${[...Array(16)].map((_, i) => `<rect x="${(i % 4) * 10}" y="${Math.floor(i / 4) * 10}" width="10" height="10" fill="${(i % 4 + Math.floor(i / 4)) % 2 ? '#6fb58a' : '#fff4dc'}"/>`).join('')}<rect x="0.5" y="0.5" width="39" height="39" rx="3" fill="none" stroke="#3b2f5c" stroke-width="1.5"/></svg>`;

/* ---------- engine ---------- */
const k = (r, c) => r + ',' + c;
const rc = kk => kk.split(',').map(Number);
const ORTH = [[1, 0], [-1, 0], [0, 1], [0, -1]], DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const KN = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];
const dirsOf = t => t === 'R' ? ORTH : t === 'B' ? DIAG : ORTH.concat(DIAG);
const inb = (m, r, c) => r >= 0 && c >= 0 && r < m.h && c < m.w;

// Boards are authored as strings: UPPER = bé's pieces, lower = black, * star, # tree (blocks), . empty
function parse(rows) {
  const m = { h: rows.length, w: rows[0].length, ents: new Map(), stars: new Set() };
  let id = 0;
  rows.forEach((row, r) => [...row].forEach((ch, c) => {
    if (ch === '*') m.stars.add(k(r, c));
    else if (ch === '#') m.ents.set(k(r, c), { kind: 'rock', id: id++ });
    else if (/[KQRBNP]/i.test(ch)) m.ents.set(k(r, c), { kind: 'pc', t: ch.toUpperCase(), col: ch === ch.toUpperCase() ? 'w' : 'b', moved: false, id: id++ });
  }));
  return m;
}
const clone = m => ({ w: m.w, h: m.h, stars: new Set(m.stars), ents: new Map([...m.ents].map(([kk, e]) => [kk, { ...e }])) });

function moves(m, r, c) {
  const e = m.ents.get(k(r, c)); if (!e || e.kind !== 'pc') return [];
  const out = [];
  const add = (rr, cc) => {
    if (!inb(m, rr, cc)) return false;
    const o = m.ents.get(k(rr, cc));
    if (!o) { out.push({ r: rr, c: cc }); return true; }
    if (o.kind === 'pc' && o.col !== e.col) out.push({ r: rr, c: cc, cap: true });
    return false;
  };
  if ('RBQ'.includes(e.t)) for (const [dr, dc] of dirsOf(e.t)) { let rr = r + dr, cc = c + dc; while (add(rr, cc)) { rr += dr; cc += dc; } }
  else if (e.t === 'K') for (const [dr, dc] of ORTH.concat(DIAG)) add(r + dr, c + dc);
  else if (e.t === 'N') for (const [dr, dc] of KN) add(r + dr, c + dc);
  else if (e.t === 'P') {
    const d = e.col === 'w' ? -1 : 1;
    if (inb(m, r + d, c) && !m.ents.has(k(r + d, c))) {
      out.push({ r: r + d, c });
      if (!e.moved && inb(m, r + 2 * d, c) && !m.ents.has(k(r + 2 * d, c))) out.push({ r: r + 2 * d, c });
    }
    for (const dc of [-1, 1]) { const o = m.ents.get(k(r + d, c + dc)); if (o && o.kind === 'pc' && o.col !== e.col) out.push({ r: r + d, c: c + dc, cap: true }); }
  }
  return out;
}
// squares attacked by `col`; `ignore` (the king's square) is treated as empty so the king can't hide on the same line
function attacked(m, col, ignore) {
  const set = new Set();
  for (const [kk, e] of m.ents) {
    if (e.kind !== 'pc' || e.col !== col) continue;
    const [r, c] = rc(kk);
    const hit = (rr, cc) => { if (!inb(m, rr, cc)) return false; const q = k(rr, cc); set.add(q); return !m.ents.has(q) || q === ignore; };
    if ('RBQ'.includes(e.t)) for (const [dr, dc] of dirsOf(e.t)) { let rr = r + dr, cc = c + dc; while (hit(rr, cc)) { rr += dr; cc += dc; } }
    else if (e.t === 'K') ORTH.concat(DIAG).forEach(([dr, dc]) => hit(r + dr, c + dc));
    else if (e.t === 'N') KN.forEach(([dr, dc]) => hit(r + dr, c + dc));
    else if (e.t === 'P') { const d = col === 'w' ? -1 : 1; hit(r + d, c - 1); hit(r + d, c + 1); }
  }
  return set;
}
const piecesOf = (m, col) => [...m.ents].filter(([, e]) => e.kind === 'pc' && e.col === col);
const allMoves = (m, col) => piecesOf(m, col).flatMap(([kk]) => { const [r, c] = rc(kk); return moves(m, r, c).map(mv => ({ from: kk, ...mv })); });

/* ---------- board view ---------- */
class BoardView {
  constructor(host, m) {
    this.m = m; host.innerHTML = '';
    const b = this.b = el('div', 'board');
    b.style.setProperty('--w', m.w); b.style.setProperty('--h', m.h); b.style.aspectRatio = m.w + ' / ' + m.h;
    this.sq = {};
    for (let r = 0; r < m.h; r++) for (let c = 0; c < m.w; c++) {
      const s = el('div', 'sq ' + ((r + c) % 2 ? 'dark' : 'light'));
      this.pos(s, r, c); b.appendChild(s); this.sq[k(r, c)] = s;
    }
    this.layer = el('div', 'layer'); b.appendChild(this.layer);
    host.appendChild(b);
    this.els = new Map(); this.starEls = new Map();
    this.render();
    b.addEventListener('pointerdown', ev => {
      const R = b.getBoundingClientRect();
      const c = Math.floor((ev.clientX - R.left) / R.width * this.m.w), r = Math.floor((ev.clientY - R.top) / R.height * this.m.h);
      if (inb(this.m, r, c) && this.onTap) this.onTap(r, c);
    });
  }
  pos(d, r, c) { d.style.left = c * 100 / this.m.w + '%'; d.style.top = r * 100 / this.m.h + '%'; }
  setModel(m) { this.m = m; this.render(); }
  render() {
    this.layer.innerHTML = ''; this.els.clear(); this.starEls.clear();
    for (const s of this.m.stars) { const d = el('div', 'tok star', '<span>⭐</span>'); this.pos(d, ...rc(s)); this.layer.appendChild(d); this.starEls.set(s, d); }
    for (const [kk, e] of this.m.ents) {
      const d = el('div', e.kind === 'rock' ? 'tok rock' : 'tok pc ' + e.col, e.kind === 'rock' ? '<span>🌳</span>' : pieceSVG(e.t, e.col));
      this.pos(d, ...rc(kk)); this.layer.appendChild(d); this.els.set(e.id, d);
    }
    this.clearMarks();
  }
  elAt(kk) { const e = this.m.ents.get(kk); return e && this.els.get(e.id); }
  dots(list) { this.clearDots(); for (const mv of list) this.sq[k(mv.r, mv.c)].appendChild(el('div', mv.cap ? 'ring' : 'dot')); }
  clearDots() { this.b.querySelectorAll('.dot,.ring').forEach(x => x.remove()); }
  mark(keys, cls) { for (const kk of keys) this.sq[kk] && this.sq[kk].classList.add(cls); }
  unmark(cls) { this.b.querySelectorAll('.sq.' + cls).forEach(x => x.classList.remove(cls)); }
  clearMarks() { ['sel', 'check', 'danger', 'bad', 'yes'].forEach(c => this.unmark(c)); this.clearDots(); }
  wiggle(d) { if (!d) return; d.classList.remove('wiggle'); void d.offsetWidth; d.classList.add('wiggle'); }
}

/* ---------- lessons ---------- */
const PRAISE = ['Giỏi quá!', 'Tuyệt vời!', 'Hay lắm!', 'Đúng rồi!', 'Bé giỏi ghê!', 'Xuất sắc!'];
const HINT = {
  R: 'Xe chỉ đi thẳng thôi, không đi chéo nè. Chạm vào chấm tròn nhé!',
  B: 'Tượng chỉ đi chéo thôi. Chạm vào chấm tròn nhé!',
  Q: 'Hậu đi thẳng hoặc đi chéo. Chạm vào chấm tròn nhé!',
  K: 'Vua chỉ đi một bước thôi. Chạm vào chấm tròn nhé!',
  N: 'Mã nhảy hình chữ L. Chạm vào chấm tròn nhé!',
  P: 'Tốt đi thẳng lên trên, và ăn chéo. Chạm vào chấm tròn nhé!',
};
const center5 = t => ['.....', '.....', '..' + t + '..', '.....', '.....'];

function pieceWorld(t, hue, stars, caps, extra = {}) {
  const lessons = [
    { id: t + '-explore', type: 'puzzle', mode: 'explore', emoji: '👋', title: 'Làm quen',
      intro: STORY[t], say: extra.exploreSay || `Chạm chấm tròn, cho ${NAME[t]} đi 3 lần nhé!`, hint: HINT[t],
      rounds: [extra.explore || { b: center5(t), n: 3 }] },
    { id: t + '-stars', type: 'puzzle', mode: 'collect', emoji: '⭐', title: 'Nhặt sao',
      intro: `${NAME[t]} đi nhặt sao nào!`, say: 'Nhặt hết ngôi sao nhé!', hint: HINT[t], rounds: stars },
    { id: t + '-cap', type: 'puzzle', mode: 'collect', emoji: '😋', title: 'Ăn quân',
      intro: `Quân cờ có thể ăn quân đen, bằng cách đi vào ô của quân đen. ${NAME[t]} ăn quân nào!`, say: 'Ăn hết quân đen nhé!', hint: HINT[t], rounds: caps },
  ];
  return { id: t, name: NAME[t], sub: extra.sub, hue, icon: () => pieceSVG(t), lessons };
}

const WORLDS = [
  { id: 'board', name: 'Bàn cờ', sub: 'Ô vuông sáng và tối', hue: 150, icon: miniBoardSVG, lessons: [
    { id: 'board-tour', type: 'tour', emoji: '🔍', title: 'Tìm ngôi sao',
      intro: 'Đây là bàn cờ vua! Bàn cờ có rất nhiều ô vuông nhỏ.', say: 'Chạm vào ô có ngôi sao nhé!',
      rounds: [{ n: 4 }, { n: 5 }, { n: 6 }, { n: 8 }, { n: 8 }] },
    { id: 'board-colors', type: 'colors', emoji: '🎨', title: 'Ô trắng, ô xanh',
      intro: 'Các ô trên bàn cờ có hai màu, màu trắng và màu xanh, xếp xen kẽ nhau.',
      rounds: [{ dark: true }, { dark: false }, { dark: true }, { dark: false }, { dark: true }] },
  ]},
  { id: 'meet', name: 'Gặp các quân cờ', sub: '6 người bạn', hue: 280, icon: () => pieceSVG('K'), lessons: [
    { id: 'meet-hello', type: 'meet', emoji: '👋', title: 'Chào các bạn',
      intro: 'Cờ vua có 6 loại quân cờ.', say: 'Chạm vào từng quân để làm quen nhé!', rounds: [{}] },
    { id: 'meet-quiz', type: 'quiz', emoji: '❓', title: 'Đố bé',
      intro: 'Bé còn nhớ tên các quân cờ không?', rounds: () => shuffle(['R', 'B', 'Q', 'K', 'N', 'P']).map(t => ({ t })) },
  ]},
  pieceWorld('R', 25, [
    { b: ['..*..', '.....', '.....', '.....', '..R..'] },
    { b: ['.....', '.....', 'R...*', '.....', '.....'] },
    { b: ['*....', '.....', '.....', '.....', 'R...*'] },
    { b: ['*...*', '.....', '.....', '.....', 'R...*'] },
    { b: ['..*..', '..#..', '.....', '.....', '..R..'], say: 'Cây chặn đường rồi! Đi vòng nhé!' },
  ], [
    { b: ['..p..', '.....', '.....', '.....', '..R..'] },
    { b: ['p...p', '.....', '.....', '.....', 'R....'] },
    { b: ['.p...', '.....', '...p.', '.....', 'R....'] },
  ], { sub: 'Đi thẳng tắp' }),
  pieceWorld('B', 200, [
    { b: ['....*', '.....', '.....', '.....', 'B....'] },
    { b: ['*....', '.....', '.....', '.....', '....B'] },
    { b: ['..*..', '.....', '*...*', '.....', '..B..'] },
    { b: ['....*', '.....', '....#', '.....', '..B..'], say: 'Cây chặn đường rồi! Đi vòng nhé!' },
  ], [
    { b: ['p....', '.....', '.....', '.....', '....B'] },
    { b: ['..p..', '.....', '.....', '.....', '..B..'] },
    { b: ['p...p', '.....', '.....', '.....', '..B..'] },
  ], { sub: 'Đi đường chéo' }),
  pieceWorld('Q', 330, [
    { b: ['*....', '.....', '.....', '.....', 'Q....'] },
    { b: ['....*', '.....', '.....', '.....', 'Q....'] },
    { b: ['*...*', '.....', '.....', '.....', 'Q...*'] },
    { b: ['..*..', '*...*', '.....', '.#...', 'Q....'] },
  ], [
    { b: ['....p', '.....', 'p....', '.....', 'Q....'] },
    { b: ['p.p.p', '.....', '.....', '.....', '..Q..'] },
  ], { sub: 'Thẳng và chéo' }),
  pieceWorld('K', 45, [
    { b: ['.....', '.....', '..*..', '..K..', '.....'] },
    { b: ['.....', '.*...', '.....', '...K.', '.....'] },
    { b: ['*....', '.....', '.....', '.....', '....K'] },
    { b: ['.....', '.*.*.', '..K..', '.....', '.....'] },
  ], [
    { b: ['.....', '.p...', '..K..', '.....', '.....'] },
    { b: ['.....', '.p.p.', '..K..', '.....', '.....'] },
  ], { sub: 'Mỗi lần một bước' }),
  pieceWorld('N', 100, [
    { b: ['.....', '.....', '.....', '..*..', 'N....'] },
    { b: ['.*...', '.....', 'N....', '.....', '.....'] },
    { b: ['.....', '.###.', '.#N#.', '.###.', '.*...'], say: 'Mã nhảy qua cây được đó!' },
    { b: ['*...*', '.....', '.....', '.....', '..N..'] },
  ], [
    { b: ['.....', '.....', '.p...', '.....', '..N..'] },
    { b: ['p...p', '.....', '.....', '.....', '..N..'] },
    { b: ['...p.', '#####', '.....', '#####', '...N.'] },
  ], { sub: 'Nhảy chữ L' }),
  pieceWorld('P', 190, [
    { b: ['..*..', '.....', '.....', '.....', '..P..'] },
    { b: ['..*..', '.....', '..*..', '.....', '..P..'] },
  ], [
    { b: ['.....', '.....', '.....', '...p.', '..P..'], say: 'Tốt ăn chéo nhé!' },
    { b: ['.....', '.....', '.p...', '..p..', '.P...'], say: 'Tốt ăn chéo nhé!' },
    { b: ['.....', '.....', '..pp.', '.....', '..P..'], goal: 'promote', say: 'Đưa Tốt tới cuối bàn cờ nhé!' },
  ], { sub: 'Chú lính nhỏ',
       explore: { b: ['.....', '.....', '.....', '.....', '.....', '..P..'], goal: 'promote' },
       exploreSay: 'Lần đầu Tốt được đi hai ô! Đưa Tốt tới cuối bàn cờ, sẽ có điều kỳ diệu!' }),
  { id: 'who', name: 'Ai ăn được?', sub: 'Chọn đúng quân', hue: 0, icon: () => pieceSVG('N', 'b'), lessons: [
    { id: 'who-1', type: 'puzzle', mode: 'who', emoji: '🤔', title: 'Ai ăn được?',
      intro: 'Có nhiều quân cờ, nhưng chỉ một quân ăn được quân đen.', say: 'Quân nào ăn được quân đen?',
      hint: 'Chạm vào quân của bé để xem nó đi được đâu nhé!',
      rounds: [
        { b: ['..p..', '.....', 'R...B', '.....', '.....'] },
        { b: ['.....', '..p..', 'N...B', '.....', '...R.'] },
        { b: ['p....', '.....', '..Q..', '.....', '.R..K'] },
        { b: ['.....', '.....', '...p.', '..P.R', 'N....'] },
      ] },
  ]},
  { id: 'check', name: 'Bảo vệ Vua', sub: 'Chiếu tướng!', hue: 260, icon: () => pieceSVG('K'), lessons: [
    { id: 'check-escape', type: 'puzzle', mode: 'escape', emoji: '🛡️', title: 'Vua chạy trốn',
      intro: 'Khi quân đen sắp ăn được Vua, người ta gọi là chiếu tướng! Vua phải chạy tới ô an toàn.', say: 'Đưa Vua tới ô an toàn nhé!',
      hint: 'Vua đi một bước thôi. Tránh xa đường đi của quân đen nhé!',
      rounds: [
        { b: ['.....', '.....', 'r.K..', '.....', '.....'] },
        { b: ['..r..', '.....', '.....', '.....', '..K..'] },
        { b: ['b....', '.....', '.....', '...K.', '.....'] },
        { b: ['.....', '.....', '..K..', '..q..', '.....'], say: 'Vua cũng ăn được quân đen đó!' },
      ] },
  ]},
  { id: 'war', name: 'Tốt đấu Tốt', sub: 'Ván cờ đầu tiên', hue: 55, icon: () => pieceSVG('P'), lessons: [
    { id: 'war-1', type: 'war', emoji: '⚔️', title: 'Chơi với máy',
      intro: 'Trò chơi Tốt đấu Tốt! Tốt nào về tới cuối bàn cờ trước thì thắng. Bé đi trước nhé!', say: 'Đưa một Tốt về đích nhé!',
      rounds: [{ b: ['.....', 'ppppp', '.....', '.....', 'PPPPP', '.....'] }] },
  ]},
];
WORLDS.forEach(W => W.lessons.forEach(l => (l.world = W)));
const ALL = WORLDS.flatMap(W => W.lessons);
const byId = id => ALL.find(l => l.id === id);
const isUnlocked = l => { const i = ALL.indexOf(l); return S.unlockAll || i === 0 || S.done[l.id] || S.done[ALL[i - 1].id]; };

/* ---------- screens ---------- */
function show(id) { document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === id)); }

function renderMap() {
  const p = $('#path'); p.innerHTML = '';
  const next = ALL.find(l => !S.done[l.id]);
  WORLDS.forEach((W, wi) => {
    const complete = W.lessons.every(l => S.done[l.id]);
    const card = el('section', 'world' + (wi % 2 ? ' right' : ''));
    card.style.setProperty('--hue', W.hue);
    card.innerHTML = `<div class="w-head"><div class="w-ico">${W.icon()}</div><div class="w-txt"><div class="w-name">${W.name}</div><div class="w-sub">${W.sub || ''}</div></div>${complete ? '<div class="medal" title="Huy hiệu">🏅</div>' : ''}</div>`;
    const row = el('div', 'w-lessons');
    W.lessons.forEach(l => {
      const open = isUnlocked(l);
      const b = el('button', 'lesson-btn' + (S.done[l.id] ? ' done' : '') + (l === next ? ' next' : '') + (open ? '' : ' locked'),
        `<span class="lb-ico">${S.done[l.id] ? '⭐' : open ? l.emoji : '🔒'}</span><span class="lb-name">${l.title}</span>`);
      b.onclick = () => { if (!open) { SFX.no(); speak('Bé học bài trước đã nhé!'); return; } startLesson(l.id); };
      row.appendChild(b);
    });
    card.appendChild(row); p.appendChild(card);
  });
  $('#starCount').textContent = S.stars;
  const nb = p.querySelector('.next');
  if (nb) setTimeout(() => nb.scrollIntoView({ block: 'center', behavior: 'smooth' }), 120);
}

/* ---------- lesson runner ---------- */
let cur = null;
let curPrompt = '';
function setPrompt(text, spoken) { curPrompt = spoken || text; $('#promptText').textContent = text; speak(curPrompt); }

function startLesson(id) {
  const L = byId(id);
  const rounds = typeof L.rounds === 'function' ? L.rounds() : L.rounds;
  cur = { L, rounds, i: 0, token: Symbol() };
  $('#lessonTitle').textContent = `${L.world.name} · ${L.title}`;
  $('#mascot').innerHTML = pieceSVG(L.world.id.length === 1 ? L.world.id : 'P');
  show('lesson'); startRound(true);
}
function renderProgress() {
  const p = $('#progress'); p.innerHTML = '';
  cur.rounds.forEach((_, i) => p.appendChild(el('span', 'pdot' + (i < cur.i ? ' on' : i === cur.i ? ' now' : ''))));
}
function startRound(first) {
  renderProgress();
  const R = cur.rounds[cur.i], L = cur.L;
  TYPES[L.type](R, L, first);
}
function promptFor(R, L, first) { const say = R.say || L.say || ''; setPrompt(say, first && L.intro ? L.intro + ' ' + say : say); }

function roundWin(msg) {
  const tok = cur.token;
  SFX.win(); burst(14); speak(msg || pick(PRAISE));
  setTimeout(() => {
    if (!cur || cur.token !== tok) return;
    cur.i++;
    if (cur.i >= cur.rounds.length) lessonDone(); else startRound(false);
  }, 1900);
}
function lessonDone() {
  const L = cur.L, W = L.world, first = !S.done[L.id];
  S.done[L.id] = true; if (first) S.stars += 3; save();
  const worldDone = first && W.lessons.every(l => S.done[l.id]);
  $('#doneIco').innerHTML = worldDone ? `<div class="medal-big">${W.icon()}</div>` : '<div class="big-star">⭐</div>';
  $('#doneTitle').textContent = worldDone ? 'Huy hiệu mới!' : pick(PRAISE);
  $('#doneText').textContent = worldDone ? `Bé đã học xong: ${W.name}!` : `Bé đã xong bài “${L.title}”` + (first ? ' — được 3 ngôi sao!' : '!');
  const nxt = ALL[ALL.indexOf(L) + 1];
  $('#nextBtn').hidden = !nxt;
  $('#nextBtn').onclick = () => { $('#done').classList.remove('show'); startLesson(nxt.id); };
  $('#done').classList.add('show');
  SFX.magic(); burst(40);
  speak(worldDone ? `Hoan hô! Bé nhận được huy hiệu ${W.name}!` : 'Hoan hô! Bé làm xong bài rồi!');
}
function exitLesson() { cur = null; speechSynthesis && speechSynthesis.cancel(); show('map'); renderMap(); }

/* ---------- lesson types ---------- */
const TYPES = {};

TYPES.tour = (R, L, first) => {
  const n = R.n, rows = [...Array(n)].map(() => '.'.repeat(n));
  const sr = rnd(n), sc = rnd(n);
  rows[sr] = rows[sr].slice(0, sc) + '*' + rows[sr].slice(sc + 1);
  const m = parse(rows), v = new BoardView($('#stage'), m);
  let miss = 0, done = false;
  promptFor(R, L, first);
  v.onTap = (r, c) => {
    if (done) return;
    if (r === sr && c === sc) { done = true; SFX.star(); v.starEls.get(k(r, c)).classList.add('got'); v.mark([k(r, c)], 'yes'); roundWin(); }
    else { SFX.no(); v.wiggle(v.starEls.get(k(sr, sc))); if (++miss % 2 === 0) speak('Ngôi sao ở đây nè!'); }
  };
  cur.reset = () => TYPES.tour(R, L, false);
};

TYPES.colors = (R, L, first) => {
  const m = parse([...Array(8)].map(() => '........')), v = new BoardView($('#stage'), m);
  const want = R.dark ? 'màu xanh' : 'màu trắng';
  let done = false;
  promptFor({ say: `Chạm vào một ô ${want} nhé!` }, L, first);
  v.onTap = (r, c) => {
    if (done) return;
    const isDark = (r + c) % 2 === 1;
    if (isDark === R.dark) { done = true; SFX.star(); v.mark([k(r, c)], 'yes'); roundWin(); }
    else { SFX.no(); v.mark([k(r, c)], 'bad'); setTimeout(() => v.unmark('bad'), 600); speak(`Ô này ${isDark ? 'màu xanh' : 'màu trắng'}. Tìm ô ${want} nhé!`); }
  };
  cur.reset = () => TYPES.colors(R, L, false);
};

TYPES.meet = (R, L, first) => {
  const host = $('#stage'); host.innerHTML = '';
  const g = el('div', 'gallery'); host.appendChild(g);
  const seen = new Set();
  promptFor(R, L, first);
  ['R', 'B', 'Q', 'K', 'N', 'P'].forEach(t => {
    const card = el('button', 'g-card', pieceSVG(t) + `<span>${NAME[t]}</span>`);
    card.onclick = () => {
      SFX.pick(); card.classList.remove('pop'); void card.offsetWidth; card.classList.add('pop', 'seen');
      seen.add(t);
      if (seen.size === 6 && !g.dataset.done) { g.dataset.done = 1; speak(STORY[t], () => roundWin('Bé đã gặp hết các bạn quân cờ rồi!')); }
      else speak(STORY[t]);
    };
    g.appendChild(card);
  });
  cur.reset = () => TYPES.meet(R, L, false);
};

TYPES.quiz = (R, L, first) => {
  const host = $('#stage'); host.innerHTML = '';
  const others = shuffle(['R', 'B', 'Q', 'K', 'N', 'P'].filter(t => t !== R.t)).slice(0, 2);
  const g = el('div', 'gallery three'); host.appendChild(g);
  let done = false;
  promptFor({ say: `Đâu là con ${NAME[R.t]}?` }, L, first);
  shuffle([R.t, ...others]).forEach(t => {
    const card = el('button', 'g-card', pieceSVG(t));
    card.onclick = () => {
      if (done) return;
      if (t === R.t) { done = true; card.classList.add('right'); card.insertAdjacentHTML('beforeend', `<span>${NAME[t]}</span>`); roundWin(`Đúng rồi! Đây là con ${NAME[t]}!`); }
      else { SFX.no(); card.classList.remove('wiggle'); void card.offsetWidth; card.classList.add('wiggle'); speak(`Đây là con ${NAME[t]}. Tìm con ${NAME[R.t]} nhé!`); }
    };
    g.appendChild(card);
  });
  cur.reset = () => TYPES.quiz(R, L, false);
};

// Generic move-the-piece puzzle. modes: explore | collect | who | escape (+ round.goal 'promote')
TYPES.puzzle = (R, L, first) => {
  const init = parse(R.b);
  let m = clone(init);
  const v = new BoardView($('#stage'), m);
  const mode = L.mode, goal = R.goal || (L.mode === 'explore' ? 'moves' : null);
  let sel = null, legal = [], miss = 0, moved = 0, busy = false, showDanger = false;
  const tok = cur.token;
  const whites = () => piecesOf(m, 'w');
  const kingKey = () => (whites().find(([, e]) => e.t === 'K') || [])[0];

  function select(kk) {
    v.unmark('sel'); sel = kk; v.sq[kk].classList.add('sel');
    legal = moves(m, ...rc(kk));
    if (mode === 'who') legal = legal.filter(x => x.cap);
    v.dots(legal);
  }
  function deselect() { sel = null; legal = []; v.unmark('sel'); v.clearDots(); }
  function autoSel() { const w = whites(); if (w.length === 1 && mode !== 'who') select(w[0][0]); }
  function marks() {
    v.unmark('check'); v.unmark('danger');
    if (mode !== 'escape') return;
    const kk = kingKey(); if (!kk) return;
    const att = attacked(m, 'b', kk);
    if (att.has(kk)) v.sq[kk].classList.add('check');
    if (showDanger) v.mark([...att].filter(q => q !== kk), 'danger');
  }
  function reset() { m = clone(init); v.setModel(m); sel = null; moved = 0; busy = false; marks(); autoSel(); }

  v.onTap = (r, c) => {
    if (busy || !cur || cur.token !== tok) return;
    const kk = k(r, c), e = m.ents.get(kk);
    if (sel) { const mv = legal.find(x => x.r === r && x.c === c); if (mv) return doMove(sel, mv); }
    if (e && e.kind === 'pc' && e.col === 'w') {
      if (mode === 'who' && !moves(m, r, c).some(x => x.cap)) {
        SFX.no(); v.wiggle(v.els.get(e.id)); deselect();
        speak(`Con ${NAME[e.t]} không ăn được quân đen. Thử con khác nhé!`); return;
      }
      SFX.pick(); select(kk); return;
    }
    SFX.no(); miss++;
    if (sel) v.wiggle(v.elAt(sel)); else whites().forEach(([q]) => v.wiggle(v.elAt(q)));
    if (miss % 2 === 0) speak(L.hint || 'Chạm vào chấm tròn để đi nhé!');
  };

  async function doMove(from, mv) {
    busy = true;
    const before = clone(m), e = m.ents.get(from), to = k(mv.r, mv.c), tgt = m.ents.get(to);
    deselect(); v.unmark('check');
    if (tgt) { const te = v.els.get(tgt.id); te.classList.add('gone'); setTimeout(() => te.remove(), 450); }
    m.ents.delete(from); m.ents.set(to, e); e.moved = true;
    const pel = v.els.get(e.id);
    if (e.t === 'N') { pel.classList.remove('hop'); void pel.offsetWidth; pel.classList.add('hop'); }
    v.pos(pel, mv.r, mv.c);
    tgt ? SFX.cap() : SFX.move(); moved++;
    if (m.stars.has(to)) {
      m.stars.delete(to); const se = v.starEls.get(to);
      setTimeout(() => { SFX.star(); se.classList.add('got'); setTimeout(() => se.remove(), 500); }, 260);
    }
    let promoted = false;
    await sleep(420);
    if (e.t === 'P' && mv.r === 0) {
      promoted = true; e.t = 'Q'; pel.innerHTML = pieceSVG('Q', 'w'); pel.classList.add('promo'); SFX.magic(); burst(20);
      await new Promise(res => speak('Oa! Tốt đi tới cuối bàn cờ, biến thành Hậu rồi!', res));
    }
    if (!cur || cur.token !== tok) return;

    if (mode === 'escape') {
      const att = attacked(m, 'b', to);
      if (e.t === 'K' && att.has(to)) {
        SFX.no(); v.sq[to].classList.add('bad'); showDanger = true;
        await new Promise(res => speak('Ối! Ô đó nguy hiểm, quân đen ăn được Vua. Các ô màu đỏ là nguy hiểm. Thử ô khác nhé!', res));
        if (!cur || cur.token !== tok) return;
        m = before; v.setModel(m); busy = false; marks(); autoSel(); return;
      }
      return roundWin(tgt ? 'Giỏi quá! Vua ăn luôn quân đen rồi!' : 'Giỏi quá! Vua an toàn rồi!');
    }
    if (mode === 'who') return roundWin(`Đúng rồi! Con ${NAME[e.t]} ăn được!`);
    if (goal === 'moves' && moved >= (R.n || 3)) return roundWin();
    if (goal === 'promote' && promoted) return roundWin();
    if (!goal && !m.stars.size && !piecesOf(m, 'b').length) return roundWin();

    if (!allMoves(m, 'w').length) {
      speak('Ồ, hết đường đi rồi. Mình chơi lại nhé!');
      await sleep(2200); if (!cur || cur.token !== tok) return;
      return reset();
    }
    busy = false; autoSel();
  }

  promptFor(R, L, first);
  marks(); autoSel();
  cur.reset = reset;
};

// Pawn war vs a gentle computer: first pawn to the far side wins.
TYPES.war = (R, L, first) => {
  let m = parse(R.b);
  const v = new BoardView($('#stage'), m);
  let sel = null, legal = [], busy = false;
  const tok = cur.token;
  const live = () => cur && cur.token === tok;
  promptFor(R, L, first);

  function deselect() { sel = null; legal = []; v.unmark('sel'); v.clearDots(); }
  function animate(from, to) {
    const e = m.ents.get(from), tgt = m.ents.get(to);
    if (tgt) { const te = v.els.get(tgt.id); te.classList.add('gone'); setTimeout(() => te.remove(), 450); }
    m.ents.delete(from); m.ents.set(to, e); e.moved = true;
    v.pos(v.els.get(e.id), ...rc(to));
    tgt ? SFX.cap() : SFX.move();
  }
  async function restart(msg) {
    busy = true;
    await new Promise(res => speak(msg, res));
    if (!live()) return;
    m = parse(R.b); v.setModel(m); busy = false; setPrompt(R.say || L.say);
  }
  function aiMove() {
    const opts = allMoves(m, 'b');
    if (!opts.length) return null;
    const wAtt = attacked(m, 'w');
    const goal = opts.filter(o => o.r === m.h - 1);
    if (goal.length) return goal[0];
    // stop a white pawn that is about to win
    const danger = piecesOf(m, 'w').filter(([kk]) => rc(kk)[0] === 1).map(([kk]) => kk);
    const stop = opts.filter(o => o.cap && danger.includes(k(o.r, o.c)));
    if (stop.length) return stop[0];
    if (Math.random() < 0.35) return pick(opts); // keep it beatable for a 4-year-old
    const caps = opts.filter(o => o.cap);
    if (caps.length) return pick(caps);
    const safe = opts.filter(o => !wAtt.has(k(o.r, o.c)));
    return pick(safe.length ? safe : opts);
  }

  v.onTap = async (r, c) => {
    if (busy || !live()) return;
    const kk = k(r, c), e = m.ents.get(kk);
    const mv = sel && legal.find(x => x.r === r && x.c === c);
    if (!mv) {
      if (e && e.kind === 'pc' && e.col === 'w') { SFX.pick(); deselect(); sel = kk; v.sq[kk].classList.add('sel'); legal = moves(m, r, c); v.dots(legal); if (!legal.length) speak('Tốt này bị chặn rồi. Chọn Tốt khác nhé!'); }
      else { SFX.no(); speak('Chạm vào Tốt trắng của bé trước nhé!'); }
      return;
    }
    busy = true; const from = sel; deselect();
    animate(from, k(r, c));
    await sleep(500); if (!live()) return;
    if (r === 0) return roundWin('Hoan hô! Tốt của bé về đích rồi! Bé thắng!');
    if (!piecesOf(m, 'b').length) return roundWin('Hoan hô! Bé ăn hết Tốt đen rồi! Bé thắng!');
    await sleep(350);
    const ai = aiMove();
    if (!ai) return restart('Quân đen hết đường đi rồi. Hòa nhé! Mình chơi ván mới nào!');
    animate(ai.from, k(ai.r, ai.c));
    await sleep(500); if (!live()) return;
    if (ai.r === m.h - 1) return restart('Ồ, Tốt đen về đích trước rồi. Không sao, mình chơi lại nhé!');
    if (!piecesOf(m, 'w').length) return restart('Ồ, Tốt của bé bị ăn hết rồi. Mình chơi lại nhé!');
    if (!allMoves(m, 'w').length) return restart('Hết đường đi rồi, hòa nhé! Mình chơi ván mới nào!');
    busy = false;
  };
  cur.reset = () => { m = parse(R.b); v.setModel(m); deselect(); busy = false; };
};

/* ---------- confetti ---------- */
function burst(n) {
  const fx = $('#fx'), cols = ['#ff6b9a', '#ffc93c', '#6c4cf1', '#3ec7a0', '#4aa8ff', '#ff8a3d'];
  for (let i = 0; i < n; i++) {
    const p = el('i', 'conf');
    p.style.left = 50 + (Math.random() - 0.5) * 30 + 'vw'; p.style.top = '45vh';
    p.style.background = pick(cols);
    p.style.setProperty('--dx', (Math.random() - 0.5) * 90 + 'vw');
    p.style.setProperty('--dy', -(20 + Math.random() * 40) + 'vh');
    p.style.setProperty('--rot', rnd(720) + 'deg');
    fx.appendChild(p); setTimeout(() => p.remove(), 1600);
  }
}

/* ---------- parent panel ---------- */
function openParent() {
  const a = 3 + rnd(6), b = 2 + rnd(6), ans = a + b;
  $('#gateQ').textContent = `${a} + ${b} = ?`;
  const opts = shuffle([ans, ans + 1, ans - 2]);
  const go = $('#gateOpts'); go.innerHTML = '';
  opts.forEach(o => { const btn = el('button', 'big-btn alt', o); btn.onclick = () => { if (o === ans) { $('#gate').hidden = true; $('#panel').hidden = false; } else $('#parent').classList.remove('show'); }; go.appendChild(btn); });
  $('#gate').hidden = false; $('#panel').hidden = true;
  $('#optVoice').checked = S.voice; $('#optRate').value = S.rate; $('#optUnlock').checked = S.unlockAll;
  $('#voiceInfo').textContent = viVoice ? `Giọng đọc: ${viVoice.name}` : 'Chưa có giọng tiếng Việt — iPad: Cài đặt › Trợ năng › Nội dung được đọc › Giọng nói › Tiếng Việt (Linh).';
  $('#parent').classList.add('show');
}

/* ---------- wire up ---------- */
$('#brandIco').innerHTML = pieceSVG('N');
$('#startIco').innerHTML = pieceSVG('N');
$('#startBtn').onclick = () => { ac(); $('#start').classList.remove('show'); renderMap(); speak('Chào bé! Mình cùng học cờ vua nhé!'); };
$('#homeBtn').onclick = exitLesson;
$('#resetBtn').onclick = () => { if (cur && cur.reset) { SFX.pick(); cur.reset(); } };
$('#bubble').onclick = () => speak(curPrompt);
$('#toMapBtn').onclick = () => { $('#done').classList.remove('show'); exitLesson(); };
$('#parentBtn').onclick = openParent;
$('#closeParent').onclick = () => { $('#parent').classList.remove('show'); renderMap(); };
$('#optVoice').onchange = e => { S.voice = e.target.checked; save(); };
$('#optRate').oninput = e => { S.rate = +e.target.value; save(); };
$('#optUnlock').onchange = e => { S.unlockAll = e.target.checked; save(); };
$('#resetAll').onclick = () => { if (confirm('Xoá toàn bộ tiến độ của bé?')) { S.done = {}; S.stars = 0; save(); renderMap(); } };
renderMap();

if ('serviceWorker' in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded || !hadController || cur) return; reloaded = true; location.reload();
  });
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').then(reg => { reg.update(); setInterval(() => reg.update(), 60000); }).catch(() => {}));
}
