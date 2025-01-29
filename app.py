import os
import json
from flask import Flask, render_template, jsonify, request
from flask_socketio import SocketIO
import random
import math
import numpy as np
from datetime import datetime

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

# グローバル変数
agent_history = []  # 全フレームのデータを保持
current_frame = 0   # 現在のフレーム番号
is_paused = False  # 一時停止状態
road_data = None


def compute_affine_transformation(src_points, dst_points):
    """
    4つの対応する点を使用してアフィン変換行列を計算
    src_points: 元の座標系の4点 [(x1, y1), (x2, y2), (x3, y3), (x4, y4)]
    dst_points: 対応する目標座標系の4点 [(x1', y1'), (x2', y2'), (x3', y3'), (x4', y4')]
    """
    # ソースとターゲット座標をNumPy配列に変換
    src_points = np.array(src_points)
    dst_points = np.array(dst_points)

    # ソース座標の行列を構築
    A = []
    for (x, y), (x_prime, y_prime) in zip(src_points, dst_points):
        A.append([x, y, 1, 0, 0, 0, -x * x_prime, -y * x_prime])
        A.append([0, 0, 0, x, y, 1, -x * y_prime, -y * y_prime])

    A = np.array(A)

    # 目標座標のベクトルを構築
    B = dst_points.flatten()

    # アフィン変換行列の要素を計算
    H = np.linalg.lstsq(A, B, rcond=None)[0]
    H = np.append(H, 1).reshape(3, 3)  # 3x3行列に変形
    return H

def transform_point(P, H):
    """
    アフィン変換行列Hを使って点Pを変換
    P: (x, y) の座標
    H: 3x3のアフィン変換行列
    """
    x, y = P
    point = np.array([x, y, 1])
    transformed_point = np.dot(H, point)
    transformed_point /= transformed_point[2]  # 正規化
    return transformed_point[:2]


#GAMA上の座標とThree.js上の位置合わせのためのアフィン変換行列の計算=====
#GAMA座標系の4点ABCD
A = (649.8888940885663,357.4444473045878);
B = (2463.3611308187246,407.36111437063664);
C = (2130.472239267081,1724.8333471324295);
D = (505.63889293558896,1745.250013962388);
#Three.js座標系の4点EFGH
E = (-821, -772);
F = (1232, -702);
G = (861, 1121);
H = (-983, 1150);
# 四角形の4点（元の座標系）
src_points = [A,B,C,D]
# 対応する四角形の4点（目標座標系）
dst_points = [E,F,G,H]
# アフィン変換行列を計算
H = compute_affine_transformation(src_points, dst_points)
#=================================================================



# 道路データの読み込み
def load_road_data():
    global road_data
    file_path = os.path.join(os.path.dirname(__file__), 'map', 'roads.json')
    if os.path.exists(file_path):
        with open(file_path, 'r', encoding='utf-8') as f:
            road_data = json.load(f)
    else:
        road_data = []

# 道路上のランダムな位置を取得
def get_random_road_position():
    if not road_data:
        return (13550000, 3480000)  # デフォルト位置

    # ランダムな道路を選択
    road = random.choice(road_data)
    if not road.get('geometry') or not road['geometry'].get('coordinates'):
        return (13550000, 3480000)

    coords = road['geometry']['coordinates']
    if len(coords) < 2:
        return (13550000, 3480000)

    # 道路上のランダムな位置を選択
    idx = random.randint(0, len(coords) - 2)
    p1 = coords[idx]
    p2 = coords[idx + 1]
    t = random.random()  # 0から1の間のランダムな値

    # 2点間の線形補間
    x = p1[0] + (p2[0] - p1[0]) * t
    y = p1[1] + (p2[1] - p1[1]) * t

    return (x, y)

# 道路に沿った次の位置を取得
def get_next_road_position(current_x, current_y, speed=10):
    if not road_data:
        return (current_x + random.uniform(-speed, speed),
                current_y + random.uniform(-speed, speed))

    # 最も近い道路セグメントを見つける
    min_dist = float('inf')
    next_pos = None
    direction = None

    for road in road_data:
        if not road.get('geometry') or not road['geometry'].get('coordinates'):
            continue

        coords = road['geometry']['coordinates']
        for i in range(len(coords) - 1):
            p1 = coords[i]
            p2 = coords[i + 1]

            # 現在位置から道路セグメントまでの距離を計算
            dx = p2[0] - p1[0]
            dy = p2[1] - p1[1]
            segment_length = math.sqrt(dx * dx + dy * dy)
            
            if segment_length == 0:
                continue

            # 道路セグメントへの投影点を計算
            t = ((current_x - p1[0]) * dx + (current_y - p1[1]) * dy) / (segment_length * segment_length)
            t = max(0, min(1, t))

            proj_x = p1[0] + t * dx
            proj_y = p1[1] + t * dy
            
            dist = math.sqrt((current_x - proj_x)**2 + (current_y - proj_y)**2)

            if dist < min_dist:
                min_dist = dist
                # 道路に沿って進む方向を計算
                if t < 0.95:  # セグメントの終点に近づいていない場合
                    direction = (dx / segment_length, dy / segment_length)
                else:  # セグメントの終点に近い場合、次のセグメントがあれば使用
                    if i < len(coords) - 2:
                        next_dx = coords[i+2][0] - p2[0]
                        next_dy = coords[i+2][1] - p2[1]
                        next_length = math.sqrt(next_dx * next_dx + next_dy * next_dy)
                        direction = (next_dx / next_length, next_dy / next_length)
                    else:
                        direction = (dx / segment_length, dy / segment_length)

    if direction:
        # 現在の位置から道路に沿って移動
        next_x = current_x + direction[0] * speed
        next_y = current_y + direction[1] * speed
        return (next_x, next_y)
    else:
        # 道路が見つからない場合はランダムに移動
        return (current_x + random.uniform(-speed, speed),
                current_y + random.uniform(-speed, speed))

# デモデータ生成用の関数
def generate_demo_agents(num_agents=10):
    agents = []
    for i in range(num_agents):
        x, y = get_random_road_position()
        agents.append({
            'id': i,
            'x': x,
            'y': y
        })
    
    print(f"Generated {num_agents} agents")
    print(f"Sample agent position: {agents[0]}")
    return agents

# 初期化
load_road_data()
initial_demo_data = generate_demo_agents()
agent_history = [initial_demo_data]

@app.route('/')
def index():
    return "Go to /map"

@app.route('/map')
def map_html():
    try:
        # 初期データをブロードキャスト
        socketio.emit('new_data', {
            'agents': initial_demo_data,
            'frame': 0,
            'total_frames': 1
        })
    except Exception as e:
        print(f"Error broadcasting initial data: {e}")
    return render_template('map.html')

@app.route('/roads')
def roads():
    file_path = os.path.join(os.path.dirname(__file__), 'map', 'roads.json')
    if not os.path.exists(file_path):
        return jsonify([])
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    return jsonify(data)

def save_agent_history():
    """エージェントの履歴データを保存"""
    if not agent_history:
        return
    
    # データ保存用のディレクトリを作成
    save_dir = os.path.join(os.path.dirname(__file__), 'data')
    os.makedirs(save_dir, exist_ok=True)
    
    # タイムスタンプを含むファイル名を生成
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f'agent_history_{timestamp}.json'
    filepath = os.path.join(save_dir, filename)
    
    # データを保存
    try:
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump({
                'total_frames': len(agent_history),
                'frames': agent_history
            }, f, indent=2)
        print(f"Data saved to {filepath}")
        return filepath
    except Exception as e:
        print(f"Error saving data: {e}")
        return None

def load_agent_history(filepath):
    """保存されたエージェントの履歴データを読み込む"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
            return data['frames']
    except Exception as e:
        print(f"Error loading data: {e}")
        return []

@socketio.on('playback_control')
def handle_playback_control(data):
    """再生制御を処理するイベントハンドラ"""
    global is_paused, current_frame
    
    command = data.get('command')
    if command == 'pause':
        is_paused = True
        print("Playback paused")
    elif command == 'resume':
        is_paused = False
        print("Playback resumed")
    
    # 現在の状態をクライアントに通知
    socketio.emit('playback_status', {
        'is_paused': is_paused,
        'current_frame': current_frame,
        'total_frames': len(agent_history)
    })

@app.route('/data_from_gama', methods=['POST'])
def data_from_gama():
    try:
        data = request.get_json(force=True)
        if not data:
            print("No data received")
            return jsonify({"status": "No data received"}), 400

        # データを配列に変換
        agents_data = []
        for agent in data:
            agent_xy_transformed = transform_point((agent['x'],agent['y']), H)
            try:
                agent_data = {
                    'id': int(agent['id']),
                    'x': float(agent_xy_transformed[0]),
                    'y': float(agent_xy_transformed[1])
                }
                agents_data.append(agent_data)
            except (KeyError, ValueError, TypeError) as e:
                print(f"Error processing agent data: {e}")
                continue

        # 履歴に追加
        agent_history.append(agents_data)
        frame_number = len(agent_history) - 1
        print(f"Frame {frame_number} saved, total agents: {len(agents_data)}")

        # 100フレームごとにデータを保存
        if frame_number > 0 and frame_number % 100 == 0:
            save_agent_history()

        # 一時停止中でない場合のみ、最新のデータをブロードキャスト
        if not is_paused:
            socketio.emit('new_data', {
                'agents': agents_data,
                'frame': frame_number,
                'total_frames': len(agent_history)
            })

        return jsonify({
            "status": "success",
            "frame": frame_number,
            "agent_count": len(agents_data)
        }), 200

    except Exception as e:
        print(f"Error processing request: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 400

@app.route('/save_data', methods=['POST'])
def save_data():
    """現在のデータを手動で保存するエンドポイント"""
    filepath = save_agent_history()
    if filepath:
        return jsonify({
            "status": "success",
            "message": "Data saved successfully",
            "filepath": filepath
        })
    else:
        return jsonify({
            "status": "error",
            "message": "Failed to save data"
        }), 500

@app.route('/load_data', methods=['POST'])
def load_data():
    """保存されたデータを読み込むエンドポイント"""
    try:
        filepath = request.json.get('filepath')
        if not filepath:
            return jsonify({"status": "error", "message": "No filepath provided"}), 400
        
        global agent_history
        agent_history = load_agent_history(filepath)
        
        if agent_history:
            return jsonify({
                "status": "success",
                "message": "Data loaded successfully",
                "total_frames": len(agent_history)
            })
        else:
            return jsonify({
                "status": "error",
                "message": "Failed to load data"
            }), 500
            
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

@app.route('/buildings')
def buildings():
    file_path = os.path.join(os.path.dirname(__file__), 'map', 'buildings.json')
    if not os.path.exists(file_path):
        return jsonify([])
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    return jsonify(data)

@socketio.on('request_frame')
def handle_frame_request(frame_number):
    if 0 <= frame_number < len(agent_history):
        socketio.emit('new_data', {
            'agents': agent_history[frame_number],
            'frame': frame_number,
            'total_frames': len(agent_history)
        })

# デモ用のデータ更新エンドポイント
@app.route('/update_demo', methods=['POST'])
def update_demo():
    global agent_history
    
    last_frame = agent_history[-1]
    new_frame = []
    
    for agent in last_frame:
        # 道路に沿って移動
        new_x, new_y = get_next_road_position(agent['x'], agent['y'])
        new_frame.append({
            'id': agent['id'],
            'x': new_x,
            'y': new_y
        })
    
    agent_history.append(new_frame)
    current_frame = len(agent_history) - 1
    
    print(f"Frame {current_frame}: Updated {len(new_frame)} agents")
    print(f"Sample agent position: {new_frame[0]}")
    
    socketio.emit('new_data', {
        'agents': new_frame,
        'frame': current_frame,
        'total_frames': len(agent_history)
    })
    
    return jsonify({
        "status": "success",
        "frame": current_frame,
        "agent_count": len(new_frame)
    })

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=8000, debug=True)
