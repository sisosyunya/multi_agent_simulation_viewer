// Socket.IOの初期化
var socket = io();
var data = [];

// グラフを初期化
Plotly.newPlot('plot', data);
// タイトルを表示
var layout = {
    title: {
        text: '矢橋通りの車両数',
        font: {
            size: 36
        }
    },
    legend: {
        font: {
            size: 24
        }
    }
};
// サーバーからデータを受信して更新

socket.on('update_plot', function(msg) {
    // 各線を更新
    var graph_data = {};
    data = [];
    msg.lines.forEach((line, index) => {

        graph_data[line.pol] = {
            x: line.x,
            y: line.y,
            mode: 'lines+markers',
            type: 'scatter',
            name: '施策 ' + line.pol,
            opacity: 0.6,  // 透明度を指定
            line: {
                width: 8  // 太さを指定
            }
        };
        if (line.pol == -1) {
            graph_data[line.pol].name = 'GUI',
            graph_data[line.pol].line.color = 'black';
        };
    });
    data = Object.values(graph_data);
    console.log(data);
    Plotly.react('plot', data, layout);
});

//sasaki
function fetchDataAndUpdateGraph() {
    fetch('/get_graph_data')
        .then(response => response.json())
        .then(data => {
            console.log(data);
            var x_data = data.x_data;
            //app.pyでy1とy2をに方向を定義している
            var y_1_name = data.y1
            var y_2_name = data.y2
            document.getElementById('graph-name').innerText=data.graph_name;

            //app.pyでy_data1とy_data2をデータのキーとして定義している
            var trace1 = data.y_data1.map(dataset => ({
                x: x_data,
                y: dataset.y,
                mode: 'lines',
                type: 'scatter',
                name: dataset.name
            }));

            var trace2 = data.y_data2 ? data.y_data2.map(dataset => ({
                x: x_data,
                y: dataset.y,
                mode: 'lines',
                type: 'scatter',
                name: dataset.name
            })) : [];

            var layout1 = {
                title: {
                    text: y_1_name,
                    font:{
                        size:20
                    }
                },
                xaxis: { title: 'cycle'},
                yaxis: {title: 'car_num'}
            };

            var layout2 = {
                title: {
                    text: y_2_name,
                    font:{
                        size:20
                    }
                },
                xaxis: { title: 'cycle'},
                yaxis: {title: 'car_num'}
            };

            Plotly.react('plot1', trace1, layout1);
            //Plotly.react('plot2', trace2, layout2);
            if (trace2.length > 0) {
                Plotly.react('plot2', trace2, layout2);
            } else {
                document.getElementById('plot2').innerHTML = '';
            }
        })
}



fetchDataAndUpdateGraph();
// 0.5秒ごとにデータを取得してグラフを更新
setInterval(fetchDataAndUpdateGraph, 500);

//改良前のコード
// function fetchDataAndUpdateGraph() {
//     fetch('/get_graph_data')
//         .then(response => response.json())
//         .then(data => {
//             console.log(data);
//             var traces = data.graph_data.map(dataset2 => ({
//                 x: dataset2.x,
//                 y: dataset2.y,
//                 mode: 'lines',
//                 type: 'scatter',
//                 name: dataset2.name     
//             }));
//             var layout = {
//                 title: {
//                     text: data.graph_name,
//                     font:{
//                         size:36
//                     }
//                 },
//                 xaxis: { title: 'cycle'},
//                 yaxis: {title: 'car_num'}
//             };

//             Plotly.react('map_click_data', traces, layout);
//         });
// }
