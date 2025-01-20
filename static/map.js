// static/map.js

console.log("[map.js] start loading...");

// ---------- Canvas取得 ----------
const mapCanvas = document.getElementById('mapCanvas');
const ctx = mapCanvas.getContext('2d');
const highlightCanvas = document.getElementById('highlightCanvas');
const highlightCtx = highlightCanvas.getContext('2d');

const canvasHeight = mapCanvas.height;
const canvasWidth = mapCanvas.width;

// マップ描画用の定数を調整
const scale = 0.45;
const offsetX = -13550000;
const offsetY = -3480000;
const xmove = 19735;
const ymove = 8780;

// フレーム管理
let currentFrame = 0;

// フレーム表示
const frameInfo = document.getElementById('frameInfo');

// ボタンの参照を更新（rewindBtn, pauseBtn, playBtnは削除）
const playPauseBtn = document.getElementById('playPauseBtn');
const playPauseIcon = document.getElementById('playPauseIcon');
const frameSlider = document.getElementById('frameSlider');
const currentFrameLabel = document.getElementById('currentFrameLabel');
const maxFrameLabel = document.getElementById('maxFrameLabel');

// ボタンのイベント
// rewindBtn, pauseBtn, playBtnのイベントリスナーを削除

function updateFrameDisplay() {
    frameInfo.innerText = `Frame: ${currentFrame}`;
}

// ---- roads, buildings などの描画 (初期マップ) ----
fetch('/roads')
    .then(response => response.json())
    .then(roadData => {
        console.log("[map.js] Roads loaded:", roadData.length, "features");
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);  // キャンバスをクリア
        roadData.forEach(feature => drawGeometry(feature.geometry, ctx));
    })
    .catch(err => console.error("[map.js] Error loading roads:", err));

fetch('/buildings')
    .then(response => response.json())
    .then(buildingData => {
        console.log("[map.js] Buildings loaded:", buildingData.length, "features");
        buildingData.forEach(feature => drawGeometry(feature.geometry, ctx));
    })
    .catch(err => console.error("[map.js] Error loading buildings:", err));

// geometry描画関数を修正
function drawGeometry(geometry, context) {
    if (!geometry) return;

    context.save();  // 現在の描画状態を保存

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
            context.fillStyle = "rgba(200,200,200,0.3)";  // より薄い色に変更
            context.fill();
            context.strokeStyle = "rgba(100,100,100,0.8)";
            context.stroke();
        });
    } else if (geometry.type === "LineString") {
        context.beginPath();
        context.strokeStyle = "rgba(100,100,100,0.8)";
        context.lineWidth = 1;
        geometry.coordinates.forEach(([x, y], idx) => {
            const px = (x + offsetX) * scale - xmove;
            const py = canvasHeight - ((y + offsetY) * scale - ymove);
            if (idx === 0) context.moveTo(px, py);
            else context.lineTo(px, py);
        });
        context.stroke();
    }

    context.restore();  // 描画状態を元に戻す
}

console.log("[map.js] Loading complete.");

// Socket.IO接続のエラーハンドリングを強化
const socket = io({
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 5
});

// デモモード用の変数
let demoMode = true;
let demoInterval = null;

// デモモードの開始（エラーハンドリングを追加）
function startDemoMode() {
    if (!demoMode) return;

    console.log('Starting demo mode...');
    demoInterval = setInterval(() => {
        fetch('/update_demo', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                console.log('Demo update successful:', data);
            })
            .catch(error => {
                console.error('Demo update error:', error);
            });
    }, 3000);
}

// 接続時にデモモードを開始
socket.on('connect', () => {
    console.log("[map.js] Connected to Socket.IO server.");
    updateFrameDisplay();
    if (demoMode) {
        startDemoMode();
    }
});

socket.on('connect_error', (error) => {
    console.error('Socket.IO connection error:', error);
});

// グローバル変数を更新
let isPlaying = false;
let totalFrames = 100;
let availableFrames = 0;

// 再生/一時停止ボタンのイベントリスナー（null チェックを追加）
if (playPauseBtn) {
    playPauseBtn.addEventListener('click', () => {
        isPlaying = !isPlaying;
        if (playPauseIcon) {
            playPauseIcon.textContent = isPlaying ? '⏸' : '▶';
        }

        if (isPlaying) {
            playNextFrame();
        }
    });
}

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
        if (playPauseIcon) {
            playPauseIcon.textContent = '▶';
        }
    }
}

// フレームスライダーのイベントリスナー（null チェックを追加）
if (frameSlider) {
    frameSlider.addEventListener('input', (e) => {
        const requestedFrame = parseInt(e.target.value);
        if (requestedFrame <= availableFrames) {
            isPlaying = false;
            if (playPauseIcon) {
                playPauseIcon.textContent = '▶';
            }
            socket.emit('request_frame', requestedFrame);
        }
    });
}

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

// エージェントを描画する関数
function updateAgents(agents) {
    // キャンバスをクリア
    highlightCtx.clearRect(0, 0, highlightCanvas.width, highlightCanvas.height);

    agents.forEach(agent => {
        // マップと同じスケーリングを使用
        const px = (agent.x + offsetX) * scale - xmove;
        const py = canvasHeight - ((agent.y + offsetY) * scale - ymove);

        // エージェントを描画
        highlightCtx.beginPath();
        highlightCtx.arc(px, py, 4, 0, 2 * Math.PI);
        highlightCtx.fillStyle = 'red';
        highlightCtx.fill();
        highlightCtx.strokeStyle = 'black';
        highlightCtx.stroke();

        // エージェントIDを表示
        highlightCtx.font = '10px Arial';
        highlightCtx.fillStyle = 'black';
        highlightCtx.fillText(`${agent.id}`, px + 6, py - 6);
    });
}