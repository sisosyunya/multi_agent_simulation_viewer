# main.py

import matplotlib.pyplot as plt
import geopandas as gpd
import contextily as ctx
from mesa import Model
from mesa.agent import Agent
from mesa.time import RandomActivation
from mesa.space import ContinuousSpace
from mesa.datacollection import DataCollector
import xyzservices.providers as xyz

from map_model import MapModel  # 追加

# シミュレーションの実行と可視化
def run_simulation():
    # 地図データの読み込み
    map_data = gpd.read_file('map_data.geojson')

    # 座標系を Web Mercator (EPSG:3857) に変換
    map_data = map_data.to_crs(epsg=3857)

    # 地図の境界を取得
    map_bounds = map_data.total_bounds  # [minx, miny, maxx, maxy]

    # モデルの初期化
    num_agents = 50
    model = MapModel(num_agents, map_bounds)

    # シミュレーションのステップ数
    steps = 100

    # シミュレーションの実行
    for _ in range(steps):
        model.step()

    # エージェントの位置を取得
    agent_positions = model.datacollector.get_model_vars_dataframe()['AgentPositions'].iloc[-1]
    geometry = gpd.points_from_xy([pos[0] for pos in agent_positions], [pos[1] for pos in agent_positions])
    agent_df = gpd.GeoDataFrame(geometry=geometry, crs='EPSG:3857')

    # 可視化
    fig, ax = plt.subplots(figsize=(10, 10))

    # 地図データをプロット
    map_data.plot(ax=ax, alpha=0.5, edgecolor='k')

    # エージェントの位置をプロット
    agent_df.plot(ax=ax, color='red', markersize=5)

    # ベースマップ（背景地図）を追加
    ctx.add_basemap(ax, crs=agent_df.crs.to_string(), source=ctx.providers.OpenStreetMap.Mapnik)
    plt.title('Agent Positions on Map with Contextily Basemap')
    plt.xlabel('Longitude')
    plt.ylabel('Latitude')
    plt.show()

if __name__ == '__main__':
    run_simulation()