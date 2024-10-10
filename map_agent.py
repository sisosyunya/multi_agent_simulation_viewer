# エージェントの定義
from mesa import Agent


class MapAgent(Agent):
    def __init__(self, unique_id, model):
        super().__init__(unique_id, model)
        # 初期位置を設定しない（モデル内で設定）

    def move(self):
        # 移動量を設定（適切な値に調整してください）
        dx = self.random.uniform(-500, 500)
        dy = self.random.uniform(-500, 500)
        new_x = self.pos[0] + dx
        new_y = self.pos[1] + dy
        # 境界チェック
        if self.model.space.x_min <= new_x <= self.model.space.x_max and \
           self.model.space.y_min <= new_y <= self.model.space.y_max:
            self.model.space.move_agent(self, (new_x, new_y))

    def step(self):
        self.move()