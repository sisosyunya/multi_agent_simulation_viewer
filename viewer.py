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
        # ここではログ表示のみ
        print("[Viewer.py] Received new_data:", data)

    print("[Viewer.py] Connecting to SocketIO server...")
    sio.connect("http://localhost:8000", transports=['websocket'])
    
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