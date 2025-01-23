from flask import *
from flask_cors import CORS
import json
import pyautogui
import time

app = Flask(__name__, static_folder='.', static_url_path='')

# データ
car_size = 6 #車のサイズ
sim_speed = 0.0 #シミュレーションの速度
policies = {'switch1': False, 'switch2': False, 'switch3': False, 'switch4':False}
heatmap_flag = False #ヒートマップ
@app.route('/')
def index():
    return app.send_static_file('index.html')

@app.route('/send-json', methods=['POST'])
def receive_json():
    inputData = request.json
    policies = inputData
   
    print(policies, "policies")
    
    with open('../minakusa_GA/includes/data.json', 'w') as json_file:
        json.dump(inputData, json_file)
    kekka = {"neko":"猫"}
    
    # display_info = pyautogui.displayInfo()
    # print(display_info)
    mouse_x, mouse_y = pyautogui.position()
    print(f'Mouse clicked at Screen Coordinates: ({mouse_x}, {mouse_y})')

    

    # 座標(1000, 500)に移動してクリック ---ここからgui操作---
    pyautogui.click(1000, 500, button="left")
    pyautogui.press('enter')
    pyautogui.click()
    pyautogui.keyDown("command")
    pyautogui.keyDown("r")
    pyautogui.keyUp("r")
    pyautogui.keyUp("command")
    pyautogui.press('enter')
    pyautogui.moveTo(100, 100)
    
    
    return jsonify(kekka)

# スライドバー(carsize)の処理
@app.route('/auto_reload', methods=['GET'])
def auto_reload():
    # 座標(1000, 500)に移動してクリック ---ここからgui操作---
    pyautogui.click(1000, 500, button="left")
    pyautogui.press('enter')
    pyautogui.click()
    pyautogui.keyDown("command")
    pyautogui.keyDown("r")
    pyautogui.keyUp("r")
    pyautogui.keyUp("command")
    pyautogui.press('enter')
    pyautogui.moveTo(100, 100)

    global car_size
    global sim_speed
    global policies
    global heatmap_flag
    gama_response = {}
    gama_response["car_size"] = car_size
    gama_response["sim_speed"] = sim_speed
    gama_response["policies"] = policies
    gama_response["heatmap_flag"] = heatmap_flag
    return gama_response


    




# スライドバー(carsize)の処理
@app.route('/slidebar', methods=['POST'])
def send_slidebar():
    if request.method == 'POST':
        res = request.json
        # print(res , "aaaaa")
        global car_size
        car_size = int(res["value"])
        print(car_size, "carsize")
        slider_value = request.form['slider']  # スライダーの値を受け取る

        # スライダーの値に基づいてリダイレクト先のURLを生成
        # redirect_url = url_for('new_page', value=slider_value)
        # return redirect(redirect_url)
    # return render_template('index.html')
    return res

# スライドバー(sim_speed)の処理
@app.route('/sp_slidebar', methods=['POST'])
def send_sp_slidebar():
    if request.method == 'POST':
        res = request.json
        global sim_speed
        sim_speed = float(res["value"])
        
        print(sim_speed, "sim_speed")
        # print(car_size, "carsize")
        # slider_value = request.form['slider']  # スライダーの値を受け取る

        # スライダーの値に基づいてリダイレクト先のURLを生成
        # redirect_url = url_for('new_page', value=slider_value)
        # return redirect(redirect_url)
    # return render_template('index.html')
    return res

# ヒートマップ
@app.route('/heat_map', methods=['POST'])
def send_heat_map():
    if request.method == 'POST':
        res = request.json
        # print(res , "aaaaa")
        global heatmap_flag
        heatmap_flag = res["heat"]
        print(heatmap_flag)
        print(type(heatmap_flag))

        # スライダーの値に基づいてリダイレクト先のURLを生成
        # redirect_url = url_for('new_page', value=slider_value)
        # return redirect(redirect_url)
    # return render_template('index.html')
    return res






@app.route('/gama-carsize', methods=['GET'])
def send_carsize():
    global car_size
    global sim_speed
    global policies
    global heatmap_flag
    gama_response = {}
    gama_response["car_size"] = car_size
    gama_response["sim_speed"] = sim_speed
    gama_response["policies"] = policies
    gama_response["heatmap_flag"] = heatmap_flag
    return gama_response


@app.route('/policy', methods=['POST'])
def policy():
    global policies
    inputData = request.json
    policies = inputData
    # print(inputData)
    return inputData


app.run(port=8000, debug=False, host='0.0.0.0')
