
// ══════════════════════════════════════════
//  SMOOTH AMBIENT MELODY  (Web Audio API)
//  Soft chime version of Happy Birthday
//  — slow waltz, layered harmonics, reverb
// ══════════════════════════════════════════
let audioCtx = null, musicPlaying = false;
let oscList = [], loopTimer = null;

// "Happy Birthday" in F major — slower & higher register feels warmer
// [fundamental Hz, duration s, volume 0-1]
const MELODY = [
  [349.2,0.55,0.55],[349.2,0.22,0.45],[392.0,0.72,0.6],[349.2,0.72,0.6],
  [466.2,0.72,0.58],[440.0,1.35,0.55],[0,0.18,0],
  [349.2,0.55,0.55],[349.2,0.22,0.45],[392.0,0.72,0.6],[349.2,0.72,0.6],
  [523.3,0.72,0.58],[466.2,1.35,0.55],[0,0.18,0],
  [349.2,0.55,0.55],[349.2,0.22,0.45],[698.5,0.72,0.5],[587.3,0.72,0.55],
  [466.2,0.72,0.55],[440.0,0.72,0.55],[392.0,1.1,0.5],[0,0.12,0],
  [622.3,0.55,0.5],[622.3,0.22,0.42],[587.3,0.72,0.55],[466.2,0.72,0.55],
  [523.3,0.72,0.55],[466.2,1.6,0.5]
];

// Soft chord pads played underneath the melody (very quiet)
const PADS = [
  [174.6,4.0,0.04],[220.0,4.0,0.03],[261.6,4.0,0.03], // F major root
  [233.1,4.0,0.03],[293.7,4.0,0.03],[349.2,4.0,0.03]  // Bb major
];

function initCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

// Play a single chime note with harmonics + long soft decay (like a music box)
function playChime(freq, startT, dur, vol) {
  if (freq === 0) return; // rest
  const harmonics = [1, 2, 3, 4.2]; // fundamental + overtones
  const harmVols  = [1, 0.35, 0.15, 0.06];

  harmonics.forEach((mult, i) => {
    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = i === 0 ? 'sine' : 'sine';
    osc.frequency.value = freq * mult;

    const pk = vol * harmVols[i] * 0.13;
    // Quick attack, very long exponential decay — the "chime" shape
    gain.gain.setValueAtTime(0, startT);
    gain.gain.linearRampToValueAtTime(pk, startT + 0.035);
    gain.gain.exponentialRampToValueAtTime(pk * 0.001, startT + Math.max(dur * 2.2, 1.8));

    osc.start(startT);
    osc.stop(startT + Math.max(dur * 2.5, 2.0));
    oscList.push(osc);
  });
}

// Warm background pad chord
function playPad(freq, startT, dur, vol) {
  const osc  = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain); gain.connect(audioCtx.destination);
  osc.type = 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, startT);
  gain.gain.linearRampToValueAtTime(vol, startT + 0.8);
  gain.gain.setValueAtTime(vol, startT + dur - 0.8);
  gain.gain.linearRampToValueAtTime(0, startT + dur);
  osc.start(startT); osc.stop(startT + dur);
  oscList.push(osc);
}

function scheduleMelody() {
  initCtx();
  let t = audioCtx.currentTime + 0.1;

  // Schedule melody notes
  MELODY.forEach(([freq, dur, vol]) => {
    playChime(freq, t, dur, vol);
    t += dur;
  });

  const total = MELODY.reduce((s,[,d])=>s+d, 0);

  // Schedule two pad chord swells underneath
  const padStart = audioCtx.currentTime + 0.1;
  const halfWay  = padStart + total / 2;
  PADS.slice(0,3).forEach(([f,,v]) => playPad(f, padStart, total * 0.52, v));
  PADS.slice(3).forEach(([f,,v])   => playPad(f, halfWay,  total * 0.52, v));

  loopTimer = setTimeout(scheduleMelody, (total + 1.2) * 1000);
}

function stopMelody() {
  clearTimeout(loopTimer); loopTimer = null;
  oscList.forEach(o => { try { o.stop(); } catch(_e){} });
  oscList = [];
}

function toggleMusic() {
  if (!musicPlaying) {
    scheduleMelody();
    musicPlaying = true;
    document.getElementById('music-toggle').textContent = 'Mute 🔇';
    document.getElementById('music-icon').classList.add('spinning');
  } else {
    stopMelody();
    musicPlaying = false;
    document.getElementById('music-toggle').textContent = 'Play ▶';
    document.getElementById('music-icon').classList.remove('spinning');
  }
}

// Auto-start on first click anywhere (browser autoplay policy)
let audioStarted = false;
function tryStartAudio() {
  if (!audioStarted) { audioStarted = true; toggleMusic(); }
}
document.addEventListener('click',   tryStartAudio, { once: true });
document.addEventListener('keydown', tryStartAudio, { once: true });

// ══════════════════════════════════════════
//  SLIDESHOW
// ══════════════════════════════════════════
const slides    = Array.from(document.querySelectorAll('.slide'));
const dotsEl    = document.getElementById('dots');
const thumbEl   = document.getElementById('thumb-strip');
const counterEl = document.getElementById('slide-counter');
let current = 0, autoplay = true, autoTimer = null;

// Build dots + thumbnails dynamically
slides.forEach((slide, i) => {
  // Dot
  const dot = document.createElement('button');
  dot.className = 'dot' + (i === 0 ? ' active' : '');
  dot.setAttribute('aria-label', 'Go to slide ' + (i+1));
  dot.onclick = () => { resetAuto(); goTo(i); };
  dotsEl.appendChild(dot);

  // Thumbnail
  const thumb = document.createElement('div');
  thumb.className = 'thumb' + (i === 0 ? ' active' : '');
  thumb.onclick = () => { resetAuto(); goTo(i); };
  const img = slide.querySelector('img');
  if (img) {
    const ti = document.createElement('img'); ti.src = img.src; ti.alt = '';
    thumb.appendChild(ti);
  } else {
    const tp = document.createElement('div');
    tp.className = 'thumb-placeholder';
    tp.textContent = String(i + 1).padStart(2, '0');
    thumb.appendChild(tp);
  }
  thumbEl.appendChild(thumb);
});

const allDots   = () => document.querySelectorAll('.dot');
const allThumbs = () => document.querySelectorAll('.thumb');

function updateCaption(i) {
  document.getElementById('caption-title').textContent = slides[i].dataset.caption || '';
  document.getElementById('caption-year').textContent  = slides[i].dataset.year   || '';
}

function goTo(n) {
  slides[current].classList.remove('active');
  allDots()[current].classList.remove('active');
  allThumbs()[current].classList.remove('active');

  current = ((n % slides.length) + slides.length) % slides.length;

  slides[current].classList.add('active');
  allDots()[current].classList.add('active');
  const t = allThumbs()[current];
  t.classList.add('active');
  t.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });

  counterEl.textContent = `${current + 1} / ${slides.length}`;
  updateCaption(current);
}

function changeSlide(dir) { resetAuto(); goTo(current + dir); }

function resetAuto() {
  clearInterval(autoTimer);
  if (autoplay) autoTimer = setInterval(() => goTo(current + 1), 4200);
}

function toggleAutoplay() {
  autoplay = !autoplay;
  const btn = document.getElementById('play-btn');
  if (autoplay) { btn.textContent = '⏸ Pause'; btn.classList.add('active'); resetAuto(); }
  else          { btn.textContent = '▶ Play';  btn.classList.remove('active'); clearInterval(autoTimer); }
}

updateCaption(0);
resetAuto();

// Keyboard nav
document.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft')  changeSlide(-1);
  if (e.key === 'ArrowRight') changeSlide(1);
  if (e.key === ' ') { e.preventDefault(); toggleAutoplay(); }
});

// Swipe support
let tx = null;
const stage = document.getElementById('stage');
stage.addEventListener('touchstart', e => { tx = e.touches[0].clientX; }, { passive: true });
stage.addEventListener('touchend',   e => {
  if (tx === null) return;
  const dx = e.changedTouches[0].clientX - tx;
  if (Math.abs(dx) > 44) changeSlide(dx < 0 ? 1 : -1);
  tx = null;
});

// ══════════════════════════════════════════
//  COUNTDOWN
// ══════════════════════════════════════════
function updateCountdown() {
  const now  = new Date();
  let bday   = new Date(now.getFullYear(), 5, 6);
  if (now > bday) bday = new Date(now.getFullYear() + 1, 5, 6);
  const diff    = bday - now;
  const isToday = now.getMonth() === 5 && now.getDate() === 6;
  const heading = document.getElementById('countdown-heading');
  const msg     = document.getElementById('birthday-message');

  if (isToday) {
    heading.textContent = "🎉 It's Birthday Time! 🎉";
    ['cd-days','cd-hours','cd-mins','cd-secs'].forEach(id => document.getElementById(id).textContent = '00');
    msg.textContent = '🎂 Happy Birthday Satwika!! Today is YOUR day! 🎂';
    launchConfetti();
    return;
  }
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  document.getElementById('cd-days').textContent  = String(d).padStart(2,'0');
  document.getElementById('cd-hours').textContent = String(h).padStart(2,'0');
  document.getElementById('cd-mins').textContent  = String(m).padStart(2,'0');
  document.getElementById('cd-secs').textContent  = String(s).padStart(2,'0');
  if (d === 0) msg.textContent = '⏰ Tomorrow is the big day — get ready! 🥳';
  else if (d <= 7) msg.textContent = `✨ Only ${d} day${d>1?'s':''} to go — the excitement is building! 🎀`;
  else msg.textContent = `🌸 Satwika's special day is coming soon! 🌸`;
}

// ══════════════════════════════════════════
//  AGE
// ══════════════════════════════════════════
(function computeAge() {
  const now = new Date();
  let age = now.getFullYear() - 2007;
  if (now.getMonth() < 5 || (now.getMonth() === 5 && now.getDate() < 6)) age--;
  document.getElementById('age-display').textContent = age;
})();

updateCountdown();
setInterval(updateCountdown, 1000);

// ══════════════════════════════════════════
//  CONFETTI
// ══════════════════════════════════════════
const canvas = document.getElementById('confetti-canvas');
const ctx    = canvas.getContext('2d');
let pieces = [], animId = null;
const COLORS = ['#e8517a','#c9a0dc','#d4a843','#7a3558','#f7bcd0','#f5e0a0','#c03060','#ff85b3'];

(function resize() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  window.addEventListener('resize', resize);
})();

function Piece() {
  this.x = Math.random() * canvas.width;
  this.y = Math.random() * -canvas.height;
  this.w = 8 + Math.random() * 10; this.h = 4 + Math.random() * 6;
  this.color = COLORS[Math.floor(Math.random() * COLORS.length)];
  this.angle = Math.random() * Math.PI * 2;
  this.spin  = (Math.random() - 0.5) * 0.15;
  this.vx = (Math.random() - 0.5) * 3;
  this.vy = 2 + Math.random() * 4;
  this.opacity = 1;
}
Piece.prototype.update = function() {
  this.y += this.vy; this.x += this.vx; this.angle += this.spin;
  if (this.y > canvas.height + 20) this.opacity = 0;
};
Piece.prototype.draw = function() {
  ctx.save(); ctx.globalAlpha = this.opacity;
  ctx.translate(this.x, this.y); ctx.rotate(this.angle);
  ctx.fillStyle = this.color;
  ctx.fillRect(-this.w/2, -this.h/2, this.w, this.h);
  ctx.restore();
};
function animateConfetti() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  pieces.forEach(p => { p.update(); p.draw(); });
  pieces = pieces.filter(p => p.opacity > 0);
  if (pieces.length > 0) animId = requestAnimationFrame(animateConfetti);
  else { ctx.clearRect(0,0,canvas.width,canvas.height); animId = null; }
}
function launchConfetti() {
  for (let i = 0; i < 200; i++) pieces.push(new Piece());
  if (!animId) animateConfetti();
}
setTimeout(launchConfetti, 1000);