# viewer.py
import socketio
import webbrowser
import time

sio = socketio.Client()

def main():
    @sio.on('connect')
    def on_connect():
        print("[Viewer.py] Connected to server")

    @sio.on('disconnect')
    def on_disconnect():
        print("[Viewer.py] Disconnected from server")

    @sio.on('new_data')
    def on_new_data(data):
        print("\n=== New Frame ===")
        if data and 'agents' in data:
            print(f"Frame: {data.get('frame', '?')}/{data.get('total_frames', '?')}")
            print(f"Total agents: {len(data['agents'])}")
            # 最初の3エージェントの位置を表示
            for agent in data['agents'][:3]:
                print(f"Agent {agent['id']}: x={agent['x']:.2f}, y={agent['y']:.2f}")
        else:
            print("No agent data received")
    try:
        sio.connect("http://localhost:8000", transports=['websocket'])
    except Exception as e:
        print(f"[Viewer.py] Connection failed: {e}")
        return    

    # ブラウザで map.html を開く
    url = "http://localhost:8000/map"
    print(f"[Viewer.py] Opening browser at {url} ...")
    webbrowser.open(url)

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        pass
    finally:
        sio.disconnect()
        print("[Viewer.py] Closed.")

if __name__ == "__main__":
    main()