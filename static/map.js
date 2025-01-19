// static/map.js

console.log("[map.js] start loading...");

// ---------- Canvas取得 ----------
const mapCanvas = document.getElementById('mapCanvas');
const ctx = mapCanvas.getContext('2d');
const highlightCanvas = document.getElementById('highlightCanvas');
const highlightCtx = highlightCanvas.getContext('2d');

const canvasHeight = mapCanvas.height;
const canvasWidth = mapCanvas.width;

// スケーリング用の設定
const scale = 0.45;
const offsetX = -13550000;
const offsetY = -3480000;
const xmove = 19735;
const ymove = 8780;

// フレーム管理
let currentFrame = 0;

// フレーム表示
const frameInfo = document.getElementById('frameInfo');

// ボタン
const rewindBtn = document.getElementById('rewindBtn');
const pauseBtn = document.getElementById('pauseBtn');
const playBtn = document.getElementById('playBtn');

// ボタンのイベント
rewindBtn.addEventListener('click', () => {
    console.log("[map.js] Rewind clicked");
    fetch('/rewind', { method: 'POST' })
        .then(r => r.json())
        .then(data => {
            console.log("[map.js] rewound:", data);
            currentFrame = data.current_frame || 0;
            updateFrameDisplay();
        })
        .catch(err => console.error("[map.js] Rewind Error:", err));
});

pauseBtn.addEventListener('click', () => {
    console.log("[map.js] Pause clicked");
    fetch('/pause', { method: 'POST' })
        .then(r => r.json())
        .then(data => {
            console.log("[map.js] paused:", data);
            // Optional: update UI to reflect pause state
        })
        .catch(err => console.error("[map.js] Pause Error:", err));
});

playBtn.addEventListener('click', () => {
    console.log("[map.js] Play clicked");
    fetch('/play', { method: 'POST' })
        .then(r => r.json())
        .then(data => {
            console.log("[map.js] resumed:", data);
            // Optional: update UI to reflect play state
        })
        .catch(err => console.error("[map.js] Play Error:", err));
});

function updateFrameDisplay() {
    frameInfo.innerText = `Frame: ${currentFrame}`;
}

// ---- roads, buildings などの描画 (初期マップ) ----
fetch('/roads')
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(roadData => {
        console.log("[map.js] /roads fetched:", roadData.length, "features");
        roadData.forEach(feature => drawGeometry(feature.geometry, ctx));
    })
    .catch(err => console.error("[map.js] Error fetching /roads:", err));

fetch('/buildings')
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(buildingData => {
        console.log("[map.js] /buildings fetched:", buildingData.length, "features");
        buildingData.forEach(feature => drawGeometry(feature.geometry, ctx));
    })
    .catch(err => console.error("[map.js] Error fetching /buildings:", err));

// geometry描画関数
function drawGeometry(geometry, context) {
    if (!geometry) return;
    if (geometry.type === "Polygon") {
        geometry.coordinates.forEach(ring => {
            context.beginPath();
            ring.forEach(([x, y], idx) => {
                const px = (x + offsetX) * scale - xmove;
                const py = canvasHeight - ((y + offsetY) * scale - ymove);
                if (idx === 0) context.moveTo(px, py);
                else context.lineTo(px, py);
            });
            context.closePath();
            context.fillStyle = "rgba(0,0,255,0.3)";
            context.fill();
        });
    } else if (geometry.type === "LineString") {
        context.strokeStyle = "black";
        context.lineWidth = 1;
        context.beginPath();
        geometry.coordinates.forEach(([x, y], idx) => {
            const px = (x + offsetX) * scale - xmove;
            const py = canvasHeight - ((y + offsetY) * scale - ymove);
            if (idx === 0) context.moveTo(px, py);
            else context.lineTo(px, py);
        });
        context.stroke();
    }
}

console.log("[map.js] Loading complete.");

// Socket.IO クライアントの初期化
const socket = io();

socket.on('connect', () => {
    console.log("[map.js] Connected to Socket.IO server.");
    updateFrameDisplay();
});

socket.on('connect_error', (err) => {
    console.error("[map.js] Socket.IO connection error:", err);
});

// グローバル変数を更新
let isPlaying = false;
let totalFrames = 100;
let availableFrames = 0;
const frameSlider = document.getElementById('frameSlider');
const currentFrameLabel = document.getElementById('currentFrameLabel');
const maxFrameLabel = document.getElementById('maxFrameLabel');
const playPauseBtn = document.getElementById('playPauseBtn');
const playPauseIcon = document.getElementById('playPauseIcon');

// 再生/一時停止の切り替え
playPauseBtn.addEventListener('click', () => {
    isPlaying = !isPlaying;
    playPauseIcon.textContent = isPlaying ? '⏸' : '▶';

    if (isPlaying) {
        playNextFrame();
    }
});

// フレームの再生
function playNextFrame() {
    if (!isPlaying) return;

    const nextFrame = currentFrame + 1;
    if (nextFrame < availableFrames) {
        socket.emit('request_frame', nextFrame);
        setTimeout(playNextFrame, 500); // 0.5秒間隔で再生
    } else {
        // 最後まで再生したら停止
        isPlaying = false;
        playPauseIcon.textContent = '▶';
    }
}

// スライダーのイベントリスナー
frameSlider.addEventListener('input', (e) => {
    const requestedFrame = parseInt(e.target.value);
    if (requestedFrame <= availableFrames) {
        // 再生中なら一時停止
        isPlaying = false;
        playPauseIcon.textContent = '▶';

        // フレームを要求
        socket.emit('request_frame', requestedFrame);
    }
});

// Socket.IOイベントハンドラを更新
socket.on('new_data', (data) => {
    if (data && data.agents && Array.isArray(data.agents)) {
        // 初めてデータを受信したらUIを有効化
        if (availableFrames === 0) {
            frameSlider.disabled = false;
            playPauseBtn.disabled = false;
        }

        availableFrames++;
        currentFrame = data.frame || currentFrame;
        frameSlider.value = currentFrame;

        updateAgents(data.agents);
        updateProgressBar();
    }
});

// プログレスバーの更新
function updateProgressBar() {
    const progressAvailable = document.querySelector('.progress-available');
    const progressFuture = document.querySelector('.progress-future');

    const availableWidth = (availableFrames / totalFrames) * 100;
    const futureWidth = ((totalFrames - availableFrames) / totalFrames) * 100;

    progressAvailable.style.width = `${availableWidth}%`;
    progressFuture.style.width = `${futureWidth}%`;

    currentFrameLabel.textContent = currentFrame;
    maxFrameLabel.textContent = availableFrames;
}

// スライダーの初期設定
function initializeSlider() {
    frameSlider.max = totalFrames;
    frameSlider.value = 0;
    updateProgressBar();
}

// 初期化
initializeSlider();

console.log("[map.js] end loading");

// ポイントとラインセグメント間の距離を計算する関数
function pointToLineDistance(px, py, x1, y1, x2, y2) {
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;
    const dot = A * C + B * D;
    const len_sq = C * C + D * D;
    const param = (len_sq !== 0) ? (dot / len_sq) : -1;
    let xx, yy;

    if (param < 0) {
        xx = x1;
        yy = y1;
    } else if (param > 1) {
        xx = x2;
        yy = y2;
    } else {
        xx = x1 + param * C;
        yy = y1 + param * D;
    }

    const dx = px - xx;
    const dy = py - yy;
    return Math.sqrt(dx * dx + dy * dy);
}

console.log("[map.js] end loading");