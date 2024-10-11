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
        # 最短経路を計算
        self.path = nx.shortest_path(self.model.G, self.current_node, self.end_node, weight='length')
        self.next_node_index = 1  # 次のノードへのインデックス

    def step(self):
        if self.next_node_index < len(self.path):
            # 次のノードに移動
            self.current_node = self.path[self.next_node_index]
            self.next_node_index += 1
        else:
            # 目的地に到達したら新しい目的地を設定
            self.current_node = self.end_node
            self.end_node = random.choice(list(self.model.G.nodes()))
            self.path = nx.shortest_path(self.model.G, self.current_node, self.end_node, weight='length')
            self.next_node_index = 1

# モデルの定義
class RoadModel(Model):
    def __init__(self, N):
        super().__init__()  # モデルの初期化
        self.num_agents = N
        self.schedule = RandomActivation(self)
        # 地図データを取得
        self.G = ox.graph_from_place('Ibarakishi, Osaka, Japan', network_type='drive')
        self.pos = {node: (data['x'], data['y']) for node, data in self.G.nodes(data=True)}
        # エージェントを初期化
        self.agent_list = []  # 'agents'から別の名前に変更
        for i in range(self.num_agents):
            start_node = random.choice(list(self.G.nodes()))
            end_node = random.choice(list(self.G.nodes()))
            agent = RoadAgent(i, self, start_node, end_node)
            self.schedule.add(agent)
            self.agent_list.append(agent)

    def step(self):
        self.schedule.step()

# シミュレーションとアニメーションの設定
def run_simulation():
    model = RoadModel(N=10)
    num_steps = 50

    # 地図をプロット
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
        model.step()
        for i, agent in enumerate(model.agent_list):
            x, y = model.pos[agent.current_node]
            agent_scatters[i].set_offsets([x, y])
        ax.set_title(f"Step {frame_number + 1}")

    ani = animation.FuncAnimation(fig, update, frames=num_steps, interval=500, repeat=False)
    plt.legend()
    plt.show()

if __name__ == "__main__":
    run_simulation()