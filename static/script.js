const slider = document.getElementById('slider');
const sp_slider = document.getElementById('sp_slider');
const sliderValue = document.getElementById('sliderValue');
const sp_sliderValue = document.getElementById('sp_sliderValue');
const checkbox1 = document.getElementById("switch1");
const checkbox2 = document.getElementById("switch2");
const checkbox3 = document.getElementById("switch3");
const checkbox4 = document.getElementById("switch4");
const radios = document.getElementsByName('policy');
const visible_options = document.querySelectorAll('input[name="visible_option"]');

const checkbox_heat = document.getElementById("switch_heat");

let reverse_sp_value = (1 - sp_slider.value).toFixed(1);

slider.addEventListener('input', function () {
    sliderValue.textContent = slider.value;
});
//ipad用
slider.addEventListener('touchstart', function () {
    sliderValue.textContent = slider.value;
});

sp_slider.addEventListener('input', function () {
    reverse_sp_value =  (1 - sp_slider.value).toFixed(1);
    sp_sliderValue.textContent = reverse_sp_value;
});
//ipad用
sp_slider.addEventListener('touchstart', function () {
    reverse_sp_value = (1 - sp_slider.value).toFixed(1);
    sp_sliderValue.textContent = reverse_sp_value;
});



slider.addEventListener('mouseup', function () {
    // sliderValue.textContent = slider.value;
    console.log("スライダー" + sliderValue.textContent)

    let slide_value ={};
    slide_value["value"] = String(sliderValue.textContent)
    console.log("slideの値", slide_value)
    fetch('/slidebar', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body:JSON.stringify(slide_value)

    })
    .then(response => response.json())
    .catch(error => {
        console.error('エラー:', error);
    });

});

// iPad用
slider.addEventListener('touchend', function () {
    // sliderValue.textContent = slider.value;
    console.log("スライダー" + sliderValue.textContent)

    let slide_value ={};
    slide_value["value"] = String(sliderValue.textContent)
    console.log("slideの値", slide_value)
    fetch('/slidebar', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body:JSON.stringify(slide_value)

    })
    .then(response => response.json)
    .catch(error => {
        console.error('エラー:', error);
    });

});



// シミュレーションスピード用
sp_slider.addEventListener('mouseup', function () {
    // sliderValue.textContent = slider.value;
    reverse_sp_value =  (1 - sp_slider.value).toFixed(1);
    console.log("スライダー2" + reverse_sp_value)

    let sp_slide_value ={};
    sp_slide_value["value"] = String(reverse_sp_value)
    fetch('/sp_slidebar', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body:JSON.stringify(sp_slide_value)

    })
    .then(response => response.json)
    .catch(error => {
        console.error('エラー:', error);
    });

});

// iPad用
sp_slider.addEventListener('touchend', function () {
    // sliderValue.textContent = slider.value;
    reverse_sp_value =  (1 - sp_slider.value).toFixed(1);
    console.log("スライダー2" + reverse_sp_value)

    let sp_slide_value ={};
    sp_slide_value["value"] = String(reverse_sp_value)
    fetch('/sp_slidebar', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body:JSON.stringify(sp_slide_value)

    })
    .then(response => response.json)
    .catch(error => {
        console.error('エラー:', error);
    });
});


// リロードボタンをクリックしたときの処理
document.getElementById('reload-button').addEventListener('click', function () {
    var check_status = {};
    check_status["switch1"] = checkbox1.checked;
    check_status["switch2"] = checkbox2.checked;
    check_status["switch3"] = checkbox3.checked;
    check_status["switch4"] = checkbox4.checked;
    fetch('/send-json', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(check_status)
    })
    .then(response => response.json())
    .then(data => {
        console.log('サーバからeの応答:', data);
    })
    .catch(error => {
        console.error('エラー:', error);
    });
    // alert(check_status["switch1"]);
});

// 施策ボタンをクリックしたときの処理
for (var i = 0; i < radios.length; i++) {
    radios[i].addEventListener('change', function() {
        var check_status = {};
        check_status["switch1"] = radios[1].checked;
        check_status["switch2"] = radios[2].checked;
        check_status["switch3"] = radios[3].checked;
        check_status["switch4"] = radios[4].checked;

        fetch('/policy', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(check_status)
        })
        .then(response => response.json())
        .then(data => {
            console.log('サーバからの応答:', data);
        })
        .catch(error => {
            console.error('エラー:', error);
        });
    });
}



checkbox_heat.addEventListener('change', function(){
    var check_status = {};
    check_status["heat"] = checkbox_heat.checked;
    fetch('/heat_map', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(check_status)
    })
    .then(response => response.json())
    .then(data => {
        console.log('サーバからの応答:', data);
    })
    .catch(error => {
        console.error('エラー:', error);
    });
})







// // オアシスボタン3をクリックしたときの処理
// document.getElementById('oacis-button3').addEventListener('click', function () {
//     // 一旦固定の施策を割り当てる
//     var check_status = {};
//     check_status["switch1"] = false;
//     check_status["switch2"] = false;
//     check_status["switch3"] = true;
//     check_status["switch4"] = false;
//     fetch('/send-json_oacis', {
//         method: 'POST',
//         headers: {
//             'Content-Type': 'application/json'
//         },
//         body: JSON.stringify(check_status)
//     })
//     .then(response => response.json())
//     .then(data => {
//         console.log('サーバからeの応答:', data);
//     })
//     .catch(error => {
//         console.error('エラー:', error);
//     });
//     // alert(check_status["switch1"]);
// });

// // オアシスボタン1をクリックしたときの処理
// document.getElementById('oacis-button1').addEventListener('click', function () {
//     // 一旦固定の施策を割り当てる
//     var check_status = {};
//     check_status["switch1"] = true;
//     check_status["switch2"] = false;
//     check_status["switch3"] = false;
//     check_status["switch4"] = false;
//     fetch('/send-json_oacis', {
//         method: 'POST',
//         headers: {
//             'Content-Type': 'application/json'
//         },
//         body: JSON.stringify(check_status)
//     })
//     .then(response => response.json())
//     .then(data => {
//         console.log('サーバからeの応答:', data);
//     })
//     .catch(error => {
//         console.error('エラー:', error);
//     });
//     // alert(check_status["switch1"]);
// });

const vistions = document.querySelectorAll('input[name="visible_option"]');
// チェックボックスを監視
console.log(vistions); // 取得された要素を確認


// チェックボックスを監視
visible_options.forEach(function (checkbox) {
    checkbox.addEventListener('change', function () {
        // 選択されている値を取得
        const selectedOptions = Array.from(document.querySelectorAll('input[name="visible_option"]:checked'))
            .map(cb => cb.value);
        // サーバーにリクエストを送信
        fetch('/process_checkbox', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ selected: selectedOptions }),
        })
        .then(response => response.json())
        .then(data => {
            console.log('Success:', data);
        })
        .catch((error) => {
            console.error('Error:', error);
        });
    });
});