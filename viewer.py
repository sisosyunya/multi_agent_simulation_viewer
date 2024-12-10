# viewer.py

import requests
import matplotlib.pyplot as plt
from matplotlib.widgets import Button
import osmnx as ox

# データ取得関数
def fetch_data():
    try:
        response = requests.get('http://localhost:8000/get_data')
        if response.status_code == 200:
            data = response.json()
            if data.get('status') == 'success':
                return data.get('data', [])
            else:
                print(f"Error from server: {data.get('message')}")
                return []
        else:
            print(f"HTTP Error: {response.status_code}")
            return []
    except Exception as e:
        print(f"Error fetching data: {e}")
        return []

# プロット更新関数
def update_plot(ax, scatter, data, place='Ibaraki, Osaka, Japan'):
    ax.cla()  # 現在の軸をクリア
    
    # 地図を再描画
    try:
        G = ox.graph_from_place(place, network_type='drive')
        ox.plot_graph(G, ax=ax, show=False, close=False, node_size=0, edge_color='gray', bgcolor='white')
    except Exception as e:
        print(f"Error fetching map data: {e}")
    
    plt.title("Road Simulation Viewer")
    
    # エージェントの座標を抽出
    x_coords = []
    y_coords = []
    for update in data:
        for agent_id, agent in update.items():
            if ('attributes' in agent and
                'loc' in agent['attributes'] and
                'x' in agent['attributes']['loc'] and
                'y' in agent['attributes']['loc']):
                x_coords.append(agent['attributes']['loc']['x'])
                y_coords.append(agent['attributes']['loc']['y'])
            else:
                print(f"Agent data missing 'attributes', 'loc', 'x', or 'y': {agent}")
    
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
    print(f"取得したデータ: {data}")  # デバッグ用
    if data:
        scatter = update_plot(ax, scatter, data)
        print(f"取得したエージェント数: {len(data)}")
    else:
        print("データが取得できませんでした。")
    return scatter

def run_viewer():
    place = 'Ibaraki, Osaka, Japan'  # 必要に応じて場所を変更
    try:
        G = ox.graph_from_place(place, network_type='drive')
        fig, ax = plt.subplots(figsize=(10, 10))
        ox.plot_graph(G, ax=ax, show=False, close=False, node_size=0, edge_color='gray', bgcolor='white')
    except Exception as e:
        print(f"Error fetching map data: {e}")
        fig, ax = plt.subplots(figsize=(10, 10))
        ax.set_title("Road Simulation Viewer")
    
    plt.title("Road Simulation Viewer")
    
    # 初期の散布図（空）
    scatter = ax.scatter([], [], c='blue', s=50, label='Agents')
    ax.legend(loc='upper right')
    
    # ボタンの配置
    ax_fetch = plt.axes([0.7, 0.02, 0.1, 0.05])  # Fetchボタンの位置
    btn_fetch = Button(ax_fetch, 'Fetch')
    
    # ボタンにコールバック関数をバインド
    def fetch_callback(event):
        nonlocal scatter
        scatter = on_fetch(event, ax, scatter)
    
    btn_fetch.on_clicked(fetch_callback)
    
    plt.show()

if __name__ == "__main__":
    run_viewer()