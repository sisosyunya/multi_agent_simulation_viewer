# flask_server.py

from flask import Flask, request, jsonify
from flask_cors import CORS
import threading

app = Flask(__name__)
CORS(app)  # CORSを有効化

# グローバル変数としてデータを保持
data_lock = threading.Lock()
received_data = []

@app.route('/')
def index():
    return "Flask Server is Running."

@app.route('/test', methods=['POST'])
def test():
    data = request.json  # GAMA側から送られたJSONを取得
    print("Received data from GAMA:", data)
    # 簡単なレスポンスを返す
    return jsonify({"message": "Received your data", "echo": data}), 200

@app.route('/update', methods=['POST'])
def update():
    try:
        inputData = request.json

        # スレッドセーフにデータを追加
        with data_lock:
            received_data.append(inputData)
            # データ量が多くなりすぎないように最新100件に制限（必要に応じて調整）
            if len(received_data) > 100:
                received_data.pop(0)
        
        # ログ出力
        print(f"Received data: {inputData}")
        
        return jsonify({"status": "success"}), 200
    except Exception as e:
        print(f"Error processing data: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/get_data', methods=['GET'])
def get_data():
    try:
        with data_lock:
            # 最新のデータを返す。全データを返す場合は received_data をそのまま返す
            # 最新1件のみ返す場合は received_data[-1] を返す
            # ここでは最新10件を返す例とします
            latest_data = received_data[-10:] if len(received_data) >= 10 else received_data.copy()
        
        print(f"Sending latest data: {latest_data}")
        return jsonify({"status": "success", "data": latest_data}), 200
    except Exception as e:
        print(f"Error fetching data: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == "__main__":
    # Flaskアプリケーションを実行
    app.run(port=8000, host='0.0.0.0', debug=False)