from flask import Flask, render_template, jsonify, request
from flask_socketio import SocketIO, emit
import json
import os

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app)

# ---------- 履歴管理用 ----------
history = []       # [{ 'agents': [...], 'gama_references': {...}, 'frame_id': 0 }, ...]
current_index = -1 # 現在のフレーム（-1 は未設定の意）

@app.route('/')
def index():
    return "Go to /map"

@app.route('/map')
def map_view():
    """
    地図表示用HTML
    """
    return render_template('map.html')

# roads.json / buildings.json は既存のまま
@app.route('/roads')
def roads():
    file_path = os.path.join(os.path.dirname(__file__), 'map', 'road.json')
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    return jsonify(data)

@app.route('/buildings')
def buildings():
    file_path = os.path.join(os.path.dirname(__file__), 'map', 'building.json')
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    return jsonify(data)

@app.route('/data_from_gama', methods=['POST'])
def data_from_gama():
    """
    GAMAシミュレーションからフレームごとにPOSTされるエージェント情報。
    例: { 'agents': [...], 'gama_references': {...}, 'frame_id': 10 }
    """
    global history, current_index
    data = request.get_json()
    if not data:
        return jsonify({"status": "error"}), 400
    
    # 受け取ったフレームを履歴に追加
    history.append(data)
    current_index = len(history) - 1

    # 最新フレームをブラウザへ配信 (リアルタイム更新)
    socketio.emit('agent_data', data, broadcast=True)

    print(f"[Flask] Received frame #{current_index} from GAMA")
    return jsonify({"status": "success"}), 200


# --------- 巻き戻し / 早送り用のAPI例 ---------
@app.route('/go_to_frame', methods=['POST'])
def go_to_frame():
    """
    例えば、クライアントが JSON { 'frame': 5 } を送信すると、
    history[5] を送る。
    """
    global current_index
    req = request.get_json()
    if 'frame' not in req:
        return jsonify({"status": "error", "message": "No frame in request"}), 400

    frame = req['frame']
    if frame < 0 or frame >= len(history):
        return jsonify({"status": "error", "message": "Frame out of range"}), 400

    current_index = frame
    frame_data = history[current_index]

    # 指定フレームを再度ブラウザへ送る
    socketio.emit('agent_data', frame_data, broadcast=True)

    return jsonify({"status": "success", "frame": current_index}), 200

@app.route('/pause', methods=['POST'])
def pause():
    """
    一時停止 → 実際には「サーバーが新しいフレームを送信しない」とか
    「GAMA側のHTTP送信を止める」などの運用になる。
    ここではサーバー側では特に何もしない例。
    """
    # 必要に応じて「is_paused = True」などのフラグを立ててもOK
    return jsonify({"status": "paused"}), 200

@app.route('/resume', methods=['POST'])
def resume():
    """
    再開 → 「is_paused = False」とする等。
    """
    return jsonify({"status": "resumed"}), 200


@socketio.on('connect')
def on_connect():
    print("[Flask] A client connected via Socket.IO")
    # 接続したクライアントに最新フレームを送る (あれば)
    if 0 <= current_index < len(history):
        emit('agent_data', history[current_index])


if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=8000, debug=True)