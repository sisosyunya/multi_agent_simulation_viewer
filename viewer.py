# viewer.py

import requests
import matplotlib.pyplot as plt
from matplotlib.widgets import Button
import time
import threading

class SimulationViewer:
    def __init__(self):
        self.fig, ax = plt.subplots(figsize=(10, 10))
        self.fig.subplots_adjust(bottom=0.15)
        self.ax = ax
        self.ax.set_facecolor('white')
        
        # 状態管理
        self.history = []
        self.current_index = -1
        self.is_playing = False
        self.timer = None  # タイマーオブジェクトを保持
        self.scatter = None
        
        self.setup_plot()
        self.setup_controls()
    
    def setup_plot(self):
        self.scatter = self.ax.scatter([], [], c='blue', s=50, label='Agents')
        self.ax.legend(loc='upper right')
        self.update_title()
    
    def setup_controls(self):
        # ボタンの配置設定
        fetch_width, fetch_height = 0.2, 0.075
        btn_width, btn_height = 0.1, 0.075
        gap = 0.02
        
        # Fetchボタン（左）
        self.ax_fetch = plt.axes([0.1, 0.05, fetch_width, fetch_height])
        self.btn_fetch = Button(self.ax_fetch, 'Fetch', color='lightblue')
        
        # 巻き戻しボタン
        self.ax_back = plt.axes([0.35, 0.05, btn_width, btn_height])
        self.btn_back = Button(self.ax_back, 'Back')
        
        # 再生/一時停止ボタン
        self.ax_play = plt.axes([0.47, 0.05, btn_width, btn_height])
        self.btn_play = Button(self.ax_play, '▶')
        
        # コールバックの設定
        self.btn_fetch.on_clicked(self.on_fetch)
        self.btn_back.on_clicked(self.on_back)
        self.btn_play.on_clicked(self.on_play_pause)

    def update_title(self):
        frame_info = f" (Frame: {self.current_index + 1}/{len(self.history)})" if self.history else ""
        plt.title(f"Road Simulation Viewer{frame_info}")

    def fetch_data(self):
        try:
            response = requests.get('http://localhost:8000/get_data')
            if response.status_code == 200:
                data = response.json()
                if data.get('status') == 'success':
                    return data.get('data', {})
            return None
        except Exception as e:
            print(f"Error fetching data: {e}")
            return None

    def update_plot(self, data):
        if not data:
            return

        # 現在のプロットをクリア
        self.ax.cla()
        
        if isinstance(data, dict):
            gama_contents = data.get('gama_contents', {})
            gama_references = data.get('gama_references', {})
            agents = gama_contents.get('agents', [])

            x_coords = []
            y_coords = []
            for agent in agents:
                agent_ref = agent.get('agent_reference')
                if agent_ref:
                    agent_data = gama_references.get(agent_ref, {})
                    loc = agent_data.get('attributes', {}).get('loc', {})
                    x = loc.get('x')
                    y = loc.get('y')
                    if x is not None and y is not None:
                        x_coords.append(x)
                        y_coords.append(y)

            if x_coords and y_coords:
                buffer_ratio = 0.1
                min_x, max_x = min(x_coords), max(x_coords)
                min_y, max_y = min(y_coords), max(y_coords)
                buffer_x = (max_x - min_x) * buffer_ratio
                buffer_y = (max_y - min_y) * buffer_ratio
                
                self.ax.set_xlim(min_x - buffer_x, max_x + buffer_x)
                self.ax.set_ylim(min_y - buffer_y, max_y + buffer_y)
                self.scatter = self.ax.scatter(x_coords, y_coords, c='blue', s=50, label='Agents')
                self.ax.legend(loc='upper right')

        # タイトル更新（フレーム番号を含む）
        frame_info = f" (Frame: {self.current_index + 1}/{len(self.history)})" if self.history else ""
        self.ax.set_title(f"Road Simulation Viewer{frame_info}")

        # コリッドの表示
        self.ax.grid(True)
        
        # 描画の更新
        self.fig.canvas.draw()
        self.fig.canvas.flush_events()

    def on_fetch(self, event):
        data = self.fetch_data()
        if data:
            # データを履歴に追加
            self.history.append(data)
            self.current_index = len(self.history) - 1
            self.update_plot(data)
            
            # デバッグ情報の出力
            print(f"Fetched data: Frame {self.current_index + 1}")
            print(f"Total frames in history: {len(self.history)}")

    def on_back(self, event):
        if self.history and self.current_index > 0:
            # 一つ前のフレームに戻る
            self.current_index -= 1
            self.update_plot(self.history[self.current_index])
            
            # 再生中の場合は停止する
            if self.is_playing:
                self.is_playing = False
                self.btn_play.label.set_text('▶')
                self.btn_play.ax.figure.canvas.draw()

    def on_play_pause(self, event):
        self.is_playing = not self.is_playing
        if self.is_playing:
            # 再生開始
            self.btn_play.label.set_text('Stop')
            # アニメーションを開始
            self._animate()
        else:
            # 一時停止
            self.btn_play.label.set_text('▶')
        
        # ボタンを再描画
        self.btn_play.ax.figure.canvas.draw()

    def _animate(self):
        """メインスレッドでアニメーションを実行"""
        if self.is_playing and self.current_index < len(self.history) - 1:
            self.current_index += 1
            self.update_plot(self.history[self.current_index])
            # 次のフレームをスケジュール
            self.fig.canvas.draw()
            self.fig.canvas.flush_events()
            self.timer = self.fig.canvas.new_timer(interval=500)  # 500ms = 0.5秒
            self.timer.add_callback(self._animate)
            self.timer.start()
        else:
            # アニメーション終了時の処理
            self.is_playing = False
            self.btn_play.label.set_text('▶')
            self.btn_play.ax.figure.canvas.draw()

    def run(self):
        plt.show()

def main():
    viewer = SimulationViewer()
    viewer.run()

if __name__ == "__main__":
    main()