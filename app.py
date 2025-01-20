import os
import json
from flask import Flask, render_template, jsonify, request
from flask_socketio import SocketIO
import random
import math

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

# グローバル変数として履歴を保存
agent_history = []

# デモデータ生成用の関数
def generate_demo_agents(num_agents=100):
    agents = []
    radius = 1000  # 円の半径
    center_x = 2000  # 中心のX座標
    center_y = 1500  # 中心のY座標
    
    for i in range(num_agents):
        # 円周上の位置をランダムに生成
        angle = random.uniform(0, 2 * math.pi)
        r = random.uniform(0, radius)
        x = center_x + r * math.cos(angle)
        y = center_y + r * math.sin(angle)
        
        agents.append({
            'id': i,
            'x': x,
            'y': y
        })
    return agents

# 初期デモデータを生成
initial_demo_data = generate_demo_agents()
agent_history = [initial_demo_data]  # 初期データを履歴に追加

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
    # たとえば map/roads.json を読み込んで返す
    file_path = os.path.join(os.path.dirname(__file__), 'map', 'roads.json')
    if not os.path.exists(file_path):
        return jsonify([])  # ファイルが無い時の暫定措置
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    return jsonify(data)

@app.route('/data_from_gama', methods=['POST'])
def data_from_gama():
    try:
        data = request.get_json(force=True)  # force=True を追加
        if not data:
            print("No data received")
            return jsonify({"status": "No data received"}), 400

        # データ形式のデバッグ出力
        print("Received data type:", type(data))
        print("Received data:", data[:2] if isinstance(data, list) else data)

        # データを配列に変換
        agents_data = []
        for agent in data:
            try:
                agent_data = {
                    'id': int(agent['id']),  # 明示的に型変換
                    'x': float(agent['x']),
                    'y': float(agent['y'])
                }
                agents_data.append(agent_data)
            except (KeyError, ValueError, TypeError) as e:
                print(f"Error processing agent data: {e}")
                print(f"Problematic agent data: {agent}")
                continue

        # 履歴に追加
        agent_history.append(agents_data)
        current_frame = len(agent_history) - 1

        # デバッグ出力
        print(f"\n=== Frame {current_frame} ===")
        print(f"Total agents: {len(agents_data)}")
        for agent in agents_data[:3]:
            print(f"Agent {agent['id']}: x={agent['x']:.2f}, y={agent['y']:.2f}")

        # エージェントデータをブロードキャスト
        socketio.emit('new_data', {
            'agents': agents_data,
            'frame': current_frame,
            'total_frames': len(agent_history)
        })

        return jsonify({
            "status": "success",
            "frame": current_frame,
            "agent_count": len(agents_data)
        }), 200

    except Exception as e:
        print(f"Error processing request: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 400

@app.route('/buildings')
def buildings():
    # たとえば map/buildings.json を読み込んで返す
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

# デモ用のデータ更新エンドポイントを追加
@app.route('/update_demo', methods=['POST'])
def update_demo():
    global agent_history
    
    # 前のフレームのエージェントを少し移動させた新しいフレームを生成
    last_frame = agent_history[-1]
    new_frame = []
    
    for agent in last_frame:
        # ランダムな移動を追加
        new_x = agent['x'] + random.uniform(-50, 50)
        new_y = agent['y'] + random.uniform(-50, 50)
        
        new_frame.append({
            'id': agent['id'],
            'x': new_x,
            'y': new_y
        })
    
    # 新しいフレームを履歴に追加
    agent_history.append(new_frame)
    current_frame = len(agent_history) - 1
    
    # 新しいフレームをブロードキャスト
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
    # socketio.run で起動し、/socket.io/socket.io.js も正しく配信される
    socketio.run(app, host='0.0.0.0', port=8000, debug=True)