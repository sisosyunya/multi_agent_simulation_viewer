// static/map.js

console.log("[map.js] start loading...");

// --- Canvas取得 ---
const canvas = document.getElementById('mapCanvas');
const highlightCanvas = document.getElementById('highlightCanvas');

if (!canvas || !highlightCanvas) {
    console.error("[map.js] ERROR: Canvas elements not found!");
}

// 2Dコンテキスト
const ctx = canvas.getContext('2d');
const highlightCtx = highlightCanvas.getContext('2d');

const canvasHeight = canvas.height;

// スケーリング用パラメータ(適宜調整)
const scale = 0.45;
const offsetX = -13550000;
const offsetY = -3480000;
const xmove = 19735;
const ymove = 8780;

// キャンバスの初期クリア
ctx.clearRect(0, 0, canvas.width, canvas.height);
highlightCtx.clearRect(0, 0, highlightCanvas.width, highlightCanvas.height);

// ロード完了ログ
console.log("[map.js] Canvas width/height =", canvas.width, canvas.height);

// --------------------
// 1) 道路データを描画
// --------------------
fetch('/roads')
    .then(response => {
        if (!response.ok) {
            throw new Error(`Fetch /roads failed: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        console.log("[map.js] /roads fetched:", data.length, "features");
        data.forEach(feature => {
            drawGeometry(feature.geometry);
        });
    })
    .catch(err => {
        console.error("[map.js] Error fetching /roads:", err);
    });

// --------------------
// 2) 建物データを描画
// --------------------
fetch('/buildings')
    .then(response => {
        if (!response.ok) {
            throw new Error(`Fetch /buildings failed: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        console.log("[map.js] /buildings fetched:", data.length, "features");
        data.forEach(feature => {
            drawGeometry(feature.geometry);
        });
    })
    .catch(err => {
        console.error("[map.js] Error fetching /buildings:", err);
    });

// --------------------
// 図形描画用関数
// --------------------
function drawGeometry(geometry) {
    if (!geometry) return;
    if (geometry.type === "Polygon") {
        geometry.coordinates.forEach(ring => {
            drawPolygon(ring);
        });
    } else if (geometry.type === "LineString") {
        drawLineString(geometry.coordinates, 'black');
    }
}

function drawPolygon(coordinates) {
    ctx.beginPath();
    coordinates.forEach(([x, y], index) => {
        const px = (x + offsetX) * scale - xmove;
        const py = canvasHeight - ((y + offsetY) * scale - ymove);
        if (index === 0) {
            ctx.moveTo(px, py);
        } else {
            ctx.lineTo(px, py);
        }
    });
    ctx.closePath();
    ctx.fillStyle = "rgba(0, 0, 255, 0.3)";
    ctx.fill();
}

function drawLineString(coordinates, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    coordinates.forEach(([x, y], index) => {
        const px = (x + offsetX) * scale - xmove;
        const py = canvasHeight - ((y + offsetY) * scale - ymove);
        if (index === 0) {
            ctx.moveTo(px, py);
        } else {
            ctx.lineTo(px, py);
        }
    });
    ctx.stroke();
}

// クリックイベント
// --------------------
highlightCanvas.addEventListener('click', event => {
    // クリック座標の計算 (canvas座標に変換)
    const rect = highlightCanvas.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = canvasHeight - (event.clientY - rect.top);

    console.log(`Clicked at canvas coords: (${clickX}, ${clickY})`);

    // クリックされた可能性のある feature を探す
    // 1. 道路(LineString)判定
    fetch('/roads')
        .then(response => response.json())
        .then(roadData => {
            let clickedRoad = null;
            roadData.forEach(feature => {
                if (feature.geometry.type === "LineString") {
                    const coords = feature.geometry.coordinates.map(
                        ([x, y]) => [(x + offsetX) * scale - xmove, (y + offsetY) * scale - ymove]
                    );
                    // 各セグメントに対して距離を測り、一定閾値内ならクリックとみなす
                    for (let i = 0; i < coords.length - 1; i++) {
                        const [x1, y1] = coords[i];
                        const [x2, y2] = coords[i + 1];
                        const distance = pointToLineDistance(clickX, clickY, x1, y1, x2, y2);
                        if (distance < 6) {  // しきい値 (ピクセル)
                            console.log("Clicked near line:", feature.properties);
                            clickedRoad = feature;
                            break;
                        }
                    }
                }
            });
            if (clickedRoad) {
                // 道路がクリックされた
                highlightCtx.clearRect(0, 0, highlightCanvas.width, highlightCanvas.height);
                highlightLineString(clickedRoad.geometry.coordinates);

                // ポップアップ表示
                const { road_id, length, maxspeed, oneway } = clickedRoad.properties;
                const onewayText = (oneway === 0) ? '対面' : '一通';
                const customMessage = `
                    道路ID: ${road_id}
                    距離: ${length} m
                    最大速度: ${maxspeed} km/h
                    種類: ${onewayText}
                `;
                showPopup(customMessage);

                // サーバーへ road_id を送信
                fetch('/clicked_road_id', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(road_id)
                })
                    .then(res => res.json())
                    .then(result => console.log("Server response:", result))
                    .catch(err => console.error(err));

            } else {
                // 建物(Polygon)の可能性をチェック
                fetch('/buildings')
                    .then(resp => resp.json())
                    .then(buildingData => {
                        let clickedBuilding = null;
                        buildingData.forEach(feature => {
                            if (feature.geometry.type === "Polygon") {
                                // Polygon の各 ring をチェック
                                const rings = feature.geometry.coordinates;
                                rings.forEach(ring => {
                                    // ring[] = [[lng,lat],[lng,lat],...]
                                    // クリック判定用にスケーリング
                                    const scaledCoords = ring.map(([x, y]) => {
                                        return [(x + offsetX) * scale - xmove, (y + offsetY) * scale - ymove];
                                    });
                                    if (pointInPolygon(clickX, clickY, scaledCoords)) {
                                        clickedBuilding = feature;
                                    }
                                });
                            }
                        });
                        if (clickedBuilding) {
                            // 建物がクリックされた
                            highlightCtx.clearRect(0, 0, highlightCanvas.width, highlightCanvas.height);
                            highlightPolygon(clickedBuilding.geometry.coordinates);

                            const { building_id, name, floors } = clickedBuilding.properties || {};
                            const customMessage = `
                                建物ID: ${building_id || '不明'}
                                名称: ${name || '不明'}
                                階数: ${floors || '-'}
                            `;
                            showPopup(customMessage);

                            // サーバーへ building_id を送信 (例: '/clicked_road_id' 使い回しでも可)
                            fetch('/clicked_road_id', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(building_id || -1)
                            })
                                .then(r => r.json())
                                .then(res => console.log("Server building response:", res))
                                .catch(err => console.error(err));
                        } else {
                            // どこもクリックしていない場合、ポップアップ消す
                            popup.style.display = 'none';
                            highlightCtx.clearRect(0, 0, highlightCanvas.width, highlightCanvas.height);
                        }
                    })
                    .catch(err => console.error("Error fetching buildings for click check:", err));
            }
        })
        .catch(err => console.error("Error fetching roads for click check:", err));
});

// --------------------
// ハイライト関数
// --------------------
function highlightLineString(coordinates) {
    highlightCtx.strokeStyle = 'rgba(255, 0, 0, 0.9)';
    highlightCtx.lineWidth = 5;
    highlightCtx.beginPath();
    coordinates.forEach(([x, y], index) => {
        const scaledX = (x + offsetX) * scale - xmove;
        const scaledY = canvasHeight - ((y + offsetY) * scale - ymove);
        if (index === 0) {
            highlightCtx.moveTo(scaledX, scaledY);
        } else {
            highlightCtx.lineTo(scaledX, scaledY);
        }
    });
    highlightCtx.stroke();
}

function highlightPolygon(rings) {
    // Polygon の各リングを描画
    highlightCtx.strokeStyle = 'rgba(255, 0, 0, 0.9)';
    highlightCtx.lineWidth = 4;
    highlightCtx.fillStyle = 'rgba(255, 0, 0, 0.3)';
    rings.forEach((ring, ringIndex) => {
        highlightCtx.beginPath();
        ring.forEach(([x, y], index) => {
            const scaledX = (x + offsetX) * scale - xmove;
            const scaledY = canvasHeight - ((y + offsetY) * scale - ymove);
            if (index === 0) {
                highlightCtx.moveTo(scaledX, scaledY);
            } else {
                highlightCtx.lineTo(scaledX, scaledY);
            }
        });
        highlightCtx.closePath();
        highlightCtx.fill();
        highlightCtx.stroke();
    });
}

// --------------------
// ポップアップ表示
// --------------------
function showPopup(message) {
    popupContent.innerText = message;
    // キャンバスの位置を計算し、少し下にポップアップを表示
    const canvasRect = canvas.getBoundingClientRect();
    popup.style.left = canvasRect.left + 'px';
    popup.style.top = (canvasRect.bottom + window.scrollY + 20) + 'px';
    popup.style.display = 'block';
}