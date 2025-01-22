"use strict";

console.log("[map3d.js] Loading...");

// ========== グローバル変数定義 ==========
let scene, camera, renderer, controls;
let agents = [];              // 車（エージェント）の配列
let agentStates = [];         // エージェントの状態履歴
let isPlaying = true;         // 再生・停止のフラグ
let simulationTime = 0;       // シミュレーション経過時間 (秒換算)
let timeScale = 1.0;          // 再生速度倍率
let boundary;                 // 地図の取得範囲

// UI 要素
const playPauseButton = document.getElementById('play-pause');
const resetButton = document.getElementById('reset');
const timeSlider = document.getElementById('time-slider');
const speedSlider = document.getElementById('speed-slider');
const speedValue = document.getElementById('speed-value');
const currentTimeLabel = document.getElementById('current-time');
const totalTimeLabel = document.getElementById('total-time');

// ========== シーン初期化 ==========
function initScene() {
    // シーンを作る
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);

    // カメラを作る
    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.set(200, 200, 200);
    camera.lookAt(0, 0, 0);

    // レンダラを作る
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.getElementById('scene-container').appendChild(renderer.domElement);

    // 環境光を追加
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    // 平行光源を追加
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(100, 100, 100);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    // OrbitControlsを追加
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    // 地図データを取得する範囲
    boundary = {
        e: 135.5694,
        n: 34.8195,
        s: 34.8035,
        w: 135.5517
    };

    // Overpass APIを使って地図を読み込み → Three.js オブジェクトに変換 → シーンに追加
    createMap(boundary)
      .then((overpassData) => {
          // 1) 中心座標を計算
          const center = centroid(boundary);
          // 2) 投影関数を作成（Mercator）
          const project = createProjection(center);
          // 3) OSMデータをThree.jsのObject3Dに変換
          const geoObject = createGeoObject(project, overpassData);
          scene.add(geoObject);

          // マップを表示した後、初期エージェント（車）を生成
          createInitialAgents();
      })
      .catch(error => {
          console.error('Overpassデータ取得中にエラー:', error);
      });
}

// ========== Overpassから地図データを取得する ==========
function createMap(boundary) {
    return new Promise((resolve, reject) => {
        let baseUrl = "//overpass-api.de/api/interpreter?data=[out:json];\n(\n  node({s},{w},{n},{e});\n  way(bn);\n);\n(\n  ._;\n  node(w);\n);\nout;";
        let url = baseUrl.replace(/\{([swne])\}/g, (match, key) => {
            return boundary[key];
        });

        // d3.json を使ってOverpass APIからOSMデータを取得
        d3.json(url, (error, root) => {
            if (error) reject(error);
            resolve(root);
        });
    })
    .then((rawData) => {
        // 取得した rawData.elements を node, way, relation に仕分け
        const acc = {
            node: {},
            way: {},
            relation: {}
        };
        rawData.elements.forEach(elem => {
            acc[elem.type][elem.id] = elem;
        });
        return acc;
    });
}

// ========== 地図オブジェクト作成用の補助関数 ==========

// 指定した範囲の中央 (経度, 緯度) を返す
function centroid(boundary) {
    const midLon = (boundary.w + boundary.e) / 2;
    const midLat = (boundary.n + boundary.s) / 2;
    return [midLon, midLat];
}

// Mercator投影を作成
function createProjection(center) {
    return d3.geoMercator()
        .center(center)
        .scale(6.5 * 1000 * 1000)
        .translate([0, 0]);
}

// "closed way" かどうかを判定 (building 等のポリゴン向け)
function isArea(way) {
    // way.nodes[0] と way.nodes[way.nodes.length-1] が同じIDならポリゴン（OSMデータではこれが閉じたウェイの目安）
    if (!way.nodes || way.nodes.length < 2) return false;
    return (way.nodes[0] === way.nodes[way.nodes.length - 1]);
}

// Way の node を取得 ( { lon, lat } の配列 )
function getNodes(way, overpassData) {
    return way.nodes.map(nodeId => overpassData.node[nodeId]);
}

// 建物の高さを決定
function getBuildingHeight(tags) {
    // building:levels があれば floor数 × 3m, なければ height があればそれを使う
    // 何もなければデフォルト値 10m
    if (tags["height"]) {
        return parseFloat(tags["height"]);
    }
    if (tags["building:levels"]) {
        const levels = parseFloat(tags["building:levels"]);
        return isNaN(levels) ? 10 : levels * 3; // 1階あたり3m
    }
    // デフォルト高さ
    return 10;
}

// ポリゴン(建物)を生成して返す
function createBuildingPolygon(way, project, overpassData) {
    // ウェイを構成するノード座標を取り出し
    const nodePositions = getNodes(way, overpassData);

    // Shape を作るために [x, y] 座標へ変換（Mercator）
    // Three.js では XY 平面で形状を作り、Z方向に押し出し
    const shape = new THREE.Shape();

    nodePositions.forEach((pos, i) => {
        const [px, py] = project([pos.lon, pos.lat]);
        if (i === 0) {
            shape.moveTo(px, py);
        } else {
            shape.lineTo(px, py);
        }
    });

    // 押し出し高さ
    const buildingHeight = getBuildingHeight(way.tags);

    // ExtrudeGeometry 用オプション
    const extrudeSettings = {
        depth: buildingHeight,
        bevelEnabled: false,
    };

    // 形状を押し出して 3D メッシュを作る
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);

    // 適当なマテリアル設定
    const material = new THREE.MeshLambertMaterial({
        color: 0xd0c0b0,
        transparent: true,
        opacity: 0.9
    });
    const mesh = new THREE.Mesh(geometry, material);

    // ビルっぽさを出すためワイヤーフレームを追加（オプション）
    const wireframe = new THREE.LineSegments(
        new THREE.EdgesGeometry(geometry),
        new THREE.LineBasicMaterial({ color: 0x555555 })
    );
    mesh.add(wireframe);

    return mesh;
}

// 道路などの色を決定する関数
function getWayColor(tags) {
    // highwayタグがあれば道路とみなす → グレー系
    if (tags.highway) {
        return 0x888888; // 自然なアスファルトっぽいグレー
    }
    // それ以外の線分は、淡いグレーなど適宜
    return 0xb0b0b0;
}

// Overpassから取得したデータ(node/way)を Three.js のジオメトリに変換
function createGeoObject(project, overpassData) {
    const root = new THREE.Object3D();
    // OSM座標系（緯度経度）→ XY平面(Three.js座標) にするため、回転やスケールを調整
    root.rotation.x = Math.PI / 2;  // XY平面に投影
    root.scale.set(1, -1, 1);      // Y軸を反転（Mercator系→ThreeJSの向き合わせ）

    // すべてのWayを走査
    Object.values(overpassData.way).forEach(way => {
        const tags = way.tags || {};

        // "closed way" かつ building タグがあれば -> 建物ポリゴンを描画
        if (isArea(way) && tags.building) {
            const buildingMesh = createBuildingPolygon(way, project, overpassData);
            root.add(buildingMesh);
            return;
        }

        // 上記以外は単純に Line で描画（道路など）
        const nodePositions = getNodes(way, overpassData);
        const geometry = new THREE.BufferGeometry();
        const vertices = [];

        nodePositions.forEach(pos => {
            const [px, py] = project([pos.lon, pos.lat]);
            vertices.push(px, py, 0);
        });
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));

        // 道路っぽい色 or デフォルト色
        const material = new THREE.LineBasicMaterial({ color: getWayColor(tags) });
        const line = new THREE.Line(geometry, material);
        root.add(line);
    });

    return root;
}

// ========== 車（エージェント）関連の処理 ==========

// 車の 3D モデルを作る
function createCarModel(color = 0x2266cc) {
    const carGroup = new THREE.Group();

    // 車体
    const bodyGeometry = new THREE.BoxGeometry(2, 1, 4);
    const bodyMaterial = new THREE.MeshStandardMaterial({
        color: color,
        metalness: 0.7,
        roughness: 0.3
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.5;
    body.castShadow = true;
    carGroup.add(body);

    // 車の上部
    const roofGeometry = new THREE.BoxGeometry(1.8, 0.8, 2);
    const roof = new THREE.Mesh(roofGeometry, bodyMaterial);
    roof.position.set(0, 1.4, -0.3);
    roof.castShadow = true;
    carGroup.add(roof);

    // タイヤ
    const wheelGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.4, 16);
    const wheelMaterial = new THREE.MeshStandardMaterial({
        color: 0x111111,
        metalness: 0.5,
        roughness: 0.7
    });

    const wheelPositions = [
        { x: -1, y: 0.4, z: -1.2 },
        { x:  1, y: 0.4, z: -1.2 },
        { x: -1, y: 0.4, z:  1.2 },
        { x:  1, y: 0.4, z:  1.2 }
    ];

    wheelPositions.forEach(pos => {
        const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(pos.x, pos.y, pos.z);
        wheel.castShadow = true;
        carGroup.add(wheel);
    });

    return carGroup;
}

// 簡易的な道路グリッド情報 (エージェント移動用)
const ROAD_GRID = {
    spacing: 50,   // 道路の間隔
    width: 10,     // 道路の幅
    start: -200,   // グリッドの開始位置
    end: 200       // グリッドの終了位置
};

// 最も近い道路の位置にスナップする
function snapToRoad(position) {
    const x = position.x;
    const z = position.z;

    const nearestX = Math.round((x - ROAD_GRID.start) / ROAD_GRID.spacing) * ROAD_GRID.spacing + ROAD_GRID.start;
    const nearestZ = Math.round((z - ROAD_GRID.start) / ROAD_GRID.spacing) * ROAD_GRID.spacing + ROAD_GRID.start;

    const distToXRoad = Math.abs(z - nearestZ);
    const distToZRoad = Math.abs(x - nearestX);

    if (distToXRoad < distToZRoad) {
        // 東西方向の道路上
        return { x: x, z: nearestZ };
    } else {
        // 南北方向の道路上
        return { x: nearestX, z: z };
    }
}

// 交差点かどうかを判定
function isIntersection(position, threshold = 5) {
    const x = position.x;
    const z = position.z;

    // 最も近い交差点（グリッドの交点）を計算
    const nearestX = Math.round((x - ROAD_GRID.start) / ROAD_GRID.spacing) * ROAD_GRID.spacing + ROAD_GRID.start;
    const nearestZ = Math.round((z - ROAD_GRID.start) / ROAD_GRID.spacing) * ROAD_GRID.spacing + ROAD_GRID.start;

    const distToIntersection = Math.sqrt((x - nearestX) ** 2 + (z - nearestZ) ** 2);
    return distToIntersection < threshold;
}

// 初期エージェントをまとめて生成
function createInitialAgents() {
    const colors = [0x2266cc, 0xcc2266, 0x66cc22, 0xcccc22, 0x22cccc, 0xcc22cc];

    // 100台生成
    for (let i = 0; i < 100; i++) {
        // 南北or東西道路をランダムに選択
        const isVertical = Math.random() < 0.5;
        let x, z;

        if (isVertical) {
            x = ROAD_GRID.start + Math.floor(Math.random() * 9) * ROAD_GRID.spacing;
            z = ROAD_GRID.start + Math.random() * (ROAD_GRID.end - ROAD_GRID.start);
        } else {
            x = ROAD_GRID.start + Math.random() * (ROAD_GRID.end - ROAD_GRID.start);
            z = ROAD_GRID.start + Math.floor(Math.random() * 9) * ROAD_GRID.spacing;
        }

        // 進行方向
        const rotation = isVertical
            ? (Math.random() < 0.5 ? 0 : Math.PI)
            : (Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2);

        // 車モデルを作成
        const car = createCarModel(colors[i % colors.length]);
        car.position.set(x, 0, z);
        car.rotation.y = rotation;

        car.userData = {
            speed: 0.3 + Math.random() * 0.2,
            direction: new THREE.Vector3(
                Math.sin(rotation),
                0,
                Math.cos(rotation)
            ),
            isOnVerticalRoad: isVertical,
            lastIntersection: -1000 // 交差点判定用カウンタ
        };

        scene.add(car);
        agents.push(car);
    }
}

// エージェントの動きを更新
function updateAgents() {
    agents.forEach(agent => {
        const pos = agent.position;

        // 交差点チェック
        if (isIntersection(pos)) {
            // 前回の交差点から十分フレーム数が経っていれば方向を変える
            if (agent.userData.lastIntersection < -20) {
                // 30%の確率で90度曲がる
                if (Math.random() < 0.3) {
                    const turnDirection = Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
                    agent.rotation.y += turnDirection;
                    agent.userData.direction.set(
                        Math.sin(agent.rotation.y),
                        0,
                        Math.cos(agent.rotation.y)
                    );
                    agent.userData.isOnVerticalRoad = !agent.userData.isOnVerticalRoad;
                }
                agent.userData.lastIntersection = 0;
            }
        }
        agent.userData.lastIntersection--;

        // 移動
        const direction = agent.userData.direction.clone();
        agent.position.add(direction.multiplyScalar(agent.userData.speed));

        // 道路に沿うよう座標をスナップ
        const snappedPos = snapToRoad(pos);
        if (agent.userData.isOnVerticalRoad) {
            pos.x = snappedPos.x;
        } else {
            pos.z = snappedPos.z;
        }

        // マップ外に出たら反対側へ
        if (pos.x > ROAD_GRID.end + 10)  pos.x = ROAD_GRID.start - 10;
        if (pos.x < ROAD_GRID.start - 10) pos.x = ROAD_GRID.end + 10;
        if (pos.z > ROAD_GRID.end + 10)  pos.z = ROAD_GRID.start - 10;
        if (pos.z < ROAD_GRID.start - 10) pos.z = ROAD_GRID.end + 10;
    });
}

// 時間表示用フォーマット
function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// シミュレーション状態を保存
function saveAgentState() {
    const state = agents.map(agent => ({
        position: agent.position.clone(),
        rotation: agent.rotation.y,
        userData: { ...agent.userData }
    }));
    agentStates.push(state);

    // 1000フレームまで保存
    if (agentStates.length > 1000) {
        agentStates.shift();
    }

    // スライダーとラベルの更新
    timeSlider.max = agentStates.length - 1;
    timeSlider.value = agentStates.length - 1;
    currentTimeLabel.textContent = formatTime(simulationTime);
    totalTimeLabel.textContent = formatTime(simulationTime);
}

// 特定のフレームの状態を復元
function restoreAgentState(index) {
    if (index < 0 || index >= agentStates.length) return;

    const state = agentStates[index];
    agents.forEach((agent, i) => {
        agent.position.copy(state[i].position);
        agent.rotation.y = state[i].rotation;
        agent.userData = { ...state[i].userData };
    });

    currentTimeLabel.textContent = formatTime(index / 60); // 60FPS仮定
}

// シミュレーションのリセット
function resetSimulation() {
    // いったんシーンから既存エージェントを削除
    agents.forEach(agent => scene.remove(agent));
    agents = [];

    agentStates = [];
    simulationTime = 0;

    // エージェント再生成
    createInitialAgents();
    timeSlider.value = 0;
    currentTimeLabel.textContent = '00:00';
}

// ========== イベントリスナー ==========

// 再生/一時停止
playPauseButton.addEventListener('click', () => {
    isPlaying = !isPlaying;
    playPauseButton.textContent = isPlaying ? '⏸' : '▶';
});

// リセット
resetButton.addEventListener('click', resetSimulation);

// 時間スライダ操作（任意のフレームにジャンプ）
timeSlider.addEventListener('input', () => {
    isPlaying = false;
    playPauseButton.textContent = '▶';
    restoreAgentState(parseInt(timeSlider.value));
});

// 速度変更スライダ
speedSlider.addEventListener('input', () => {
    timeScale = speedSlider.value / 100;
    speedValue.textContent = `${timeScale.toFixed(1)}x`;
});

// ========== アニメーションループ ==========
function animate() {
    requestAnimationFrame(animate);
    controls.update();

    if (isPlaying) {
        // 60FPS想定で timeScale 倍速
        simulationTime += (1 / 60) * timeScale;

        updateAgents();
        saveAgentState();
    }

    renderer.render(scene, camera);
}

// ========== ウィンドウサイズ変更対応 ==========
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onWindowResize, false);

// ========== 初期化 & 実行 ==========
initScene();
animate();