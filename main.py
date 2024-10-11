import osmnx as ox
import networkx as nx
import matplotlib.pyplot as plt
import random
import matplotlib.animation as animation
from matplotlib.widgets import Button

from mesa import Agent, Model
from mesa.time import RandomActivation

# エージェントの定義
class RoadAgent(Agent):
    def __init__(self, unique_id, model, start_node, end_node):
        super().__init__(unique_id, model)
        self.current_node = start_node
        self.end_node = end_node
        self.next_node_index = 1  # 次のノードへのインデックス
        self.path = self.get_shortest_path(self.current_node, self.end_node)

    def get_shortest_path(self, start, end):
        key = (start, end)
        if key in self.model.shortest_paths:
            return self.model.shortest_paths[key]
        else:
            path = nx.shortest_path(self.model.G, start, end, weight='length')
            self.model.shortest_paths[key] = path
            return path

    def step(self):
        if self.next_node_index < len(self.path):
            # 次のノードに移動
            self.current_node = self.path[self.next_node_index]
            self.next_node_index += 1
        else:
            # 目的地に到達したら新しい目的地を設定
            self.current_node = self.end_node
            self.end_node = random.choice(list(self.model.G.nodes()))
            self.next_node_index = 1
            self.path = self.get_shortest_path(self.current_node, self.end_node)

# モデルの定義
class RoadModel(Model):
    def __init__(self, N):
        super().__init__()
        self.num_agents = N
        self.schedule = RandomActivation(self)
        # 地図データを取得（小さな範囲）
        self.G = ox.graph_from_place('Ibarakishi, Osaka, Japan', network_type='drive')
        self.pos = {node: (data['x'], data['y']) for node, data in self.G.nodes(data=True)}
        self.shortest_paths = {}  # 経路のキャッシュ
        # 状態の履歴を保存するリスト
        self.state_history = []
        self.max_history = 100  # 保存する最大履歴数（必要に応じて調整）
        # エージェントを初期化
        self.agent_list = []
        nodes = list(self.G.nodes())
        for i in range(self.num_agents):
            start_node = random.choice(nodes)
            end_node = random.choice(nodes)
            agent = RoadAgent(i, self, start_node, end_node)
            self.schedule.add(agent)
            self.agent_list.append(agent)
        # 初期状態を保存
        self.save_state()

    def save_state(self):
        # 現在の状態をディープコピーして保存
        state = {
            'agents': [(agent.unique_id, agent.current_node, agent.end_node, agent.next_node_index, list(agent.path)) for agent in self.agent_list]
        }
        self.state_history.append(state)
        # 保存する履歴の最大数を超えたら、古いものを削除
        if len(self.state_history) > self.max_history:
            self.state_history.pop(0)

    def load_state(self, index):
        # 指定したインデックスの状態を復元
        if 0 <= index < len(self.state_history):
            state = self.state_history[index]
            for data in state['agents']:
                agent_id, current_node, end_node, next_node_index, path = data
                agent = next(a for a in self.agent_list if a.unique_id == agent_id)
                agent.current_node = current_node
                agent.end_node = end_node
                agent.next_node_index = next_node_index
                agent.path = path
            # 巻き戻した後の状態履歴を更新
            self.state_history = self.state_history[:index+1]
        else:
            print("Invalid state index")

    def step(self):
        self.schedule.step()
        self.save_state()

# シミュレーションとアニメーションの設定
def run_simulation():
    model = RoadModel(N=5)  # エージェント数を減らす
    num_steps = 200
    current_step = [0]  # リストで包むことで、内部関数から変更可能にする
    pause = [False]     # 一時停止のフラグ

    # 地図をプロット（軽量化）
    fig, ax = ox.plot_graph(model.G, show=False, close=False, node_size=0, edge_color='gray', bgcolor='white')
    colors = plt.cm.Set1.colors  # カラーマップ

    # エージェントの初期位置をプロット
    agent_scatters = []
    for i, agent in enumerate(model.agent_list):
        x, y = model.pos[agent.current_node]
        scatter = ax.scatter(x, y, c=[colors[i % len(colors)]], s=50, label=f'Agent {i}')
        agent_scatters.append(scatter)

    # ボタンの配置
    from matplotlib.widgets import Button

    ax_play = plt.axes([0.7, 0.01, 0.1, 0.05])    # 再生ボタンの位置
    ax_pause = plt.axes([0.81, 0.01, 0.1, 0.05])   # 一時停止ボタンの位置
    ax_step_forward = plt.axes([0.59, 0.01, 0.1, 0.05])  # 進めるボタンの位置
    ax_step_backward = plt.axes([0.48, 0.01, 0.1, 0.05]) # 巻き戻しボタンの位置

    btn_play = Button(ax_play, 'Play')
    btn_pause = Button(ax_pause, 'Pause')
    btn_step_forward = Button(ax_step_forward, 'Forward')
    btn_step_backward = Button(ax_step_backward, 'Back')

    # アニメーションの更新関数
    def update(frame_number):
        if not pause[0]:
            if current_step[0] < num_steps:
                model.step()
                current_step[0] += 1
                for i, agent in enumerate(model.agent_list):
                    x, y = model.pos[agent.current_node]
                    agent_scatters[i].set_offsets([x, y])
                ax.set_title(f"Step {current_step[0]}")
            else:
                # シミュレーション終了時にアニメーションを停止
                ani.event_source.stop()

    # ボタンのコールバック関数
    def play(event):
        pause[0] = False
        ani.event_source.start()

    def pause_animation(event):
        pause[0] = True
        ani.event_source.stop()

    def step_forward(event):
        if current_step[0] < num_steps:
            pause[0] = True
            ani.event_source.stop()
            model.step()
            current_step[0] += 1
            for i, agent in enumerate(model.agent_list):
                x, y = model.pos[agent.current_node]
                agent_scatters[i].set_offsets([x, y])
            ax.set_title(f"Step {current_step[0]}")
            fig.canvas.draw_idle()

    def step_backward(event):
        if current_step[0] > 0:
            pause[0] = True
            ani.event_source.stop()
            current_step[0] -= 1
            model.load_state(current_step[0])
            for i, agent in enumerate(model.agent_list):
                x, y = model.pos[agent.current_node]
                agent_scatters[i].set_offsets([x, y])
            ax.set_title(f"Step {current_step[0]}")
            fig.canvas.draw_idle()

    # ボタンにコールバック関数をバインド
    btn_play.on_clicked(play)
    btn_pause.on_clicked(pause_animation)
    btn_step_forward.on_clicked(step_forward)
    btn_step_backward.on_clicked(step_backward)

    ani = animation.FuncAnimation(fig, update, interval=500, repeat=False)
    plt.legend()
    plt.show()

if __name__ == "__main__":
    run_simulation()