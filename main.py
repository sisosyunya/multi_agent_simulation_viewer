import osmnx as ox
import networkx as nx
import matplotlib.pyplot as plt
import random
import matplotlib.animation as animation

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

        # self.G = ox.simplify_graph(self.G)  # グラフを簡略化（削除またはコメントアウト）
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
    num_steps = 50
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

    # キーボードイベントの処理
    def on_key(event):
        if event.key == 'left':
            # 巻き戻し
            if current_step[0] > 0:
                pause[0] = True
                ani.event_source.stop()
                current_step[0] -= 1
                model.load_state(current_step[0])
                for i, agent in enumerate(model.agent_list):
                    x, y = model.pos[agent.current_node]
                    agent_scatters[i].set_offsets([x, y])
                ax.set_title(f"Step {current_step[0]}")
                fig.canvas.draw()
        elif event.key == 'right':
            # 進める
            if current_step[0] < num_steps:
                pause[0] = True
                ani.event_source.stop()
                model.step()
                current_step[0] += 1
                for i, agent in enumerate(model.agent_list):
                    x, y = model.pos[agent.current_node]
                    agent_scatters[i].set_offsets([x, y])
                ax.set_title(f"Step {current_step[0]}")
                fig.canvas.draw()
        elif event.key == 'space':
            # 一時停止/再開
            pause[0] = not pause[0]
            if pause[0]:
                ani.event_source.stop()
            else:
                ani.event_source.start()

    fig.canvas.mpl_connect('key_press_event', on_key)

    ani = animation.FuncAnimation(fig, update, interval=500, repeat=False)
    plt.legend()
    plt.show()

if __name__ == "__main__":
    run_simulation()