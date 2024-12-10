from flask import Flask, jsonify
import random

app = Flask(__name__)

# エージェント数の定義
NUM_AGENTS = 30

# エージェントデータの初期化
agents = []
gama_references = {}

for i in range(NUM_AGENTS):
    agent_ref = f'Intersection_model[0].Car[{i}]'
    agent_data = {
        'attributes': {
            'loc': {
                'x': random.uniform(0, 4000),  # X座標の範囲
                'y': random.uniform(0, 4000),  # Y座標の範囲
                'z': 0.0
            },
            # 他の属性を必要に応じて追加
        },
        'gaml_species': 'Car',
        'index': i
    }
    agents.append({'agent_reference': agent_ref})
    gama_references[agent_ref] = agent_data

@app.route('/get_data', methods=['GET'])
def get_data():
    # 必要に応じてエージェントの位置を更新（例: ランダムに移動）
    for agent_ref in gama_references:
        gama_references[agent_ref]['attributes']['loc']['x'] += random.uniform(-10, 10)
        gama_references[agent_ref]['attributes']['loc']['y'] += random.uniform(-10, 10)
        # 境界を設定（0 ~ 4000）
        gama_references[agent_ref]['attributes']['loc']['x'] = max(0, min(4000, gama_references[agent_ref]['attributes']['loc']['x']))
        gama_references[agent_ref]['attributes']['loc']['y'] = max(0, min(4000, gama_references[agent_ref]['attributes']['loc']['y']))
    
    response_data = {
        'status': 'success',
        'data': {
            'gama_contents': {
                'agents': agents,
                # 他のコンテンツがあればここに追加
            },
            'gama_references': gama_references
        }
    }
    return jsonify(response_data)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000)