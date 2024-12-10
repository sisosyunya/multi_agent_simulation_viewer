# viewer.py

import requests
import matplotlib.pyplot as plt
from matplotlib.widgets import Button

# データ取得関数
def fetch_data():
    try:
        response = requests.get('http://localhost:8000/get_data')
        if response.status_code == 200:
            data = response.json()
            print(f"取得したデータの型: {type(data)}")  # デバッグ用
            print(f"取得したデータ: {data}")           # デバッグ用
            if isinstance(data, dict) and data.get('status') == 'success':
                return data.get('data', {})  # デフォルトを辞書に変更
            elif isinstance(data, list):
                return data  # データがリストの場合そのまま返す
            else:
                print(f"Error from server: {data.get('message') if isinstance(data, dict) else 'No message'}")
                return {}
        else:
            print(f"HTTP Error: {response.status_code}")
            return {}
    except Exception as e:
        print(f"Error fetching data: {e}")
        return {}

# プロット更新関数
def update_plot(ax, scatter, data):
    ax.cla()  # 現在の軸をクリア

    plt.title("Road Simulation Viewer")

    if isinstance(data, dict):
        # 'gama_contents'と'gama_references'を取得
        gama_contents = data.get('gama_contents', {})
        gama_references = data.get('gama_references', {})

        # エージェントのリストを取得
        agents = gama_contents.get('agents', [])

        if not agents:
            print("No agents found in 'gama_contents'.")
            return scatter

        # エージェントの座標を抽出
        x_coords = []
        y_coords = []
        for agent in agents:
            agent_ref = agent.get('agent_reference')
            if not agent_ref:
                print("Agent entry missing 'agent_reference'.")
                continue

            agent_data = gama_references.get(agent_ref, {})
            attributes = agent_data.get('attributes', {})
            loc = attributes.get('loc', {})

            x = loc.get('x')
            y = loc.get('y')

            if x is not None and y is not None:
                x_coords.append(x)
                y_coords.append(y)
            else:
                print(f"Agent '{agent_ref}' missing 'x' or 'y' in 'loc'.")

    elif isinstance(data, list):
        # データがリストの場合
        agents = data
        x_coords = []
        y_coords = []
        for agent in agents:
            attributes = agent.get('attributes', {})
            loc = attributes.get('loc', {})
            x = loc.get('x')
            y = loc.get('y')
            if x is not None and y is not None:
                x_coords.append(x)
                y_coords.append(y)
            else:
                print(f"Agent missing 'x' or 'y' in 'loc': {agent}")

    else:
        print(f"Unexpected data format: {type(data)}")
        return scatter

    if not x_coords or not y_coords:
        print("No valid agent coordinates to plot.")
        return scatter

    # 座標の最小値と最大値を計算
    min_x, max_x = min(x_coords), max(x_coords)
    min_y, max_y = min(y_coords), max(y_coords)
    print(f"座標範囲 - X: {min_x} ~ {max_x}, Y: {min_y} ~ {max_y}")

    # プロット範囲の設定（動的バッファ）
    buffer_ratio = 0.1  # 座標範囲の10%をバッファとする
    buffer_x = (max_x - min_x) * buffer_ratio
    buffer_y = (max_y - min_y) * buffer_ratio
    ax.set_xlim(min_x - buffer_x, max_x + buffer_x)
    ax.set_ylim(min_y - buffer_y, max_y + buffer_y)

    # エージェントの位置を散布図としてプロット
    scatter = ax.scatter(x_coords, y_coords, c='blue', s=50, label='Agents')

    # 凡例の設定
    ax.legend(loc='upper right')

    plt.draw()
    return scatter

# Fetchボタンのコールバック関数
def on_fetch(event, ax, scatter):
    print("Fetchボタンが押されました。データを取得中...")
    data = fetch_data()
    # print(f"取得したデータ: {data}")  # デバッグ用

    if data:
        scatter = update_plot(ax, scatter, data)
        # エージェント数の計算
        if isinstance(data, dict):
            gama_contents = data.get('gama_contents', {})
            agents = gama_contents.get('agents', [])
            agent_count = len(agents)
        elif isinstance(data, list):
            agents = data
            agent_count = len(agents)
        else:
            agent_count = 0
        print(f"取得したエージェント数: {agent_count}")
    else:
        print("データが取得できませんでした。")
    return scatter

def run_viewer():
    # 白背景のプロットを作成
    fig, ax = plt.subplots(figsize=(10, 10))
    fig.subplots_adjust(bottom=0.15)  # ボタンのスペースを確保
    ax.set_facecolor('white')
    plt.title("Road Simulation Viewer")

    # 初期の散布図（空）
    scatter = ax.scatter([], [], c='blue', s=50, label='Agents')
    ax.legend(loc='upper right')

    # ボタンの配置
    ax_fetch = plt.axes([0.4, 0.05, 0.2, 0.075])  # Fetchボタンの位置とサイズ
    btn_fetch = Button(ax_fetch, 'Fetch')

    # ボタンにコールバック関数をバインド
    def fetch_callback(event):
        nonlocal scatter
        scatter = on_fetch(event, ax, scatter)

    btn_fetch.on_clicked(fetch_callback)

    plt.show()

if __name__ == "__main__":
    run_viewer()