import csv
import random
import math
import os

def generate_car_path(car_id, start_x, start_y, num_cycles=1000, interval=5):
    """車両の経路データを生成する"""
    data = []
    current_x = start_x
    current_y = start_y
    current_heading = random.choice([0, 90, 180, 270])  # 道路に沿った初期方向
    
    # 初期状態（停止状態）
    data.append({
        'cycle': 0,
        'name': f'normalcar{car_id}',
        'loc_x': current_x,
        'loc_y': current_y,
        'heading': current_heading,
        'speed': 0.0,
        'drive_ov': False
    })
    
    for cycle in range(interval, num_cycles + 1, interval):
        # 交差点での方向転換（20%の確率）
        if random.random() < 0.2:
            # 90度単位での方向転換
            current_heading = random.choice([0, 90, 180, 270])
        
        # 速度の変更（徐々に加速、減速）
        speed = random.uniform(8, 14) if cycle < num_cycles * 0.9 else random.uniform(0, 5)
        
        # 位置の更新（道路に沿って移動）
        distance = speed * interval
        current_x += distance * math.cos(math.radians(current_heading))
        current_y += distance * math.sin(math.radians(current_heading))
        
        # 範囲内に収める
        current_x = max(300, min(3000, current_x))
        current_y = max(200, min(1600, current_y))
        
        data.append({
            'cycle': cycle,
            'name': f'normalcar{car_id}',
            'loc_x': current_x,
            'loc_y': current_y,
            'heading': current_heading,
            'speed': speed,
            'drive_ov': True
        })
    
    return data

def save_car_data(car_id, data):
    """車両データをCSVファイルに保存する"""
    os.makedirs('static/demodata', exist_ok=True)
    filename = f'static/demodata/car_{str(car_id).zfill(3)}.csv'
    
    with open(filename, 'w', newline='') as f:
        writer = csv.writer(f)
        # ヘッダーを書き込む
        writer.writerow(['cycle', 'name', 'loc_x', 'loc_y', 'heading', 'speed', 'drive_ov'])
        # データを書き込む
        for row in data:
            writer.writerow([
                row['cycle'],
                row['name'],
                row['loc_x'],
                row['loc_y'],
                row['heading'],
                row['speed'],
                row['drive_ov']
            ])
    print(f'Generated {filename}')

def main():
    """100台分の車両データを生成する"""
    num_cars = 100
    
    # 道路の定義
    road_spacing = 100  # 道路の間隔
    road_positions = []
    
    # 南北方向の道路
    for x in range(300, 3001, road_spacing):
        for y in range(200, 1601, road_spacing):
            road_positions.append((x, y))
    
    # 東西方向の道路
    for y in range(200, 1601, road_spacing):
        for x in range(300, 3001, road_spacing):
            road_positions.append((x, y))
    
    for i in range(num_cars):
        # ランダムな道路上の位置を選択
        start_x, start_y = random.choice(road_positions)
        
        # 車両データを生成
        car_data = generate_car_path(i, start_x, start_y)
        
        # CSVファイルに保存
        save_car_data(i + 1, car_data)

if __name__ == '__main__':
    main()
    print('All car data generated successfully!') 