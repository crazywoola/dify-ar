const nodesLayer = document.getElementById('flow-nodes');
const connectionsSvg = document.getElementById('flow-connections');
const miniMapSvg = document.getElementById('mini-map');
const toast = document.getElementById('toast');
const alignBtn = document.getElementById('align-grid');
const runBrewBtn = document.getElementById('start-brew');
const okStartBtn = document.getElementById('ok-start');
const workflowLog = document.getElementById('workflow-log');
const gesturePointer = document.getElementById('gesture-pointer');
const video = document.getElementById('gesture-video');
const canvas = document.getElementById('gesture-canvas');
const ctx = canvas.getContext('2d');

// --- Configuration ---
const CONFIG = {
    pinchStart: 0.04,
    pinchEnd: 0.08,
    vGestureThreshold: 0.05, // Tolerance for V shape
    waveThreshold: 200,
};

// --- State ---
const state = {
    nodes: new Map(),
    connections: [],
    dragTarget: null,
    dragOffset: { x: 0, y: 0 },
    selectedNode: null,
    isPinching: false,
    pinchCooldown: false,
    waveMomentum: 0,
    lastWaveX: null,
    waveCooldown: false,
};

const initialNodes = [
    { id: 'prep-water', title: 'Fill Kettle', chip: 'WATER', detail: 'HEAT TO 92°C · 600ML', x: 360, y: 220 },
    { id: 'grind-beans', title: 'Grind Beans', chip: 'GRIND', detail: '18G MEDIUM-FINE', x: 640, y: 220 },
    { id: 'bloom-stage', title: 'Bloom 30s', chip: 'BREW · 1', detail: '30ML WATER + SWIRL', x: 940, y: 160 },
    { id: 'pulse-pour', title: 'Pulse Pour', chip: 'BREW · 2', detail: 'POUR TO 150ML', x: 1180, y: 260 },
    { id: 'drawdown', title: 'Drawdown', chip: 'BREW · 3', detail: 'WAIT FOR DRAIN', x: 1380, y: 360 },
    { id: 'serve-cup', title: 'Serve Cup', chip: 'FINISH', detail: 'ENJOY', x: 1580, y: 240 },
];

const baseConnections = [
    ['prep-water', 'grind-beans'],
    ['grind-beans', 'bloom-stage'],
    ['bloom-stage', 'pulse-pour'],
    ['pulse-pour', 'drawdown'],
    ['drawdown', 'serve-cup'],
];
state.connections = [...baseConnections];

// --- Core Logic ---

function init() {
    initialNodes.forEach(createNode);
    renderConnections();
    pushLog('SYSTEM_INIT', 'NEURAL LINK ESTABLISHED');
    startCamera();
}

function createNode(nodeData) {
    const el = document.createElement('div');
    el.className = 'flow-node';
    el.dataset.id = nodeData.id;
    el.innerHTML = `
    <div class="node-header">
      <div class="node-title">${nodeData.title}</div>
      <span class="node-chip">${nodeData.chip}</span>
    </div>
    <div class="node-body">${nodeData.detail}</div>
    <div class="node-footer">
      <span>STATUS: READY</span>
      <span>[NET_WATCH]</span>
    </div>
  `;

    // Mouse Interactions
    el.addEventListener('mousedown', (e) => startDrag(e, nodeData.id));

    nodesLayer.appendChild(el);
    state.nodes.set(nodeData.id, { ...nodeData, el });
    positionNode(nodeData.id, nodeData.x, nodeData.y);
}

function positionNode(id, x, y) {
    const node = state.nodes.get(id);
    if (!node) return;

    // Boundary checks
    const maxX = window.innerWidth - 280;
    const maxY = window.innerHeight - 200;
    node.x = Math.max(0, Math.min(x, maxX));
    node.y = Math.max(0, Math.min(y, maxY));

    node.el.style.transform = `translate(${node.x}px, ${node.y}px)`;
}

function renderConnections() {
    connectionsSvg.innerHTML = '';
    state.connections.forEach(([fromId, toId]) => {
        const from = state.nodes.get(fromId);
        const to = state.nodes.get(toId);
        if (!from || !to) return;

        const startX = from.x + 260; // Node width
        const startY = from.y + 50;
        const endX = to.x;
        const endY = to.y + 50;

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const midX = (startX + endX) / 2;
        const d = `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;

        path.setAttribute('d', d);
        path.setAttribute('class', 'flow-path');
        connectionsSvg.appendChild(path);
    });
    renderMiniMap();
}

function renderMiniMap() {
    miniMapSvg.innerHTML = '';
    const scale = 0.12;
    state.connections.forEach(([fromId, toId]) => {
        const from = state.nodes.get(fromId);
        const to = state.nodes.get(toId);
        if (!from || !to) return;
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', from.x * scale);
        line.setAttribute('y1', from.y * scale);
        line.setAttribute('x2', to.x * scale);
        line.setAttribute('y2', to.y * scale);
        line.setAttribute('stroke', 'var(--cp-cyan)');
        miniMapSvg.appendChild(line);
    });
}

// --- Interaction ---

function startDrag(e, id) {
    state.dragTarget = id;
    const node = state.nodes.get(id);
    state.dragOffset = {
        x: e.clientX - node.x,
        y: e.clientY - node.y
    };
    setSelectedNode(id);
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', stopDrag);
}

function onDrag(e) {
    if (!state.dragTarget) return;
    positionNode(state.dragTarget, e.clientX - state.dragOffset.x, e.clientY - state.dragOffset.y);
    renderConnections();
}

function stopDrag() {
    state.dragTarget = null;
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', stopDrag);
}

function setSelectedNode(id) {
    if (state.selectedNode) {
        const prev = state.nodes.get(state.selectedNode);
        if (prev) prev.el.classList.remove('is-selected');
    }
    state.selectedNode = id;
    if (id) {
        const curr = state.nodes.get(id);
        if (curr) curr.el.classList.add('is-selected');
        pushLog('NODE_SELECT', `TARGET: ${curr.title}`);
    }
}

// --- Gesture Engine ---

const hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
});
hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.6,
    minTrackingConfidence: 0.5,
});

hands.onResults(onHandsResults);

function startCamera() {
    const camera = new Camera(video, {
        onFrame: async () => {
            await hands.send({ image: video });
        },
        width: 1280,
        height: 720,
    });
    camera.start();
}

function onHandsResults(results) {
    // Draw video feed
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (results.image) {
        ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
    }

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];
        drawConnectors(ctx, landmarks, HAND_CONNECTIONS, { color: '#00F0FF', lineWidth: 2 });
        drawLandmarks(ctx, landmarks, { color: '#FCEE0A', lineWidth: 1 });

        processGestures(landmarks);
    } else {
        updatePointer(null);
    }
}

function processGestures(landmarks) {
    const indexTip = landmarks[8];
    const thumbTip = landmarks[4];
    const middleTip = landmarks[12];

    // Calculate Pointer Position (Mirror X)
    const x = (1 - indexTip.x) * window.innerWidth;
    const y = indexTip.y * window.innerHeight;

    updatePointer({ x, y });

    // 1. Pinch Detection (with Hysteresis)
    const pinchDist = distance(thumbTip, indexTip);
    if (state.isPinching) {
        if (pinchDist > CONFIG.pinchEnd) state.isPinching = false;
    } else {
        if (pinchDist < CONFIG.pinchStart) state.isPinching = true;
    }

    gesturePointer.classList.toggle('pinching', state.isPinching);

    if (state.isPinching) {
        handlePinchDrag(x, y);
    } else {
        state.dragTarget = null;
    }

    // 2. "V" Gesture Detection (Peace Sign)
    // Index and Middle up, others down
    if (detectVGesture(landmarks)) {
        triggerVAction();
    }

    // 3. Wave Detection
    detectWave(x);
}

function handlePinchDrag(x, y) {
    if (!state.dragTarget) {
        // Try to find a target
        const elements = document.elementsFromPoint(x, y);
        const nodeEl = elements.find(el => el.classList.contains('flow-node'));
        if (nodeEl) {
            const id = nodeEl.dataset.id;
            const node = state.nodes.get(id);
            state.dragTarget = id;
            state.dragOffset = { x: x - node.x, y: y - node.y };
            setSelectedNode(id);
        }
    } else {
        // Dragging
        positionNode(state.dragTarget, x - state.dragOffset.x, y - state.dragOffset.y);
        renderConnections();
    }
}

function detectVGesture(landmarks) {
    // Simple heuristic: Index & Middle extended, Ring & Pinky curled
    // Tips should be higher (lower y) than PIP joints
    const indexTip = landmarks[8];
    const indexPip = landmarks[6];
    const middleTip = landmarks[12];
    const middlePip = landmarks[10];
    const ringTip = landmarks[16];
    const ringPip = landmarks[14];

    const isIndexUp = indexTip.y < indexPip.y;
    const isMiddleUp = middleTip.y < middlePip.y;
    const isRingDown = ringTip.y > ringPip.y;

    // Distance between index and middle tip should be somewhat significant
    const spread = distance(indexTip, middleTip);

    return isIndexUp && isMiddleUp && isRingDown && spread > 0.05;
}

let vGestureCooldown = false;
function triggerVAction() {
    if (vGestureCooldown) return;
    vGestureCooldown = true;
    pushLog('SYS_CMD', 'V_GESTURE_DETECTED >> JOHNNY_MODE');
    showToast('V GESTURE: SYSTEM DIAGNOSTICS');
    setTimeout(() => vGestureCooldown = false, 2000);
}

function detectWave(x) {
    if (state.lastWaveX !== null) {
        const dx = x - state.lastWaveX;
        state.waveMomentum = state.waveMomentum * 0.8 + dx;

        if (Math.abs(state.waveMomentum) > CONFIG.waveThreshold && !state.waveCooldown) {
            state.waveCooldown = true;
            pushLog('SYS_CMD', 'WAVE_DETECTED >> RESET_FLOW');
            showToast('WAVE: RESETTING WORKFLOW');
            resetLayout();
            setTimeout(() => state.waveCooldown = false, 1500);
        }
    }
    state.lastWaveX = x;
}

function updatePointer(pos) {
    if (!pos) {
        gesturePointer.classList.remove('active');
        return;
    }
    gesturePointer.style.left = `${pos.x}px`;
    gesturePointer.style.top = `${pos.y}px`;
    gesturePointer.classList.add('active');
}

// --- Utilities ---

function distance(a, b) {
    return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
}

function pushLog(type, msg) {
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    entry.innerHTML = `<small>[${time}] ${type}</small>${msg}`;
    workflowLog.prepend(entry);
}

function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2000);
}

function resetLayout() {
    initialNodes.forEach(node => {
        positionNode(node.id, node.x, node.y);
    });
    renderConnections();
}

// --- Bindings ---
alignBtn.addEventListener('click', resetLayout);
runBrewBtn.addEventListener('click', () => pushLog('CMD', 'RUN_BREW_SEQUENCE'));

// Start
init();
