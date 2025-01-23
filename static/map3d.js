"use strict";

console.log("[map3d.js] Loading...");

// ========== グローバル変数定義 ==========
let scene, camera, renderer, controls;

// GAMA など外部から受け取ったエージェントを保持する配列・履歴
let agents = [];              // 現在表示中のエージェント（Three.js Mesh）
let agentStates = [];         // 過去フレームを含めて保存したい場合に使う
let isPlaying = true;         // 再生フラグ
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
    // Three.jsのシーン
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);

    // カメラ作成
    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.set(200, 200, 200);
    camera.lookAt(0, 0, 0);
    //軸を追加する。
    const axesHelper = new THREE.AxesHelper(1000);
    scene.add(axesHelper);

    // レンダラ作成
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.getElementById('scene-container').appendChild(renderer.domElement);

    // ライティング
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(100, 100, 100);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    // OrbitControls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    // 地図を読み込む範囲
    boundary = {
        e: 135.5694,
        n: 34.8195,
        s: 34.8035,
        w: 135.5517
    };

    // Overpass API から地図を取得 → Three.jsオブジェクトに変換 → シーンに追加
    createMap(boundary)
        .then(overpassData => {
            // 中心座標
            const center = centroid(boundary);
            // プロジェクション作成 (Mercator)
            const project = createProjection(center);
            // Overpassデータを Three.js のジオメトリに
            const geoObject = createGeoObject(project, overpassData);
            scene.add(geoObject);

            console.log("[map3d.js] Map loaded. Waiting for external agent data...");
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
        d3.json(url, (error, root) => {
            if (error) reject(error);
            resolve(root);
        });
    })
        .then(rawData => {
            // node/way/relation に仕分け
            const acc = { node: {}, way: {}, relation: {} };
            rawData.elements.forEach(elem => {
                acc[elem.type][elem.id] = elem;
            });
            return acc;
        });
}

// ========== 地図用の補助関数 ==========

function centroid(boundary) {
    const midLon = (boundary.w + boundary.e) / 2;
    const midLat = (boundary.n + boundary.s) / 2;
    return [midLon, midLat];
}

function createProjection(center) {
    return d3.geoMercator()
        .center(center)
        .scale(6.5 * 1000 * 1000)
        .translate([0, 0]);
}

function isArea(way) {
    if (!way.nodes || way.nodes.length < 2) return false;
    return (way.nodes[0] === way.nodes[way.nodes.length - 1]);
}

function getNodes(way, overpassData) {
    return way.nodes.map(nodeId => overpassData.node[nodeId]);
}

function getBuildingHeight(tags) {
    if (tags["height"]) {
        return parseFloat(tags["height"]);
    }
    if (tags["building:levels"]) {
        const levels = parseFloat(tags["building:levels"]);
        return isNaN(levels) ? 10 : levels * 3;
    }
    return 10;
}

function createBuildingPolygon(way, project, overpassData) {
    const nodePositions = getNodes(way, overpassData);
    const shape = new THREE.Shape();
    nodePositions.forEach((pos, i) => {
        const [px, py] = project([pos.lon, pos.lat]);
        if (i === 0) shape.moveTo(px, py);
        else shape.lineTo(px, py);
    });
    const buildingHeight = getBuildingHeight(way.tags);
    const extrudeSettings = { depth: buildingHeight, bevelEnabled: false };
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);

    const material = new THREE.MeshLambertMaterial({
        color: 0xd0c0b0,
        transparent: true,
        opacity: 0.9
    });
    const mesh = new THREE.Mesh(geometry, material);

    // ワイヤーフレームを追加
    const wireframe = new THREE.LineSegments(
        new THREE.EdgesGeometry(geometry),
        new THREE.LineBasicMaterial({ color: 0x555555 })
    );
    mesh.add(wireframe);
    return mesh;
}

function getWayColor(tags) {
    if (tags.highway) {
        return 0x888888;
    }
    return 0xb0b0b0;
}

function createGeoObject(project, overpassData) {
    const root = new THREE.Object3D();
    // OSM座標をXY平面に投影
    // root.rotation.x = Math.PI / 2;
    // root.scale.set(1, -1, 1);



    Object.values(overpassData.way).forEach(way => {
        const tags = way.tags || {};
        // // 建物
        // if (isArea(way) && tags.building) {
        //     const buildingMesh = createBuildingPolygon(way, project, overpassData);
        //     root.add(buildingMesh);
        //     return;
        // }

        // 道路などのライン
        const nodePositions = getNodes(way, overpassData);
        const geometry = new THREE.BufferGeometry();
        const vertices = [];

        nodePositions.forEach(pos => {
            const [px, py] = project([pos.lon, pos.lat]);
            vertices.push(px, py, 0);
        });
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));

        const material = new THREE.LineBasicMaterial({ color: getWayColor(tags) });
        const line = new THREE.Line(geometry, material);
        // line.rotation.set(0, 0, 0);
        root.rotation.x = Math.PI /2;
        root.add(line);
    });

    return root;
}

// ========== エージェント関連 ==========

/**
 * シンプルな車の3Dモデルを返す
 */
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
        { x: 1, y: 0.4, z: -1.2 },
        { x: -1, y: 0.4, z: 1.2 },
        { x: 1, y: 0.4, z: 1.2 }
    ];
    wheelPositions.forEach(pos => {
        const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
        wheel.position.set(pos.x, pos.y, pos.z);
        wheel.castShadow = true;
        carGroup.add(wheel);
    });

    return carGroup;
}

function updateAgentsFromGAMA(data) {
    console.log("[map3d.js] Updating agents from external data:", data);

    // 初回の場合、100体のエージェントを作成
    if (agents.length === 0) {
        for (let i = 0; i < 1000; i++) {
            const carMesh = createCarModel(0x2266cc); // 青い車
            carMesh.position.set(0, 0, 0); // 初期位置
            carMesh.userData = {
                id: i,
                speed: 0
            };
            scene.add(carMesh);
            agents.push(carMesh);
        }
        console.log("[map3d.js] Created 500 initial agents");
    }

    // データを100個に制限
    const limitedData = data.slice(0, 1000);
    if (limitedData.length < 1000) {
        console.warn(`[map3d.js] Received only ${limitedData.length} data points, some agents will not be updated`);
    }


    limitedData.forEach((agentInfo, index) => {
        if (index >= agents.length) return;

        const agent = agents[index];
        const scale = 90; // スケーリング係数
        // GAMAの中心座標
        // X 1378.8333443645388
        // Y 1259.1388989621773
        // 位置を更新

        agent.position.set(
            agentInfo.x - 1690,
            0,
            agentInfo.y - 570
        );
        // 情報を更新
        agent.userData = {
            id: agentInfo.id,
            speed: agentInfo.speed
        };
    });

    console.log(`[map3d.js] Updated ${limitedData.length} agents with received data`);
}


// ========== 時間表示用フォーマット (UIに利用) ==========
function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// ========== エージェント状態の履歴管理 (スライダなど) ==========
function saveAgentState() {
    // 現在のエージェント位置などをコピーしておき、履歴に追加
    const snapshot = agents.map(a => ({
        position: a.position.clone(),
        rotation: a.rotation.y,
        userData: { ...a.userData }
    }));
    agentStates.push(snapshot);

    // フレーム数が多すぎないように
    if (agentStates.length > 1000) {
        agentStates.shift();
    }
    timeSlider.max = agentStates.length - 1;
    timeSlider.value = agentStates.length - 1;

    // ラベル更新
    currentTimeLabel.textContent = formatTime(simulationTime);
    totalTimeLabel.textContent = formatTime(simulationTime);
}

/**
 * 指定したフレームを取り出してエージェントに反映
 */
function restoreAgentState(index) {
    if (index < 0 || index >= agentStates.length) return;
    const snapshot = agentStates[index];
    if (snapshot.length !== agents.length) {
        console.warn("[map3d.js] restoreAgentState: agent count mismatch");
    }
    // ある程度ID対応など工夫も可能だが、ここでは配列順で対応
    agents.forEach((agent, i) => {
        const s = snapshot[i];
        agent.position.copy(s.position);
        agent.rotation.y = s.rotation;
        agent.userData = { ...s.userData };
    });
    currentTimeLabel.textContent = formatTime(index / 60); // 60FPS仮定
}

// ========== シミュレーションのリセット ==========
function resetSimulation() {
    // シーンから削除
    agents.forEach(a => scene.remove(a));
    agents = [];

    agentStates = [];
    simulationTime = 0;

    timeSlider.value = 0;
    currentTimeLabel.textContent = '00:00';
    console.log("[map3d.js] Reset simulation (agents cleared).");
}

// ========== イベントリスナー (UI) ==========
playPauseButton.addEventListener('click', () => {
    isPlaying = !isPlaying;
    playPauseButton.textContent = isPlaying ? '⏸' : '▶';
});

resetButton.addEventListener('click', resetSimulation);

// スライダでフレームジャンプ
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
        simulationTime += (1 / 60) * timeScale;
        saveAgentState();
    }

    renderer.render(scene, camera);
}

// ========== リサイズ対応 ==========
window.addEventListener('resize', onWindowResize, false);
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// ========== 初期化 & 実行 ==========
initScene();
animate();

// ========== Socket.IO で外部データを受け取り、updateAgentsFromGAMA()を呼ぶ ==========
const socket = io(); // 同じサーバで提供している場合

socket.on('connect', () => {
    console.log("[map3d.js] Socket.IO connected");
});
socket.on('disconnect', () => {
    console.log("[map3d.js] Socket.IO disconnected");
});

socket.on('new_data', (data) => {
    console.log("[map3d.js] Received new_data:", data);
    if (data && Array.isArray(data.agents)) {
        // 新しいエージェント情報を反映
        updateAgentsFromGAMA(data.agents);
    } else {
        console.warn("[map3d.js] Invalid data format received:", data);
    }
});