// Initialize Reveal
Reveal.initialize({
    controls: true,
    progress: true,
    center: true,
    hash: true,
    transition: 'slide', // none/fade/slide/convex/concave/zoom
});

// --- Gesture Control ---
const videoElement = document.getElementById('gesture-video');
const laserPointer = document.getElementById('laser-pointer');
const toast = document.getElementById('gesture-toast');

// Config
const SWIPE_THRESHOLD = 0.08; // Movement distance to trigger swipe
const SWIPE_COOLDOWN = 1000; // ms
let lastHandX = null;
let swipeCooldown = false;

// MediaPipe Hands
const hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
});

hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.6,
});

hands.onResults(onResults);

const camera = new Camera(videoElement, {
    onFrame: async () => {
        await hands.send({ image: videoElement });
    },
    width: 640,
    height: 360, // Lower res for performance
});

camera.start();

function onResults(results) {
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];
        processGestures(landmarks);
    } else {
        hideLaser();
        lastHandX = null;
    }
}

function processGestures(landmarks) {
    // 1. Laser Pointer (Index Finger Tip)
    const indexTip = landmarks[8];
    const indexPip = landmarks[6]; // PIP joint to check if finger is extended

    // Map coordinates (Mirror X)
    const x = (1 - indexTip.x) * window.innerWidth;
    const y = indexTip.y * window.innerHeight;

    // Check if index is extended (Tip higher than PIP)
    // Note: y increases downwards
    const isPointing = indexTip.y < indexPip.y;

    if (isPointing) {
        showLaser(x, y);
    } else {
        hideLaser();
    }

    // 2. Swipe Detection (Hand Centroid)
    // Using Wrist (0) or Middle MCP (9) as a stable point
    const handCenter = landmarks[9];

    if (lastHandX !== null && !swipeCooldown) {
        const dx = handCenter.x - lastHandX; // Positive = Moving Left (in mirrored view? No, wait)
        // MediaPipe X: 0 (Left) -> 1 (Right)
        // Mirrored View: 
        // User moves Hand Right -> Camera sees Hand moving Left (x decreases)
        // User moves Hand Left -> Camera sees Hand moving Right (x increases)

        // Let's stick to raw coordinates first
        // If dx > threshold -> Moving Right (User moving Left) -> Next Slide?
        // Usually: Swipe Left (Hand moves Right to Left) -> Next Slide
        // User moves Right to Left -> Camera x decreases (1 -> 0) -> dx is negative

        if (dx < -SWIPE_THRESHOLD) {
            // Moving Left (User moving Right to Left) -> NEXT
            triggerSwipe('NEXT');
        } else if (dx > SWIPE_THRESHOLD) {
            // Moving Right (User moving Left to Right) -> PREV
            triggerSwipe('PREV');
        }
    }

    lastHandX = handCenter.x;
}

function triggerSwipe(direction) {
    swipeCooldown = true;
    if (direction === 'NEXT') {
        Reveal.next();
        showToast('Next Slide ▶');
    } else {
        Reveal.prev();
        showToast('◀ Previous Slide');
    }

    setTimeout(() => {
        swipeCooldown = false;
        lastHandX = null; // Reset to prevent double trigger
    }, SWIPE_COOLDOWN);
}

function showLaser(x, y) {
    laserPointer.style.left = `${x}px`;
    laserPointer.style.top = `${y}px`;
    laserPointer.classList.add('active');
}

function hideLaser() {
    laserPointer.classList.remove('active');
}

function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 1500);
}
