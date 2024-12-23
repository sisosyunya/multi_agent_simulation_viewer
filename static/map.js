console.log("[map.js] start loading...");

// ---------- Canvas取得 ----------
// キャンバス
const mapCanvas = document.getElementById('mapCanvas');
const ctx = mapCanvas.getContext('2d');
const highlightCanvas = document.getElementById('highlightCanvas');
const highlightCtx = highlightCanvas.getContext('2d');

const canvasHeight = mapCanvas.height;
const canvasWidth = mapCanvas.width;

// スケーリング例
const scale = 0.45;
const offsetX = -13550000;
const offsetY = -3480000;
const xmove = 19735;
const ymove = 8780;

// フレーム管理 (クライアント側でも現在のframeIndexを保持)
let currentFrame = 0;
let isPlaying = false; // 再生中かどうか
let playTimer = null;  // setInterval用

// ---- roads, buildings などの描画 (初期マップ) ----
fetch('/roads')
  .then(r => r.json())
  .then(roadData => {
    console.log("[map.js] /roads fetched:", roadData.length, "features");
    roadData.forEach(feature => drawGeometry(feature.geometry, ctx));
  });

fetch('/buildings')
  .then(r => r.json())
  .then(buildingData => {
    console.log("[map.js] /buildings fetched:", buildingData.length, "features");
    buildingData.forEach(feature => drawGeometry(feature.geometry, ctx));
  });

// テスト用: geometry描画関数
function drawGeometry(geometry, context) {
  if (!geometry) return;
  if (geometry.type === "Polygon") {
    geometry.coordinates.forEach(ring => {
      context.beginPath();
      ring.forEach(([x, y], idx) => {
        const px = (x+offsetX)*scale - xmove;
        const py = canvasHeight - ((y+offsetY)*scale - ymove);
        if (idx===0) context.moveTo(px, py);
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
    geometry.coordinates.forEach(([x,y], idx) => {
      const px = (x+offsetX)*scale - xmove;
      const py = canvasHeight - ((y+offsetY)*scale - ymove);
      if (idx===0) context.moveTo(px,py);
      else context.lineTo(px,py);
    });
    context.stroke();
  }
}

console.log("[map.js] start loading...");


const frameInfo = document.getElementById('frameInfo');

// ボタン
const rewindBtn = document.getElementById('rewindBtn');
const pauseBtn  = document.getElementById('pauseBtn');
const playBtn   = document.getElementById('playBtn');

// ボタンのイベント (例)
rewindBtn.addEventListener('click', () => {
  console.log("[map.js] Rewind clicked");
  // fetch('/rewind') ... or client-side logic
});
pauseBtn.addEventListener('click', () => {
  console.log("[map.js] Pause clicked");
});
playBtn.addEventListener('click', () => {
  console.log("[map.js] Play clicked");
});

// roads, buildings の読み込みなど...
// 省略

console.log("[map.js] end loading");
// 巻き戻し
rewindBtn.addEventListener('click', () => {
  fetch('/rewind', {method:'POST'})
    .then(r => r.json())
    .then(data => {
      console.log("[map.js] rewound:", data);
      currentFrame = data.frame;
      updateFrameDisplay();
      // フレームを取得して描画
      getFrameAndDraw(currentFrame);
    })
    .catch(err => console.error(err));
});

// 一時停止
pauseBtn.addEventListener('click', () => {
  fetch('/pause', {method:'POST'})
    .then(r => r.json())
    .then(data => {
      console.log("[map.js] paused:", data);
      isPlaying = false;
      stopPlaying();
    })
    .catch(err => console.error(err));
});

// 再生 (自動インクリメント)
playBtn.addEventListener('click', () => {
  fetch('/resume', {method:'POST'})
    .then(r => r.json())
    .then(data => {
      console.log("[map.js] resumed:", data);
      isPlaying = true;
      startPlaying();
    })
    .catch(err => console.error(err));
});

function updateFrameDisplay() {
  frameInfo.innerText = `Frame: ${currentFrame}`;
}

// フレームを取得して描画 (サーバーの /get_frame?frameIndex=... などでもOK)
// ここでは例として /get_frame を使う
function getFrameAndDraw(frameIndex) {
  fetch('/get_frame')
    .then(r => r.json())
    .then(resp => {
      if (resp.status === 'success') {
        currentFrame = resp.frameIndex;
        updateFrameDisplay();
        // フレームデータを描画 (エージェントなど)
        drawAgents(resp.frameData);
      } else {
        console.log("[map.js] get_frame empty or error");
      }
    })
    .catch(err => console.error(err));
}

// エージェント描画の例
function drawAgents(frameData) {
  highlightCtx.clearRect(0, 0, highlightCanvas.width, highlightCanvas.height);
  if (!frameData) return;

  // 例: frameData = { agents:[...], gama_references:{...} }
  const agents = frameData.agents || [];
  const refs   = frameData.gama_references || {};

  highlightCtx.fillStyle = "red";
  agents.forEach(agent => {
    const ref = agent.agent_reference;
    const info = refs[ref];
    if (!info) return;
    const loc = info.attributes?.loc;
    if (!loc) return;

    const px = (loc.x + offsetX)*scale - xmove;
    const py = highlightCanvas.height - ((loc.y + offsetY)*scale - ymove);
    highlightCtx.beginPath();
    highlightCtx.arc(px, py, 5, 0, 2*Math.PI);
    highlightCtx.fill();
  });
}

// 自動再生 (setInterval)
function startPlaying() {
  stopPlaying(); // 二重開始を防ぐ
  playTimer = setInterval(() => {
    // 次のフレームを描画
    currentFrame++;
    getFrameAndDraw(currentFrame);
  }, 1000); // 1秒に1フレーム進む例
}

function stopPlaying() {
  if (playTimer) {
    clearInterval(playTimer);
    playTimer = null;
  }
}

function init() {
  updateFrameDisplay();
  // もし最初のフレームを描画したければ getFrameAndDraw(0) など
}
init();

console.log("[map.js] end loading");