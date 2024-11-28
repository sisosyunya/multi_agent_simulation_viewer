# flask_server.py

from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import json

# Flaskアプリケーションの初期化
app = Flask(__name__)
CORS(app)  # CORSを有効化

# SocketIOの初期化
socketio = SocketIO(app, cors_allowed_origins="*")

# グローバル変数（必要に応じて拡張）
car_size = 6
sim_speed = 0.0
policies = {'switch1': False, 'switch2': False, 'switch3': False, 'switch4': False}
heatmap_flag = False

@app.route('/')
def index():
    return "Flask Server is Running."

@app.route('/update', methods=['POST'])
def update():
    global car_size, sim_speed, policies, heatmap_flag
    try:
        inputData = request.json

        # データの更新
        policies = inputData.get("policies", policies)
        car_size = int(inputData.get("car_size", car_size))
        sim_speed = float(inputData.get("sim_speed", sim_speed))
        heatmap_flag = bool(inputData.get("heatmap_flag", heatmap_flag))
        
        # エージェント情報の取得
        agents = inputData.get('agents', [])
        
        # ログ出力
        print(f"Received data: {inputData}")
        
        # Viewerにデータをブロードキャスト
        socketio.emit('update', {
            'car_size': car_size,
            'sim_speed': sim_speed,
            'policies': policies,
            'heatmap_flag': heatmap_flag,
            'agents': agents
        })
        
        return jsonify({"status": "success"}), 200
    except Exception as e:
        print(f"Error processing data: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@socketio.on('connect')
def handle_connect():
    print("Viewer connected.")

@socketio.on('disconnect')
def handle_disconnect():
    print("Viewer disconnected.")

if __name__ == "__main__":
    # FlaskアプリケーションをSocketIOで実行
    socketio.run(app, port=8000, host='0.0.0.0', debug=False)