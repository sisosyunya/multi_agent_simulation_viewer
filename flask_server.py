from flask import Flask, jsonify, request
import random

app = Flask(__name__)

# ---- グローバル変数（GAMAからのエージェント情報を格納）----
agents = []           # [{ 'agent_reference': 'xxx' }, ... ]
gama_references = {}  # { 'Intersection_model[0].Car[0]': {...}, ... }

# -------------------------------
#  ① GAMAからデータを受け取るためのエンドポイント
# -------------------------------
@app.route("/data_from_gama", methods=["POST"])
def data_from_gama():
    """
    GAMAシミュレーション側がPOSTするエージェントの位置・状態情報を受け取る。
    受け取ったデータをグローバル変数に保存。
    """
    data = request.get_json()  # 例: {'agents': [...], 'gama_references': {...}}
    if not data:
        return jsonify({"status": "error", "message": "No data received"}), 400

    # data は { 'agents': [...], 'gama_references': {...} } の形式を想定
    global agents, gama_references
    agents = data.get('agents', [])
    gama_references = data.get('gama_references', {})

    print(f"Received from GAMA: {len(agents)} agents.")
    return jsonify({"status": "success"}), 200


# -------------------------------
#  ② Viewer から可視化用にエージェント情報を返すエンドポイント
# -------------------------------
@app.route('/get_data', methods=['GET'])
def get_data():
    """
    Viewer (matplotlib等)がアクセスし、GAMAから受け取った最新のエージェント位置情報を返す。
    """
    response_data = {
        'status': 'success',
        'data': {
            'gama_contents': {
                'agents': agents
            },
            'gama_references': gama_references
        }
    }
    return jsonify(response_data)

# -------------------------------
#   メイン
# -------------------------------
if __name__ == '__main__':
    # Flaskを起動 (portやhostは環境に合わせて調整)
    app.run(host='0.0.0.0', port=8000, debug=True)