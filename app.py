import os
import json
from flask import Flask, render_template, jsonify
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