import os
import json
from flask import Flask, render_template, jsonify, request
from flask_socketio import SocketIO

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app)

@app.route('/')
def index():
    return "Go to /map"

@app.route('/map')
def map_html():
    # templates/map.html を返す想定
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
    data = request.get_json()
    if not data:
        return jsonify({"status": "No data received"}), 400

    # データを配列に変換
    agents_data = []
    for agent in data:
        agents_data.append({
            'id': agent.get('id'),
            'x': agent.get('x'),
            'y': agent.get('y')
        })

    # エージェントデータをブロードキャスト
    socketio.emit('new_data', {'agents': agents_data})
    print(f"Broadcasting {len(agents_data)} agents")

    return jsonify({"status": "Data received"}), 200

@app.route('/buildings')
def buildings():
    # たとえば map/buildings.json を読み込んで返す
    file_path = os.path.join(os.path.dirname(__file__), 'map', 'buildings.json')
    if not os.path.exists(file_path):
        return jsonify([])
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    return jsonify(data)

if __name__ == '__main__':
    # socketio.run で起動し、/socket.io/socket.io.js も正しく配信される
    socketio.run(app, host='0.0.0.0', port=8000, debug=True)