import socketio
import matplotlib.pyplot as plt
import matplotlib.animation as animation
from matplotlib.widgets import Button
import networkx as nx
import osmnx as ox

# SocketIOクライアントの初期化
sio = socketio.Client()

# グローバル変数で受信データを保持
received_data = {
    'car_size': 6,
    'sim_speed': 0.0,
    'policies': {'switch1': False, 'switch2': False, 'switch3': False, 'switch4': False},
    'heatmap_flag': False,
    'agents': []
}

@sio.event
def connect():
    print('Connected to Flask server.')

@sio.event
def disconnect():
    print('Disconnected from Flask server.')

@sio.on('update')
def on_update(data):
    print('Received update from Flask:', data)
    # データをグローバル変数に保存
    received_data.update(data)

def run_viewer():
    global received_data
    # 地図をプロット（軽量化）
    place = 'Ibarakishi, Osaka, Japan'
    G = ox.graph_from_place(place, network_type='drive')
    fig, ax = ox.plot_graph(G, show=False, close=False, node_size=0, edge_color='gray', bgcolor='white')
    plt.title("Road Simulation Viewer")
    
    # 車両の散布図をエージェント数に応じて作成
    agent_scatters = {}
    colors = plt.cm.Set1.colors
    num_agents = 10  # 必要に応じて変更
    for i in range(num_agents):
        scatter = ax.scatter([], [], c=[colors[i % len(colors)]], s=50, label=f'Agent {i}')
        agent_scatters[i] = scatter
    
    plt.legend(loc='upper right')
    
    # ボタンの配置
    ax_play = plt.axes([0.7, 0.01, 0.1, 0.05])    # 再生ボタンの位置
    ax_pause = plt.axes([0.81, 0.01, 0.1, 0.05])   # 一時停止ボタンの位置
    ax_step_forward = plt.axes([0.59, 0.01, 0.1, 0.05])  # 進めるボタンの位置
    ax_step_backward = plt.axes([0.48, 0.01, 0.1, 0.05]) # 巻き戻しボタンの位置
    
    btn_play = Button(ax_play, 'Play')
    btn_pause = Button(ax_pause, 'Pause')
    btn_step_forward = Button(ax_step_forward, 'Forward')
    btn_step_backward = Button(ax_step_backward, 'Back')
    
    # アニメーションの状態
    current_step = [0]
    num_steps = 200
    pause_flag = [False]
    
    # アニメーションの更新関数
    def update(frame_number):
        if not pause_flag[0]:
            # シミュレーションの状態を元に車両の位置を更新
            agents = received_data.get('agents', [])
            for agent_data in agents:
                agent_id = agent_data['id']
                x = agent_data['x']
                y = agent_data['y']
                if agent_id in agent_scatters:
                    agent_scatters[agent_id].set_offsets([x, y])
            ax.set_title(f"Step {current_step[0]}")
            current_step[0] += 1
        return list(agent_scatters.values())

    # ボタンのコールバック関数
    def play(event):
        pause_flag[0] = False
        ani.event_source.start()

    def pause_animation(event):
        pause_flag[0] = True
        ani.event_source.stop()

    def step_forward(event):
        if current_step[0] < num_steps:
            pause_flag[0] = True
            ani.event_source.stop()
            update(None)
            fig.canvas.draw_idle()

    def step_backward(event):
        # 巻き戻し機能の実装は複雑です。ここでは単純に現在の状態を再描画
        print("Step backward is not implemented.")

    # ボタンにコールバック関数をバインド
    btn_play.on_clicked(play)
    btn_pause.on_clicked(pause_animation)
    btn_step_forward.on_clicked(step_forward)
    btn_step_backward.on_clicked(step_backward)
    
    # アニメーションの設定
    ani = animation.FuncAnimation(fig, update, interval=500, repeat=False)
    
    plt.show()

def main():
    # Flaskサーバーに接続
    sio.connect('http://localhost:8000')
    
    # Viewerを実行
    run_viewer()
    
    # Flaskサーバーからのデータ受信を待つ
    sio.wait()

if __name__ == "__main__":
    main()