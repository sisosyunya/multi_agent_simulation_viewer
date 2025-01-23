"use strict"

var renderer, scene, camera, controls;

document.addEventListener('DOMContentLoaded', function () {

  var atmospere, boundary, center, loading, project, targetTile;
  scene = new THREE.Scene();
  renderer = new THREE.WebGLRenderer({antialias: true});
  //renderer.setClearColor(0xa0a0d0);
  renderer.setClearColor(0xe0d5d5);
  renderer.setSize(window.innerWidth, window.innerHeight);

  document.body.appendChild(renderer.domElement);
  let light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(100, 1000, 1000);
  let light1 = new THREE.DirectionalLight(0xffffff, 1);
  light1.position.set(-1000, -1000, -0);
  scene.add(light);
  scene.add(light1);
  // atmospere = new THREE.Mesh(new THREE.SphereGeometry(20000, 0, 49), new THREE.MeshBasicMaterial({
  //   color: 0x555555
  // }));
  // atmospere.scale.x = -1;
  // scene.add(atmospere);
  let am = new THREE.AmbientLight(0xffffff,0.1);
  scene.add(am);

  camera = new THREE.PerspectiveCamera(20, window.innerWidth / window.innerHeight, 1, 40000);
  camera.position.set(-4418, 529, 1124);
  camera.rotation._x = -0.44;
  camera.rotation._y = -1.296;
  camera.rotation._z = -0.4256;
  
  scene.add(camera);

  // マウスでぐりぐりできるようにする
  controls = new THREE.OrbitControls(camera);
  let sq = window.location.search;
  sq = sq.slice(1).split('&');
  let sargs = {};
  sq.forEach((q)=>{
    let t = q.split('=');
    sargs[t[0]] = parseFloat(t[1]);
  });

//  boundary = {
//              e:139.7724,
//        n:35.6845,
//        s:35.6507,
//    w:139.7253
//  };//tileToBoundary(targetTile.x, targetTile.y, targetTile.z);
  boundary = {
              e:135.5694,
        n:34.8195,
        s:34.8035,
    w:135.5517
  };//tileToBoundary(targetTile.x, targetTile.y, targetTile.z);
  for(let p in sargs){
    boundary[p] && (boundary[p] = sargs[p]);
  }
  center = centroid(boundary);
  project = createProjection(center);
  loading = loadOverpassData(boundary);
  loading.then(function (overpassData) {
    var animate, controls, geoObject;
    geoObject = createGeoObject(project, overpassData);
    scene.add(geoObject);
    // controls = new THREE.TrackballControls(camera, renderer.domElement);
    //controls.target = geoObject.position.clone();
    //controls.target.add(new THREE.Vector3(0, 0, 0));
    render();
  });

  window.addEventListener('resize',()=>{
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth,window.innerHeight);
  });

});

// レンダリング処理
function render() {
  controls.update();
  renderer.render(scene, camera); // レンダリング
  requestAnimationFrame(render); // ループ処理
}

function lonlatToTile(lon, lat, zoom) {
  let lonDegreesPerTile, numOfTiles, sinLat, tx, ty;
  numOfTiles = Math.pow(2, zoom);
  lonDegreesPerTile = 360 / numOfTiles;
  sinLat = Math.sin(lat * Math.PI / 180);
  tx = (lon + 180) / lonDegreesPerTile;
  ty = (0.5 + -0.5 * Math.log((1 + sinLat) / (1 - sinLat)) / (2 * Math.PI)) * numOfTiles;
  return [Math.floor(tx), Math.floor(ty)];
};

function tileToLonlat(tx, ty, zoom) {
  let lat, latRadians, lon, numOfTiles, x, y;
  numOfTiles = Math.pow(2, zoom);
  x = tx / numOfTiles;
  y = ty / numOfTiles;
  lon = (x - (1 / 2)) / (1 / 360);
  latRadians = (y - (1 / 2)) / -(1 / (2 * Math.PI));
  lat = (2 * Math.atan(Math.exp(latRadians)) - Math.PI / 2) / Math.PI * 180;
  return [lon, lat];
};

function tileToBoundary(x, y, zoom) {
  let p1, p2;
  p1 = tileToLonlat(x, y, zoom);
  p2 = tileToLonlat(x + 1, y + 1, zoom);
  return {
    n: p1[1],
    w: p1[0],
    s: p2[1],
    e: p2[0]
  };
};

function midpoint(_arg, _arg1) {
  let x, x1, x2, y, y1, y2;
  x1 = _arg[0], y1 = _arg[1];
  x2 = _arg1[0], y2 = _arg1[1];
  x = x1 - (x1 - x2) / 2;
  y = y1 - (y1 - y2) / 2;
  return [x, y];
};

function centroid(boundary) {
  let p1, p2;
  p1 = [boundary.w, boundary.n];
  p2 = [boundary.e, boundary.s];
  return midpoint(p1, p2);
};

function createProjection(center) {
  return d3.geoMercator().scale(6.5 * 1000 * 1000).center(center).translate([0, 0]);
};

function loadOverpassData(boundary) {
  return new Promise((resolve, reject) => {
      let baseUrl = "//overpass-api.de/api/interpreter?data=[out:json];\n(\n  node({s},{w},{n},{e});\n  way(bn);\n);\n(\n  ._;\n  node(w);\n);\nout;";
      let url = baseUrl.replace(/\{([swne])\}/g, (match, key) => {
        return boundary[key];
      });

      d3.json(url, (error, root) => {
        if (error) reject(error);
        resolve(root);
        });
    })
    .then((rawData) => {
      var acc;
      acc = {
        node: {},
        way: {},
        relation: {}
      };
      rawData.elements.forEach(function (elem) {
        return acc[elem.type][elem.id] = elem;
      });
      return acc;
    });
};

let materialOptions = {
  railway: {
    platform: {
      color: 0x555500,
      amount: 1
    },
    rail: {
      color: 0xffff00,
      linewidth: 1
    }
  },
  highway: {
    pedestrian: {
      color: 0x00cccc,
      amount: 1
    },
    primary: {
      color: 0xffaa555,
      linewidth: 1000
    },
    secondary: {
      color: 0xaa5500,
      linewidth: 1
    },
    residential: {
      color: 0xffffff,
      linewidth:1
    },
    "default": {
      //color: 0xcccccc,
      color: 0xffffff,
      //linewidth: 1
      linewidth:20 
    }
  },
  waterway: {
    "default": {
      color: 0x0000ff,
      linewidth: 10
    }
  },
  amenity: {
    school: {
      color: 0x00aa00,
      amount: 10
    },
    theatre: {
      color: 0xcc5500,
      amount: 10
    },
    parking: {
      color: 0xffffaa,
      amount: 1
    },
    bus_station: {
      color: 0xcc0000,
      amount: 1
    },
    "default": {
      color: 0xffffff,
      amount: 10
    }
  },
  building: {
    commercial: {
      color: 0xc0c0c0,
      amount: 60
    },
    house: {
      color: 0xd0c0b0,
      amount: 5
    },
    yes: {
      color: 0xc0c0b0,
      amount: 60,
      vertexColors: THREE.VertexColors
    },
    "default": {
      color: 0xd0c0b0,
      amount: 60
    }
  },
  natural: {
    wood: {
      color: 0x00ff00,
      amount: 5
    },
    water: {
      color: 0x0000cc,
      amount: 1
    },
    "default": {
      color: 0x00ff00,
      amount: 2
    }
  },
  leisure: {
    pitch: {
      color: 0xcc5500,
      amount: 1
    },
    golf_course: {
      color: 0x00cc55,
      amount: 1
    },
    "default": {
      color: 0x00cc55,
      amount: 1
    }
  },
  landuse: {
    forest: {
      color: 0x00ff00,
      amount: 5
    },
    old_forest: {
      color: 0x005500,
      amount: 10
    },
    "default": {
      color: 0x005500,
      amount: 1
    }
  }
};

function createGeoObject(project, overpassData) {

  function getNodes(overpassData, way) {
    return way.nodes.map(function (id) {
      return overpassData.node[id];
    });
  };

  function isArea(way) {

    var first, last;
    first = way.nodes[0];
    last = way.nodes[way.nodes.length - 1];
    return first === last;
  };
  function lonlatToArray(_arg) {
    var lat, lon;
    lon = _arg.lon, lat = _arg.lat;
    return [lon, lat];
  };
  function yxToVec3(_arg) {
    var x, y;
    x = _arg[0], y = _arg[1];
    return new THREE.Vector3(x, y, 0);
  };
  function nodeToXy(node) {
    return project(lonlatToArray(node));
  };
  function nodeToVec3(node) {
    return yxToVec3(nodeToXy(node));
  };
  function createLine(way, opts) {
    var create, line;
    create = (function (_this) {
      return function (way) {
        var geometry, nodes;
        nodes = getNodes(overpassData, way);
        geometry = new THREE.Geometry();
        geometry.vertices = nodes.map(function (node) {
          return nodeToVec3(node);
        });
        return geometry;
      };
    })(this);
    const material = new THREE.LineBasicMaterial(opts);
    material.linewidth = 20;
    return line = new THREE.Line(create(way), material);
  };
  function createPolygon(area, opts) {

    if (opts == null) {
      opts = {
        color: 0xffffff,
        opacity: 0.8,
        transparent: true
      };
    }

    function createShape(nodes) {
      var shape;
      shape = new THREE.Shape();
      shape.moveTo.apply(shape, nodeToXy(nodes[0]));
      nodes.slice(1).forEach((function (_this) {
        return function (node) {
          return shape.lineTo.apply(shape, nodeToXy(node));
        };
      })(this));
      return shape;
    };

    var create = (function (_this) {
      return function (area, opts) {
        var geometry, nodes, shape;
        nodes = getNodes(overpassData, area);
        shape = createShape(nodes);
        if (!('amount' in opts)) opts.amount = 1;
        //console.log(opts.amount);
        if (!('bevelEnabled' in opts)) opts.bevelEnabled = false;
        geometry = new THREE.ExtrudeGeometry(shape, opts);
        geometry.computeFaceNormals();
        return geometry;
      };
    })(this);

    if (!('side' in opts)) opts.side = THREE.BackSide;
    const geometry = create(area, opts);
    const material = new THREE.MeshLambertMaterial(opts);
    //const material = new THREE.MeshToonMaterial({color: 0x888888});
    //material.flatShading = true;
    const mesh =  new THREE.Mesh(geometry, material);

    // ワイヤーフレームを描く
    var wireframeGeometry = new THREE.EdgesGeometry(geometry);
    var wireframeMaterial = new THREE.LineBasicMaterial({ color: 0xBBBBBB, linewidth: 0.3 });
    var wireframe = new THREE.LineSegments(wireframeGeometry, wireframeMaterial);
    mesh.add(wireframe);

    return mesh;

    //return new THREE.Mesh(create(area, opts), new THREE.MeshLambertMaterial(opts));
  };

  function findMaterialOptions(tags) {
    let category, key, mkeys, tkeys, tvalue, _ref;
    if (tags == null) {
      tags = {};
    }
    mkeys = new Set(Object.keys(materialOptions));
    tkeys = new Set(Object.keys(tags));
    let is =
      [...mkeys].filter(x => tkeys.has(x));

    key = is ? is[0] : null;

    if (key) {
      category = materialOptions[key];
      tvalue = tags[key];
      if(category[tvalue]) {
        _ref = Object.assign({},category[tvalue]);
      } else {
        _ref = Object.assign({},category["default"]);
      }

      if(_ref && _ref.amount) {
        if('height' in tags ){
          _ref.amount = parseFloat(tags.height);
    //      console.log('height',tvalue,_ref,tags.name,parseFloat(tags.height),tags.height,tags );
        } else if('building:levels' in tags ){
          _ref.amount = parseFloat(tags['building:levels']) * 5;
//          console.log(key,tvalue,tags.name,parseFloat(tags['building:levels']),'階',tags);
        } else {
          _ref.amount = _ref.amount * Math.random() * 0.75 + _ref.amount * 0.25;
          console.log(key,tvalue,tags.name,_ref.amount,tags);          
        }
     }
      return _ref;
    } else {
      return null;
    }
  };

  function createAndAddLines(root) {
    let ways = [];


    for (let i in overpassData.way) {
      if (!isArea(overpassData.way[i])) ways.push(overpassData.way[i]);
    }

    // overpassData.way.filter((way)=>{
    //   return !isArea(way);
    // });

    ways.forEach(function (way) {
      var opts;
      opts = findMaterialOptions(way.tags);
      root.add(createLine(way, opts));
    });
  };

  function createAndAddPolygons(root) {
    var areas = [];
    for (let i in overpassData.way) {
      if (isArea(overpassData.way[i])) areas.push(overpassData.way[i]);
    }
    //areas = overpassData.way.filter(isArea);
    areas.forEach(function (area) {
      var opts;
      opts = findMaterialOptions(area.tags);
      root.add(createPolygon(area, opts));
    });
  };

  let root = new THREE.Object3D();
  root.rotation.x = 90 * Math.PI / 180;
  root.scale.z = -1;
  createAndAddLines(root);
  createAndAddPolygons(root);
  return root;
};


/// FPSを画面右下に表示する
var stats = new Stats();
stats.showPanel(0);
Object.assign(stats.dom.style, {
  'position': 'fixed',
  'height': 'max-content',
  'left': '0',
});
document.body.appendChild( stats.dom );

/// レンダリングを行う関数
function stepFrame(){
  stats.begin();
  renderer.render(scene, camera);
  stats.end();
  requestAnimationFrame(stepFrame);
}
stepFrame();
