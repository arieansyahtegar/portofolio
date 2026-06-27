/* ══════════════════════════════════════════════
   Portfolio — Spatial Navigation & Tech Engine
   ══════════════════════════════════════════════

   Page Grid:
              [projects]  (row 0, col 1)
   [skills]   [home]      [contact]
   (row 1,    (row 1,     (row 1,
    col 0)     col 1)      col 2)
*/

// ─── Page Configuration ───
const PAGE_CONFIG = {
  home:     { col: 1, row: 1 },
  skills:   { col: 0, row: 1 },
  projects: { col: 1, row: 0 },
  contact:  { col: 2, row: 1 },
};

// Navigation map: from each page, which directions are available
const NAV_MAP = {
  home:     { left: 'skills', up: 'projects', right: 'contact' },
  skills:   { right: 'home' },
  projects: { down: 'home' },
  contact:  { left: 'home' },
};

// Hint labels
const HINT_LABELS = {
  home:     { left: 'skills', up: 'projects', right: 'contact' },
  skills:   { right: 'home' },
  projects: { down: 'home' },
  contact:  { left: 'home' },
};

let currentPage = 'home';
let isTransitioning = false;

// ─── Init ───
document.addEventListener('DOMContentLoaded', () => {
  // Initialize Tech Modules First
  SoundManager.init();
  ParticleBackground.init();
  TerminalCLI.init();
  initHoverSounds();

  // Core navigation & visual setups
  updateView(false);
  initTypingEffect();
  initCursorGlow();
  initDockListeners();
  initMobileNavListeners();
  initKeyboard();
  initSwipe();
  initDiscordCopy();

  setTimeout(() => {
    const pages = document.getElementById('pages');
    const ambient = document.getElementById('ambientBg');
    if (pages) pages.classList.remove('no-transition');
    if (ambient) ambient.classList.remove('no-transition');
  }, 150);
});

// ─── Web Audio API Sound Generator & Synthesizer ───
const SoundManager = {
  ctx: null,
  enabled: true,

  // Ambient backsound nodes
  musicGain: null,
  musicOscs: [],
  musicLfo: null,
  isPlayingMusic: false,

  init() {
    const btn = document.getElementById('soundBtn');
    const control = document.getElementById('soundControl');
    if (!btn || !control) return;

    // Set initial visual state
    control.classList.toggle('muted', !this.enabled);

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.getOrCreateContext(); // Unlock audio context on direct button click
      this.enabled = !this.enabled;
      control.classList.toggle('muted', !this.enabled);
      document.querySelector('#soundControl .sound-status').textContent = `sfx: ${this.enabled ? 'on' : 'off'}`;
      
      const icon = btn.querySelector('i');
      if (this.enabled) {
        icon.className = 'fa-solid fa-volume-high';
        this.playSuccess();
      } else {
        icon.className = 'fa-solid fa-volume-xmark';
      }
    });

    // Create and resume context on click/keypress to satisfy browser autoplay policies
    const unlock = () => {
      this.getOrCreateContext();
      document.removeEventListener('click', unlock);
      document.removeEventListener('keydown', unlock);
    };
    document.addEventListener('click', unlock);
    document.addEventListener('keydown', unlock);
  },

  getOrCreateContext() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  },

  playTone(freq, type, duration, volume, slideToFreq = null) {
    if (!this.enabled) return;
    try {
      const context = this.getOrCreateContext();
      if (context.state === 'suspended') {
        return; // Prevent queueing audio nodes while context is suspended to avoid first-click volume spikes
      }
      const osc = context.createOscillator();
      const gainNode = context.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, context.currentTime);

      if (slideToFreq) {
        osc.frequency.exponentialRampToValueAtTime(slideToFreq, context.currentTime + duration);
      }

      gainNode.gain.setValueAtTime(volume, context.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);

      osc.connect(gainNode);
      gainNode.connect(context.destination);

      osc.start();
      osc.stop(context.currentTime + duration);
    } catch (e) {
      console.warn('Web Audio error:', e);
    }
  },

  playClick() {
    this.playTone(600, 'sine', 0.08, 0.08, 150);
  },

  playHover() {
    this.playTone(880, 'sine', 0.03, 0.015);
  },

  playGlide() {
    this.playTone(150, 'triangle', 0.45, 0.1, 320);
  },

  playType() {
    const pitch = 250 + Math.random() * 150;
    this.playTone(pitch, 'sine', 0.04, 0.04, 80);
  },

  playSuccess() {
    this.playTone(523.25, 'sine', 0.12, 0.05); // C5
    setTimeout(() => this.playTone(659.25, 'sine', 0.22, 0.05), 60); // E5
  },

  playError() {
    this.playTone(180, 'triangle', 0.1, 0.08);
    setTimeout(() => this.playTone(130, 'triangle', 0.15), 70);
  }
};

// ─── Interactive Motherboard Circuit Board Background ───
const ParticleBackground = {
  canvas: null,
  ctx: null,
  packets: [],  // Moving data packets
  maxPackets: 22,
  traces: [],   // Self-drawing circuit paths
  maxTraces: 6,
  mouse: { x: null, y: null, active: false, rx: 0, ry: 0 },
  animationFrameId: null,

  init() {
    this.canvas = document.getElementById('bgCanvas');
    if (!this.canvas) return;

    this.ctx = this.canvas.getContext('2d');
    this.resize();

    window.addEventListener('resize', () => this.resize());
    
    document.addEventListener('mousemove', (e) => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
      this.mouse.active = true;
    }, { passive: true });

    document.addEventListener('mouseleave', () => {
      this.mouse.active = false;
    });

    // Populate data packets
    this.packets = [];
    for (let i = 0; i < this.maxPackets; i++) {
      this.packets.push(this.createPacket());
    }

    this.animate();
  },

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  },

  createPacket() {
    const isHorizontal = Math.random() > 0.5;
    const gridLine = Math.floor(Math.random() * 30) * 80;
    return {
      x: isHorizontal ? Math.random() * this.canvas.width : gridLine,
      y: isHorizontal ? gridLine : Math.random() * this.canvas.height,
      vx: isHorizontal ? (Math.random() > 0.5 ? 0.55 : -0.55) : 0,
      vy: isHorizontal ? 0 : (Math.random() > 0.5 ? 0.55 : -0.55),
      text: Math.random() > 0.5 ? '0x' + Math.floor(Math.random() * 256).toString(16).toUpperCase() : (Math.random() > 0.5 ? '1' : '0'),
      alpha: 0.12 + Math.random() * 0.18,
      size: 7 + Math.random() * 4,
      isHorizontal: isHorizontal
    };
  },

  spawnPacket(x, y) {
    if (this.packets.length > 60) {
      const oldestCustomIdx = this.packets.findIndex(p => p.isSpawned);
      if (oldestCustomIdx !== -1) {
        this.packets.splice(oldestCustomIdx, 1);
      } else {
        this.packets.shift();
      }
    }
    const isHorizontal = Math.random() > 0.5;
    this.packets.push({
      x: x,
      y: y,
      vx: isHorizontal ? (Math.random() > 0.5 ? 0.95 : -0.95) : 0,
      vy: isHorizontal ? 0 : (Math.random() > 0.5 ? 0.95 : -0.95),
      text: Math.random() > 0.5 ? '0x' + Math.floor(Math.random() * 256).toString(16).toUpperCase() : (Math.random() > 0.5 ? '1' : '0'),
      alpha: 0.9,
      size: 9 + Math.random() * 3,
      isHorizontal: isHorizontal,
      isSpawned: true
    });
  },

  createTrace() {
    const isHorizontal = Math.random() > 0.5;
    const startX = Math.random() * this.canvas.width;
    const startY = Math.random() * this.canvas.height;
    
    // Create segment path with 45-degree bends (motherboard layout)
    const length1 = 50 + Math.random() * 100;
    const length2 = 30 + Math.random() * 70;
    const angle = Math.random() > 0.5 ? Math.PI / 4 : -Math.PI / 4;
    
    const x2 = startX + (isHorizontal ? length1 : 0);
    const y2 = startY + (isHorizontal ? 0 : length1);
    
    const x3 = x2 + Math.cos(angle) * length2;
    const y3 = y2 + Math.sin(angle) * length2;

    return {
      points: [{x: startX, y: startY}, {x: x2, y: y2}, {x: x3, y: y3}],
      progress: 0,
      speed: 0.008 + Math.random() * 0.012,
      alpha: 0.08 + Math.random() * 0.16,
      color: Math.random() > 0.5 ? 'rgba(34, 211, 238, ' : 'rgba(167, 139, 250, ' // Cyan or Purple tint
    };
  },

  animate() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const width = this.canvas.width;
    const height = this.canvas.height;

    // 1. Spawning and rendering self-drawing circuit board traces
    if (this.traces.length < this.maxTraces && Math.random() < 0.015) {
      this.traces.push(this.createTrace());
    }

    for (let i = this.traces.length - 1; i >= 0; i--) {
      const t = this.traces[i];
      t.progress += t.speed;
      if (t.progress >= 1.6) {
        this.traces.splice(i, 1);
        continue;
      }

      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.moveTo(t.points[0].x, t.points[0].y);

      const p = t.progress;
      let alpha = t.alpha;
      if (p > 1.0) {
        alpha *= (1.6 - p) * 1.6; // Fade out line
      }

      this.ctx.strokeStyle = t.color + `${alpha})`;
      this.ctx.fillStyle = t.color + `${alpha})`;

      if (p <= 0.5) {
        const ratio = p * 2;
        const targetX = t.points[0].x + (t.points[1].x - t.points[0].x) * ratio;
        const targetY = t.points[0].y + (t.points[1].y - t.points[0].y) * ratio;
        this.ctx.lineTo(targetX, targetY);
        this.ctx.stroke();
      } else {
        this.ctx.lineTo(t.points[1].x, t.points[1].y);
        
        const ratio = Math.min(1, (p - 0.5) * 2);
        const targetX = t.points[1].x + (t.points[2].x - t.points[1].x) * ratio;
        const targetY = t.points[1].y + (t.points[2].y - t.points[1].y) * ratio;
        this.ctx.lineTo(targetX, targetY);
        this.ctx.stroke();

        // Node dot at end
        if (ratio > 0) {
          this.ctx.beginPath();
          this.ctx.arc(targetX, targetY, 2, 0, Math.PI * 2);
          this.ctx.fill();
        }
      }
    }

    // 2. Draw radar tracker under mouse cursor
    if (this.mouse.active && this.mouse.x !== null) {
      this.mouse.rx += (this.mouse.x - this.mouse.rx) * 0.06;
      this.mouse.ry += (this.mouse.y - this.mouse.ry) * 0.06;

      const rx = this.mouse.rx;
      const ry = this.mouse.ry;

      // Draw crosshairs
      this.ctx.strokeStyle = 'rgba(34, 211, 238, 0.03)';
      this.ctx.beginPath();
      this.ctx.moveTo(rx - 25, ry);
      this.ctx.lineTo(rx + 25, ry);
      this.ctx.moveTo(rx, ry - 25);
      this.ctx.lineTo(rx, ry + 25);
      this.ctx.stroke();

      // Draw compass target ring
      this.ctx.beginPath();
      this.ctx.arc(rx, ry, 18, 0, Math.PI * 2);
      this.ctx.stroke();

      // Corner brackets
      this.ctx.strokeStyle = 'rgba(34, 211, 238, 0.05)';
      const size = 30;
      const gap = 8;
      // Top Left
      this.ctx.beginPath();
      this.ctx.moveTo(rx - size, ry - size + gap);
      this.ctx.lineTo(rx - size, ry - size);
      this.ctx.lineTo(rx - size + gap, ry - size);
      // Top Right
      this.ctx.moveTo(rx + size, ry - size + gap);
      this.ctx.lineTo(rx + size, ry - size);
      this.ctx.lineTo(rx + size - gap, ry - size);
      // Bottom Left
      this.ctx.moveTo(rx - size, ry + size - gap);
      this.ctx.lineTo(rx - size, ry + size);
      this.ctx.lineTo(rx - size + gap, ry + size);
      // Bottom Right
      this.ctx.moveTo(rx + size, ry + size - gap);
      this.ctx.lineTo(rx + size, ry + size);
      this.ctx.lineTo(rx + size - gap, ry + size);
      this.ctx.stroke();

      // Live coordinate readout
      this.ctx.fillStyle = 'rgba(34, 211, 238, 0.07)';
      this.ctx.font = '7px "JetBrains Mono", monospace';
      this.ctx.fillText(`LOC: [${Math.floor(rx)}, ${Math.floor(ry)}]`, rx + 38, ry - 6);
      this.ctx.fillText(`SYS: STAT_OK`, rx + 38, ry + 4);
    }

    // 3. Update and draw floating hex/binary data packets
    for (let i = this.packets.length - 1; i >= 0; i--) {
      const p = this.packets[i];
      p.x += p.vx;
      p.y += p.vy;

      if (p.isSpawned) {
        p.alpha -= 0.007;
        if (p.alpha <= 0) {
          this.packets.splice(i, 1);
          continue;
        }
      } else {
        if (p.x < -40) p.x = width + 40;
        if (p.x > width + 40) p.x = -40;
        if (p.y < -40) p.y = height + 40;
        if (p.y > height + 40) p.y = -40;
      }

      this.ctx.fillStyle = `rgba(34, 211, 238, ${p.alpha})`;
      this.ctx.font = `${p.size}px "JetBrains Mono", monospace`;
      this.ctx.fillText(p.text, p.x, p.y);

      this.ctx.fillStyle = `rgba(34, 211, 238, 0.03)`;
      this.ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
    }

    this.animationFrameId = requestAnimationFrame(() => this.animate());
  }
};

// ─── Terminal CLI Shell Command Interpreter ───
const TerminalCLI = {
  input: null,
  history: null,

  init() {
    this.input = document.getElementById('shellInput');
    this.history = document.getElementById('shellHistory');
    if (!this.input || !this.history) return;

    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const cmd = this.input.value.trim();
        if (cmd) {
          this.execute(cmd);
          this.triggerFlash();
        }
        this.input.value = '';
        this.input.blur(); // Close mobile virtual keyboard panel
      } else if (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Delete') {
        SoundManager.playType();
      }
    });

    const shell = document.querySelector('.terminal-shell');
    if (shell) {
      shell.addEventListener('click', () => {
        this.input.focus();
      });
    }

    this.printOutput("Welcome to Arieansyah's Shell.\nType 'help' for instructions.", "success");
  },

  triggerFlash() {
    const shell = document.querySelector('.terminal-shell');
    if (shell) {
      shell.classList.remove('terminal-shell--flash');
      void shell.offsetWidth; // Force reflow
      shell.classList.add('terminal-shell--flash');
      setTimeout(() => {
        shell.classList.remove('terminal-shell--flash');
      }, 400);
    }
  },

  printCommand(cmd) {
    const line = document.createElement('div');
    line.className = 'terminal-shell__history-line';
    line.innerHTML = `
      <span class="terminal-shell__user">visitor@arieansyah</span><span class="terminal-shell__sep">:</span><span class="terminal-shell__dir">~</span><span class="terminal-shell__char">$</span>
      <span class="terminal-shell__history-command">${this.escapeHTML(cmd)}</span>
    `;
    this.history.appendChild(line);
    this.scrollToBottom();
  },

  printOutput(text, status = '') {
    const line = document.createElement('div');
    line.className = 'terminal-shell__history-line';
    const output = document.createElement('pre');
    output.className = `terminal-shell__history-output ${status}`;
    output.textContent = text;
    line.appendChild(output);
    this.history.appendChild(line);
    this.scrollToBottom();
  },

  scrollToBottom() {
    this.history.scrollTop = this.history.scrollHeight;
  },

  escapeHTML(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  },

  execute(rawCmd) {
    this.printCommand(rawCmd);
    
    const cmdParts = rawCmd.trim().toLowerCase().split(/\s+/);
    const command = cmdParts[0];

    switch (command) {
      case 'help':
        const helpText = [
          "Available Commands:",
          "  help       - Show help menu",
          "  clear      - Clear history",
          "  home       - Go to Home page",
          "  skills     - Go to Skills page",
          "  projects   - Go to Projects page",
          "  contact    - Go to Contact page",
          "  about      - Display bio",
          "  matrix     - Run matrix code rain",
          "  beep       - Run audio diagnostics"
        ].join('\n');
        this.printOutput(helpText);
        SoundManager.playSuccess();
        break;

      case 'clear':
        this.history.innerHTML = '';
        this.printOutput("Welcome to Arieansyah's Shell.\nType 'help' for instructions.", "success");
        this.triggerFlash();
        break;

      case 'home':
      case 'contact':
        this.printOutput(`Navigating to ${command}...`, 'success');
        goToPage(command);
        break;

      case 'skills':
        const skillsTable = [
          "+----------------------------------------+",
          "| TECHNICAL SKILLS INDEX                 |",
          "+----------------------------------------+",
          "| HTML       [Markup]        - 4.5 / 5.0 |",
          "| CSS        [Styling]       - 4.0 / 5.0 |",
          "| PHP        [Backend]       - 3.5 / 5.0 |",
          "| MySQL      [Database]      - 3.0 / 5.0 |",
          "| JavaScript [Logic]         - 4.0 / 5.0 |",
          "+----------------------------------------+"
        ].join('\n');
        this.printOutput(skillsTable, 'success');
        this.printOutput("Loading Skills panel...", "success");
        goToPage('skills');
        break;

      case 'projects':
        const projectsTable = [
          "+----------------------------------------+",
          "| PROJECT REPOSITORY INDEX               |",
          "+----------------------------------------+",
          "| 1. Sikubi   [Vue, PHP, CSS]   - Done   |",
          "| 2. 71Market [Blade, PHP, CSS] - Done   |",
          "| 3. wwmboost [HTML, CSS, JS]   - Active |",
          "+----------------------------------------+",
        ].join('\n');
        this.printOutput(projectsTable, 'success');
        this.printOutput("Loading Projects panel...", "success");
        goToPage('projects');
        break;

      case 'matrix':
        this.printOutput("Initializing decryption...", "success");
        SoundManager.playTone(440, 'sine', 0.2, 0.05, 880);
        
        const mLine = document.createElement('div');
        mLine.className = 'terminal-shell__history-line';
        const mPre = document.createElement('pre');
        mPre.className = 'terminal-shell__history-output success';
        mPre.style.color = '#34d399';
        mPre.style.lineHeight = '1.3';
        mPre.style.fontWeight = 'bold';
        mLine.appendChild(mPre);
        this.history.appendChild(mLine);
        this.scrollToBottom();

        this.input.disabled = true;

        let frame = 0;
        const maxFrames = 25;
        const widthCols = 24;
        const heightRows = 6;
        
        const interval = setInterval(() => {
          let matrixString = "";
          for (let r = 0; r < heightRows; r++) {
            let rowText = "";
            for (let c = 0; c < widthCols; c++) {
              if (Math.random() > 0.35) {
                const charList = "01$#@%&*+=?<>[]{}";
                rowText += charList[Math.floor(Math.random() * charList.length)] + " ";
              } else {
                rowText += "  ";
              }
            }
            matrixString += rowText + "\n";
          }
          mPre.textContent = matrixString;
          this.scrollToBottom();
          SoundManager.playType();

          frame++;
          if (frame >= maxFrames) {
            clearInterval(interval);
            mPre.textContent += "\n[ DECRYPTION COMPLETE ]\nSystem status: SECURE.";
            this.input.disabled = false;
            this.input.focus();
            this.scrollToBottom();
            SoundManager.playSuccess();
          }
        }, 90);
        break;

      case 'about':
        const aboutText = [
          "Name   : Arieansyah Tegar",
          "Role   : Informatics Engineering Student",
          "Focus  : Web Development, Database Management",
          "Motto  : Only the most broken people who can be a great leaders"
        ].join('\n');
        this.printOutput(aboutText);
        SoundManager.playSuccess();
        break;

      case 'beep':
        this.printOutput("Synthesizer diagnostics: sweep frequency tone.", "success");
        SoundManager.playTone(330, 'triangle', 0.4, 0.08, 660);
        break;

      default:
        this.printOutput(`command not found: '${command}'. Type 'help' to see system commands.`, 'error');
        SoundManager.playError();
        break;
    }
  }
};

// ─── Attach Audio to Hover & Clicks ───
function initHoverSounds() {
  const hoverables = document.querySelectorAll('.btn, .dock__node, .dir-hint, .contact-item, .proj-card-v4__link, .skill-card, .proj-card-v4, .mobile-nav__item');
  hoverables.forEach(el => {
    el.addEventListener('mouseenter', (e) => {
      SoundManager.playHover();
      
      const rect = el.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      ParticleBackground.spawnPacket(x, y);
    });
    el.addEventListener('click', () => {
      SoundManager.playClick();
    });
  });
}

// ─── Mobile Navigation Bar Listeners ───
function initMobileNavListeners() {
  document.querySelectorAll('.mobile-nav__item').forEach(item => {
    item.addEventListener('click', () => {
      const page = item.dataset.page;
      if (page) goToPage(page);
    });
  });
}

// ─── Navigate to page ───
function goToPage(pageName) {
  if (isTransitioning || pageName === currentPage) return;
  if (!PAGE_CONFIG[pageName]) return;

  isTransitioning = true;
  currentPage = pageName;
  updateView(true);
  
  // Play slide glide sweep sound
  SoundManager.playGlide();

  setTimeout(() => {
    isTransitioning = false;
  }, 1000);
}

// ─── Navigate by direction ───
function navigateTo(direction) {
  const target = NAV_MAP[currentPage]?.[direction];
  if (target) goToPage(target);
}

// ─── Update view (pages, dock, hints) ───
function updateView(animate) {
  const config = PAGE_CONFIG[currentPage];

  // Move pages container (home is at col 1, row 1 — so offset from there)
  const offsetX = -config.col * 100;
  const offsetY = -config.row * 100;
  const pagesEl = document.getElementById('pages');
  const ambientEl = document.getElementById('ambientBg');

  pagesEl.style.transform = `translate(${offsetX}vw, ${offsetY}vh)`;
  // Parallax on ambient background
  ambientEl.style.transform = `translate(${offsetX * 0.4}vw, ${offsetY * 0.4}vh)`;

  // Page visibility
  document.querySelectorAll('.page').forEach(p => p.classList.remove('page--active'));
  const activePage = document.getElementById('page-' + currentPage);
  if (animate) {
    setTimeout(() => activePage.classList.add('page--active'), 200);
  } else {
    activePage.classList.add('page--active');
  }

  // Update dock if elements exist
  document.querySelectorAll('.dock__node').forEach(n => {
    n.classList.toggle('active', n.dataset.page === currentPage);
  });
  const dockCurrentEl = document.getElementById('dockCurrent');
  if (dockCurrentEl) {
    dockCurrentEl.textContent = `>_ ${currentPage}`;
  }

  // Update mobile navigation items active state
  document.querySelectorAll('.mobile-nav__item').forEach(n => {
    n.classList.toggle('active', n.dataset.page === currentPage);
  });

  // Update directional hints
  updateHints();

  if (currentPage === 'skills') {
    animateSkills();
  }
}

// ─── Skills Level Rating Dots Animation ───
function animateSkills() {
  const cards = document.querySelectorAll('.skill-card');
  
  // 1. Reset all dots immediately so they start empty during the slide transition
  cards.forEach(card => {
    const dotsContainer = card.querySelector('.skill-card__dots');
    if (dotsContainer) {
      dotsContainer.querySelectorAll('.dot').forEach(dot => {
        dot.className = 'dot';
      });
    }
  });

  // 2. Stagger-animate filling the dots after the slide is mostly finished (750ms delay)
  setTimeout(() => {
    cards.forEach(card => {
      const dotsContainer = card.querySelector('.skill-card__dots');
      if (!dotsContainer) return;
      
      const rating = parseFloat(dotsContainer.dataset.rating || 0);
      const dots = dotsContainer.querySelectorAll('.dot');
      
      dots.forEach((dot, index) => {
        setTimeout(() => {
          if (currentPage !== 'skills') return;
          
          const targetRating = index + 1;
          if (rating >= targetRating) {
            dot.classList.add('on');
          } else if (rating === targetRating - 0.5) {
            dot.classList.add('half');
          }
        }, index * 120);
      });
    });
  }, 750);
}

// ─── Directional hints ───
function updateHints() {
  const dirs = ['up', 'down', 'left', 'right'];
  const nav = NAV_MAP[currentPage] || {};
  const labels = HINT_LABELS[currentPage] || {};

  dirs.forEach(dir => {
    const hint = document.getElementById('hint' + dir.charAt(0).toUpperCase() + dir.slice(1));
    const label = document.getElementById('hint' + dir.charAt(0).toUpperCase() + dir.slice(1) + 'Label');

    if (nav[dir]) {
      hint.classList.add('visible');
      if (label) label.textContent = labels[dir] || '';
    } else {
      hint.classList.remove('visible');
    }
  });
}

// ─── Dock click listeners ───
function initDockListeners() {
  document.querySelectorAll('.dock__node').forEach(node => {
    node.addEventListener('click', () => {
      const page = node.dataset.page;
      if (page) goToPage(page);
    });
  });
}

// ─── Keyboard navigation ───
function initKeyboard() {
  document.addEventListener('keydown', (e) => {
    // Prevent navigating with arrows if user is typing in terminal
    if (document.activeElement === document.getElementById('shellInput')) {
      return;
    }

    const map = {
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowLeft: 'left',
      ArrowRight: 'right',
    };
    if (map[e.key]) {
      e.preventDefault();
      navigateTo(map[e.key]);
    }
  });
}

// ─── Swipe navigation ───
function initSwipe() {
  let touchStart = null;

  document.addEventListener('touchstart', (e) => {
    touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    if (!touchStart) return;
    const dx = e.changedTouches[0].clientX - touchStart.x;
    const dy = e.changedTouches[0].clientY - touchStart.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    if (absX > 50 && absX > absY) {
      navigateTo(dx < 0 ? 'right' : 'left');
    } else if (absY > 50 && absY > absX) {
      navigateTo(dy < 0 ? 'up' : 'down');
    }
    touchStart = null;
  });
}

// ─── Typing Effect ───
function initTypingEffect() {
  const el = document.getElementById('typingTarget');
  if (!el) return;

  const text = el.getAttribute('data-text');
  el.textContent = '';
  let i = 0;

  function type() {
    if (i < text.length) {
      el.textContent += text.charAt(i);
      i++;
      SoundManager.playType();
      const ch = text.charAt(i - 1);
      const delay = ch === '.' ? 250
                  : ch === ',' ? 150
                  : ch === ' ' ? 50
                  : 20 + Math.random() * 20;
      setTimeout(type, delay);
    }
  }

  // Start after a short delay
  setTimeout(type, 600);
}

// ─── Cursor Glow ───
function initCursorGlow() {
  const glow = document.querySelector('.cursor-glow');
  if (!glow || window.innerWidth < 768) {
    if (glow) glow.style.display = 'none';
    return;
  }

  let mx = 0, my = 0, gx = 0, gy = 0;

  document.addEventListener('mousemove', (e) => {
    mx = e.clientX;
    my = e.clientY;
  }, { passive: true });

  (function animate() {
    gx += (mx - gx) * 0.08;
    gy += (my - gy) * 0.08;
    glow.style.left = gx + 'px';
    glow.style.top = gy + 'px';
    requestAnimationFrame(animate);
  })();
}

// ─── Discord Copy ───
function initDiscordCopy() {
  const btn = document.getElementById('copyDiscord');
  if (!btn) return;

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText('kiraa00652_63496').then(() => {
      const icon = btn.querySelector('i');
      icon.className = 'fa-solid fa-check';
      btn.style.color = '#34d399';
      SoundManager.playSuccess();
      setTimeout(() => {
        icon.className = 'fa-regular fa-copy';
        btn.style.color = '';
      }, 2000);
    });
  });
}
