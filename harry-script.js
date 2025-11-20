// --- Configuration ---
const CONFIG = {
    width: window.innerWidth,
    height: window.innerHeight,
    botHitbox: { x: window.innerWidth / 2, y: window.innerHeight / 2, radius: 100 },
};

// --- Elements ---
const canvas = document.getElementById('vfx-canvas');
const ctx = canvas.getContext('2d');
const wandTip = document.getElementById('wand-tip');
const bot = document.getElementById('training-bot');
const botStatus = document.getElementById('bot-status');
const videoElement = document.getElementById('gesture-video');

canvas.width = CONFIG.width;
canvas.height = CONFIG.height;

// --- State ---
const state = {
    wandPos: { x: 0, y: 0 },
    isWandActive: false,
    gestureHistory: [],
    activeSpells: [], // Particles/Projectiles
    botState: 'IDLE', // IDLE, BURNING, STUNNED
    cooldown: false,
};

// --- Particle System ---
class Particle {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type; // 'spark', 'fire', 'bolt', 'shield'
        this.life = 1.0;
        this.vx = (Math.random() - 0.5) * 5;
        this.vy = (Math.random() - 0.5) * 5;

        if (type === 'fire') {
            this.color = `hsl(${10 + Math.random() * 40}, 100%, 50%)`;
            this.vy -= 2; // Rise up
        } else if (type === 'bolt') {
            this.color = '#ff3333';
            this.vx = (Math.random() - 0.5) * 2;
            this.vy = (Math.random() - 0.5) * 2;
        } else if (type === 'spark') {
            this.color = '#fff';
        } else if (type === 'shield') {
            this.color = '#00ffff';
        }
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= 0.02;

        if (this.type === 'fire') {
            this.life -= 0.03;
            this.vy -= 0.1; // Accelerate up
        }
    }

    draw(ctx) {
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }
}

class Projectile {
    constructor(x, y, targetX, targetY, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.speed = 15;

        const angle = Math.atan2(targetY - y, targetX - x);
        this.vx = Math.cos(angle) * this.speed;
        this.vy = Math.sin(angle) * this.speed;
        this.active = true;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;

        // Trail
        state.activeSpells.push(new Particle(this.x, this.y, this.type === 'STUPEFY' ? 'bolt' : 'fire'));

        // Collision Check with Bot
        const dx = this.x - CONFIG.botHitbox.x;
        const dy = this.y - CONFIG.botHitbox.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < CONFIG.botHitbox.radius) {
            this.active = false;
            hitBot(this.type);
        }

        // Out of bounds
        if (this.x < 0 || this.x > CONFIG.width || this.y < 0 || this.y > CONFIG.height) {
            this.active = false;
        }
    }

    draw(ctx) {
        ctx.fillStyle = this.type === 'STUPEFY' ? '#ff0000' : '#ffaa00';
        ctx.beginPath();
        ctx.arc(this.x, this.y, 8, 0, Math.PI * 2);
        ctx.fill();
    }
}

// --- Game Logic ---

function hitBot(spellType) {
    if (spellType === 'STUPEFY') {
        bot.classList.remove('bot-burn');
        bot.classList.add('bot-hit');
        botStatus.textContent = 'STATUS: STUNNED';
        botStatus.style.color = '#ff3333';
        setTimeout(() => bot.classList.remove('bot-hit'), 500);
    } else if (spellType === 'INCENDIO') {
        bot.classList.add('bot-burn');
        botStatus.textContent = 'STATUS: ON FIRE';
        botStatus.style.color = '#ffaa00';
        setTimeout(() => bot.classList.remove('bot-burn'), 3000);
    }
}

function castSpell(spell) {
    if (state.cooldown) return;
    state.cooldown = true;

    console.log(`Casting ${spell}`);
    highlightSpellUI(spell);

    if (spell === 'LUMOS') {
        wandTip.style.boxShadow = '0 0 60px #fff, 0 0 100px #fff';
        setTimeout(() => wandTip.style.boxShadow = '0 0 20px #fff, 0 0 40px #fff', 2000);
    } else if (spell === 'INCENDIO') {
        // Launch fire projectile towards bot
        state.activeSpells.push(new Projectile(state.wandPos.x, state.wandPos.y, CONFIG.botHitbox.x, CONFIG.botHitbox.y, 'INCENDIO'));
    } else if (spell === 'STUPEFY') {
        // Launch bolt
        state.activeSpells.push(new Projectile(state.wandPos.x, state.wandPos.y, CONFIG.botHitbox.x, CONFIG.botHitbox.y, 'STUPEFY'));
    } else if (spell === 'PROTEGO') {
        // Create shield particles around wand
        for (let i = 0; i < 20; i++) {
            state.activeSpells.push(new Particle(state.wandPos.x, state.wandPos.y, 'shield'));
        }
    }

    setTimeout(() => state.cooldown = false, 1000);
}

function highlightSpellUI(spell) {
    document.querySelectorAll('.spell-item').forEach(el => el.classList.remove('active'));
    const id = `spell-${spell.toLowerCase()}`;
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
}

// --- Gesture Engine ---

const hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
});

hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.7,
});

hands.onResults(onResults);

const camera = new Camera(videoElement, {
    onFrame: async () => {
        await hands.send({ image: videoElement });
    },
    width: 640,
    height: 360,
});
camera.start();

function onResults(results) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Update Particles
    state.activeSpells = state.activeSpells.filter(p => {
        p.update();
        p.draw(ctx);
        return p.life > 0 && (p.active !== false);
    });

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];
        processGestures(landmarks);
    } else {
        wandTip.classList.remove('active');
        state.isWandActive = false;
    }
}

function processGestures(landmarks) {
    const indexTip = landmarks[8];

    // Map to screen coords (Mirror X)
    const x = (1 - indexTip.x) * CONFIG.width;
    const y = indexTip.y * CONFIG.height;

    state.wandPos = { x, y };

    // Update Wand UI
    wandTip.style.left = `${x}px`;
    wandTip.style.top = `${y}px`;
    wandTip.classList.add('active');
    state.isWandActive = true;

    // Track History for Gestures
    state.gestureHistory.push({ x, y, time: Date.now() });
    if (state.gestureHistory.length > 20) state.gestureHistory.shift();

    detectSpellPatterns(landmarks);
}

function detectSpellPatterns(landmarks) {
    // 1. PROTEGO: Open Palm (All fingers extended)
    if (isPalmOpen(landmarks)) {
        castSpell('PROTEGO');
        return;
    }

    // 2. LUMOS: Held still high up
    // Not implemented for simplicity, focus on motion

    // 3. INCENDIO: Circle
    // Analyze history for circular motion
    if (detectCircle(state.gestureHistory)) {
        castSpell('INCENDIO');
        state.gestureHistory = []; // Reset
        return;
    }

    // 4. STUPEFY: Thrust (High velocity change)
    if (detectThrust(state.gestureHistory)) {
        castSpell('STUPEFY');
        state.gestureHistory = [];
        return;
    }
}

function isPalmOpen(landmarks) {
    // Check if all tips are above their PIPs (y is smaller)
    const tips = [8, 12, 16, 20];
    const pips = [6, 10, 14, 18];
    return tips.every((tipIdx, i) => landmarks[tipIdx].y < landmarks[pips[i]].y);
}

function detectCircle(history) {
    if (history.length < 15) return false;
    // Simplified: Check if we cross quadrants? 
    // Or just bounding box aspect ratio ~ 1 and covered area?

    const xs = history.map(p => p.x);
    const ys = history.map(p => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const width = maxX - minX;
    const height = maxY - minY;

    // Must be big enough
    if (width < 50 || height < 50) return false;

    // Aspect ratio close to 1
    const ratio = width / height;
    if (ratio < 0.6 || ratio > 1.4) return false;

    return true; // Good enough for a magic demo
}

function detectThrust(history) {
    if (history.length < 5) return false;
    // Check velocity of last few points
    const last = history[history.length - 1];
    const prev = history[history.length - 4]; // Look back a bit

    if (!prev) return false;

    const dx = last.x - prev.x;
    const dy = last.y - prev.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Fast movement
    if (dist > 100) {
        return true;
    }
    return false;
}
