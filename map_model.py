# モデルの定義
from mesa import Model
from mesa.time import RandomActivation
from mesa.space import ContinuousSpace
from mesa.datacollection import DataCollector

from map_agent import MapAgent


class MapModel(Model):
    def __init__(self, num_agents, map_bounds):
        super().__init__()  # Model クラスの初期化
        self.num_agents = num_agents
        self.schedule = RandomActivation(self)
        self.space = ContinuousSpace(x_min=map_bounds[0], x_max=map_bounds[2],
                                     y_min=map_bounds[1], y_max=map_bounds[3], torus=False)
        self.datacollector = DataCollector(
            {"AgentPositions": lambda m: [(a.pos[0], a.pos[1]) for a in m.schedule.agents]}
        )
        # エージェントの生成と初期配置
        for i in range(self.num_agents):
            agent = MapAgent(i, self)
            self.schedule.add(agent)
            x = self.random.uniform(self.space.x_min, self.space.x_max)
            y = self.random.uniform(self.space.y_min, self.space.y_max)
            self.space.place_agent(agent, (x, y))

    def step(self):
        self.schedule.step()
        self.datacollector.collect(self)
