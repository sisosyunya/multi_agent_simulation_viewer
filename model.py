from mesa import Agent, Model
from mesa.time import RandomActivation
from mesa.space import ContinuousSpace
import numpy as np

class CarAgent(Agent):
    def __init__(self, unique_id, model, x, y):
        super().__init__(unique_id, model)
        self.x = x
        self.y = y

    def step(self):
        # エージェントの移動ロジックをここに実装
        # 現在はランダムな小さな移動を行う
        self.x += np.random.uniform(-5, 5)
        self.y += np.random.uniform(-5, 5)

class MinakusaModel(Model):
    def __init__(self, num_agents=100):
        super().__init__()
        
        # 南草津駅周辺の座標範囲
        self.center_x = 13550000
        self.center_y = 3480000
        self.space_size = 1000

        # 連続空間を作成
        self.space = ContinuousSpace(
            x_max=self.space_size,
            y_max=self.space_size,
            torus=False  # エージェントが画面端でワープしないように
        )
        
        self.schedule = RandomActivation(self)
        
        # エージェントを生成
        for i in range(num_agents):
            # 初期位置をランダムに設定
            x = self.center_x + np.random.uniform(-100, 100)
            y = self.center_y + np.random.uniform(-100, 100)
            agent = CarAgent(i, self, x, y)
            self.schedule.add(agent)
            self.space.place_agent(agent, (x, y))

    def step(self):
        self.schedule.step()
        
        # エージェントの位置情報を更新
        for agent in self.schedule.agents:
            self.space.move_agent(agent, (agent.x, agent.y))

    def get_agent_positions(self):
        return [{
            'id': agent.unique_id,
            'x': agent.x,
            'y': agent.y
        } for agent in self.schedule.agents] 