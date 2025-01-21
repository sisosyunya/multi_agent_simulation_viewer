console.log("[map3d.js] Loading...");

// Three.js のセットアップ
let scene, camera, renderer, controls;
let agents = [];

// シーンのセットアップ
function initScene() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);

    // カメラのセットアップ（より高い位置から）
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(200, 200, 200);
    camera.lookAt(0, 0, 0);

    // レンダラーのセットアップ
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

    // デモマップを作成
    createDemoMap();

    // 初期エージェントを作成
    createInitialAgents();
}

// デモマップの作成
function createDemoMap() {
    // 地面（より大きく）
    const groundGeometry = new THREE.PlaneGeometry(500, 500);
    const groundMaterial = new THREE.MeshStandardMaterial({
        color: 0x333333,
        roughness: 0.8,
        metalness: 0.2
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // グリッド状の道路を作成
    const roadMaterial = new THREE.MeshStandardMaterial({
        color: 0x666666,
        roughness: 0.5
    });

    // 南北の道路（複数）
    for (let x = -200; x <= 200; x += 50) {
        const roadNS = new THREE.Mesh(
            new THREE.PlaneGeometry(10, 500),
            roadMaterial
        );
        roadNS.rotation.x = -Math.PI / 2;
        roadNS.position.set(x, 0.01, 0);
        scene.add(roadNS);
    }

    // 東西の道路（複数）
    for (let z = -200; z <= 200; z += 50) {
        const roadEW = new THREE.Mesh(
            new THREE.PlaneGeometry(500, 10),
            roadMaterial
        );
        roadEW.rotation.x = -Math.PI / 2;
        roadEW.position.set(0, 0.01, z);
        scene.add(roadEW);
    }

    // ブロックごとに建物を配置
    const buildingMaterials = [
        new THREE.MeshStandardMaterial({
            color: 0x88aacc,
            metalness: 0.3,
            roughness: 0.7
        }),
        new THREE.MeshStandardMaterial({
            color: 0xccaa88,
            metalness: 0.3,
            roughness: 0.7
        }),
        new THREE.MeshStandardMaterial({
            color: 0xaaccaa,
            metalness: 0.3,
            roughness: 0.7
        })
    ];

    // 建物を配置（グリッド状）
    for (let x = -175; x <= 175; x += 50) {
        for (let z = -175; z <= 175; z += 50) {
            // 各ブロックに2-4個の建物を配置
            const buildingsInBlock = 2 + Math.floor(Math.random() * 3);

            for (let b = 0; b < buildingsInBlock; b++) {
                // ブロック内でランダムな位置を決定
                const offsetX = Math.random() * 30 - 15;
                const offsetZ = Math.random() * 30 - 15;
                const height = 10 + Math.random() * 30; // 建物の高さをランダムに
                const width = 5 + Math.random() * 10;
                const depth = 5 + Math.random() * 10;

                const buildingGeometry = new THREE.BoxGeometry(width, height, depth);
                const material = buildingMaterials[Math.floor(Math.random() * buildingMaterials.length)];
                const building = new THREE.Mesh(buildingGeometry, material);

                building.position.set(
                    x + offsetX,
                    height / 2,
                    z + offsetZ
                );
                building.castShadow = true;
                scene.add(building);
            }
        }
    }
}

// 車のモデルを作成する関数
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
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(pos.x, pos.y, pos.z);
        wheel.castShadow = true;
        carGroup.add(wheel);
    });

    return carGroup;
}

// 道路グリッドの定義
const ROAD_GRID = {
    spacing: 50,  // 道路の間隔
    width: 10,    // 道路の幅
    start: -200,  // グリッドの開始位置
    end: 200      // グリッドの終了位置
};

// 最も近い道路の位置を取得する関数
function snapToRoad(position) {
    const x = position.x;
    const z = position.z;

    // x座標とz座標それぞれについて、最も近い道路の中心線を見つける
    const nearestX = Math.round((x - ROAD_GRID.start) / ROAD_GRID.spacing) * ROAD_GRID.spacing + ROAD_GRID.start;
    const nearestZ = Math.round((z - ROAD_GRID.start) / ROAD_GRID.spacing) * ROAD_GRID.spacing + ROAD_GRID.start;

    // 現在位置がどちらの道路に近いかを判定
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

// 交差点かどうかを判定する関数
function isIntersection(position, threshold = 5) {
    const x = position.x;
    const z = position.z;

    // 最も近い交差点の座標を計算
    const nearestX = Math.round((x - ROAD_GRID.start) / ROAD_GRID.spacing) * ROAD_GRID.spacing + ROAD_GRID.start;
    const nearestZ = Math.round((z - ROAD_GRID.start) / ROAD_GRID.spacing) * ROAD_GRID.spacing + ROAD_GRID.start;

    // 交差点からの距離を計算
    const distToIntersection = Math.sqrt(
        Math.pow(x - nearestX, 2) +
        Math.pow(z - nearestZ, 2)
    );

    return distToIntersection < threshold;
}

// 初期エージェントの作成
function createInitialAgents() {
    const colors = [0x2266cc, 0xcc2266, 0x66cc22, 0xcccc22, 0x22cccc, 0xcc22cc];

    // エージェントの数を増やす（20台）
    for (let i = 0; i < 20; i++) {
        // ランダムな道路位置を選択
        const isVertical = Math.random() < 0.5;
        let x, z;

        if (isVertical) {
            // 南北の道路上
            x = ROAD_GRID.start + Math.floor(Math.random() * 9) * ROAD_GRID.spacing;
            z = ROAD_GRID.start + Math.random() * (ROAD_GRID.end - ROAD_GRID.start);
        } else {
            // 東西の道路上
            x = ROAD_GRID.start + Math.random() * (ROAD_GRID.end - ROAD_GRID.start);
            z = ROAD_GRID.start + Math.floor(Math.random() * 9) * ROAD_GRID.spacing;
        }

        const rotation = isVertical ? (Math.random() < 0.5 ? 0 : Math.PI) :
            (Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2);

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
            lastIntersection: -1000  // 前回の交差点通過からのフレーム数
        };

        scene.add(car);
        agents.push(car);
    }
}

// エージェントの更新
function updateAgents() {
    agents.forEach(agent => {
        const pos = agent.position;

        // 交差点での方向転換の処理
        if (isIntersection(pos)) {
            if (agent.userData.lastIntersection < -20) {  // 前回の交差点から十分離れている
                if (Math.random() < 0.3) {  // 30%の確率で曲がる
                    // 90度右か左に曲がる
                    const turnDirection = Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
                    agent.rotation.y += turnDirection;
                    agent.userData.direction.set(
                        Math.sin(agent.rotation.y),
                        0,
                        Math.cos(agent.rotation.y)
                    );
                    agent.userData.isOnVerticalRoad = !agent.userData.isOnVerticalRoad;
                }
                agent.userData.lastIntersection = 0;  // カウンターをリセット
            }
        }
        agent.userData.lastIntersection--;  // カウンターを減少

        // 移動処理
        const direction = agent.userData.direction.clone();
        agent.position.add(direction.multiplyScalar(agent.userData.speed));

        // 道路に沿うように位置を補正
        const snappedPos = snapToRoad(pos);
        if (agent.userData.isOnVerticalRoad) {
            pos.x = snappedPos.x;
        } else {
            pos.z = snappedPos.z;
        }

        // マップ外に出たら反対側に移動
        if (pos.x > ROAD_GRID.end + 10) pos.x = ROAD_GRID.start - 10;
        if (pos.x < ROAD_GRID.start - 10) pos.x = ROAD_GRID.end + 10;
        if (pos.z > ROAD_GRID.end + 10) pos.z = ROAD_GRID.start - 10;
        if (pos.z < ROAD_GRID.start - 10) pos.z = ROAD_GRID.end + 10;
    });
}

// アニメーションループ
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    updateAgents();
    renderer.render(scene, camera);
}

// ウィンドウリサイズ対応
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// イベントリスナー
window.addEventListener('resize', onWindowResize, false);

// 初期化と開始
initScene();
animate(); 