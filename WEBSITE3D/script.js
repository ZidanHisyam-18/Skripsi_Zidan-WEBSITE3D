// ============================================================
//  FILE: script.js
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyBH_y-NhkStExrIKvzyF4q-eFlabknMg90",
    authDomain: "palang-kereta-iot.firebaseapp.com",
    databaseURL: "https://palang-kereta-iot-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "palang-kereta-iot",
    storageBucket: "palang-kereta-iot.firebasestorage.app",
    messagingSenderId: "652087772548",
    appId: "1:652087772548:web:e191b5068de8d4ca5849d1",
    measurementId: "G-JY5912LTP4"
};

const fbApp = initializeApp(firebaseConfig);
const db = getDatabase(fbApp);
  

const lbl = document.getElementById('lbl');
const tStatus = document.getElementById('trainStatus');
const gateStatus = document.getElementById('gateStatus');
const lastUpdate = document.getElementById('lastUpdate');
const logEl = document.getElementById('log');
const cntEl = document.getElementById('cnt');

const sensor1Lamp = document.getElementById('sensor1Lamp');
const sensor2Lamp = document.getElementById('sensor2Lamp');
const leftBox = document.getElementById('leftBox');
const rightBox = document.getElementById('rightBox');


let isDanger = false;
let hitung = 0;
let totalSesi = 0;
let gateAngle = Math.PI / 2;
let trainPos = -30;
let trainMoving = false;
let trainDirection = "-";

const canvas = document.getElementById('scene3d');
const ledCanvas = document.getElementById("ledCanvas");
const ledCtx = ledCanvas.getContext("2d");

function getW() {
    return canvas.clientWidth || 500;
}

function getH() {
    return 340;
}

const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true
});

renderer.setSize(getW(), getH());
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setClearColor(0x020c1b);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x020c1b, 22, 48);

const camera = new THREE.PerspectiveCamera(
    52,
    getW() / getH(),
    0.1,
    100
);

camera.position.set(10, 7, 10);
camera.lookAt(0, 0, 0);

window.addEventListener('resize', () => {
    renderer.setSize(getW(), getH());
    camera.aspect = getW() / getH();
    camera.updateProjectionMatrix();
});

scene.add(new THREE.AmbientLight(0x1a2a3a, 1.8));

const sun = new THREE.DirectionalLight(0x7799cc, 2.0);
sun.position.set(8, 14, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -22;
sun.shadow.camera.right = 22;
sun.shadow.camera.top = 22;
sun.shadow.camera.bottom = -22;
sun.shadow.camera.near = 0.5;
sun.shadow.camera.far = 60;
scene.add(sun);

const accentLight = new THREE.PointLight(0x00f2ff, 3.0, 14);
accentLight.position.set(0, 3, 0);
scene.add(accentLight);
scene.add(new THREE.PointLight(0x002244, 1.2, 24));

function box(w, h, d, color, x, y, z, extra = {}) {
    const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshPhongMaterial({ color, ...extra })
    );

    mesh.position.set(x, y, z);
    mesh.castShadow = !extra.noShadow;
    mesh.receiveShadow = true;

    scene.add(mesh);
    return mesh;
}

const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 80),
    new THREE.MeshPhongMaterial({ color: 0x06111e })
);

ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.06;
ground.receiveShadow = true;
scene.add(ground);

box(60, 0.10, 6.2, 0x2a3a50, 0, 0, 0, { noShadow: true });
box(60, 0.06, 0.10, 0xbbbbbb, 0, 0.09, 3.1, { noShadow: true });
box(60, 0.06, 0.10, 0xbbbbbb, 0, 0.09, -3.1, { noShadow: true });

for (let i = -14; i <= 14; i++) {
    box(1.8, 0.06, 0.10, 0xddcc00, i * 2.8, 0.09, 0, {
        noShadow: true,
        opacity: 0.8,
        transparent: true
    });
}

const railMat = new THREE.MeshPhongMaterial({
    color: 0xc0c8d8,
    shininess: 180
});

const railL = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.20, 60),
    railMat
);

railL.position.set(-0.65, 0.13, 0);
scene.add(railL);

const railR = railL.clone();
railR.position.x = 0.65;
scene.add(railR);

for (let i = -18; i <= 18; i++) {
    box(2.0, 0.12, 0.40, 0x5a3518, 0, 0.04, i * 1.6);
}

for (let i = -18; i <= 18; i++) {
    box(1.6, 0.06, 0.80, 0x2a3040, 0, 0.01, i * 1.6 + 0.8, {
        noShadow: true
    });
}

const TIANG_H = 1.8;
const T1x = 1.3;
const T1z = 3.1;
const T2x = -1.3;
const T2z = -3.1;

box(0.16, TIANG_H, 0.16, 0x4a5a6a, T1x, TIANG_H / 2, T1z);
box(0.16, TIANG_H, 0.16, 0x4a5a6a, T2x, TIANG_H / 2, T2z);

function makeGate() {
    const grp = new THREE.Group();
    const SEGS = 15;
    const SL = 0.40;

    for (let i = 0; i < SEGS; i++) {
        const seg = new THREE.Mesh(
            new THREE.BoxGeometry(0.14, 0.14, SL),
            new THREE.MeshPhongMaterial({
                color: i % 2 === 0 ? 0xfbbf24 : 0x111111
            })
        );

        seg.position.z = -(i * SL + SL / 2);
        grp.add(seg);
    }

    return grp;
}

const gateNear = makeGate();
const gateFar = makeGate();

scene.add(gateNear);
scene.add(gateFar);

gateNear.position.set(T1x, TIANG_H, T1z);
gateFar.position.set(T2x, TIANG_H, T2z);
gateFar.rotation.y = Math.PI;

/* TRAIN */
/* TRAIN */
/* TRAIN */
const trainGrp = new THREE.Group();
scene.add(trainGrp);
trainGrp.visible = false;

/* =========================
   LOKOMOTIF
========================= */

/* BODY UTAMA */
const locoBody = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 1.3, 4.2),
    new THREE.MeshPhongMaterial({ color: 0xdbeafe })
);
locoBody.position.set(0, 1.0, -1.8);
trainGrp.add(locoBody);

/* ATAP */
const roof = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 0.25, 3.2),
    new THREE.MeshPhongMaterial({ color: 0x475569 })
);
roof.position.set(0, 1.8, -1.8);
trainGrp.add(roof);

/* STRIPE ORANGE */
const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(1.82, 0.22, 3.5),
    new THREE.MeshPhongMaterial({ color: 0xf97316 })
);
stripe.position.set(0, 0.55, -1.8);
trainGrp.add(stripe);

/* MONCONG DEPAN */
const locoFront = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.9, 1.8, 4),
    new THREE.MeshPhongMaterial({ color: 0xffcc00 })
);
locoFront.rotation.x = Math.PI / 2;
locoFront.rotation.y = Math.PI / 4;
locoFront.position.set(0, 0.8, 1.2);
trainGrp.add(locoFront);

/* KABIN DEPAN */
const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 1.0, 1.8),
    new THREE.MeshPhongMaterial({ color: 0xe2e8f0 })
);
cabin.position.set(0, 1.6, 0.2);
trainGrp.add(cabin);

/* JENDELA KABIN */
/* KACA DEPAN LOKOMOTIF */
for (let i = -1; i <= 1; i++) {
    const frontWin = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.35, 0.05),
        new THREE.MeshPhongMaterial({
            color: 0x111827,
            emissive: 0x000000
        })
    );

    frontWin.position.set(i * 0.45, 1.55, 1.15);
    trainGrp.add(frontWin);
}
    /* =========================
   LOKOMOTIF BELAKANG
========================= */


/* =========================
   GERBONG
========================= */

for (let i = 0; i < 3; i++) {
    const zPos = -7 - (i * 5.4);

    const car = new THREE.Mesh(
        new THREE.BoxGeometry(1.6, 1.0, 4.5),
        new THREE.MeshPhongMaterial({
            color: i % 2 === 0 ? 0xe2e8f0 : 0xcbd5e1
        })
    );

    car.position.set(0, 0.95, zPos);
    trainGrp.add(car);

    /* JENDELA GERBONG */
for (let j = -1; j <= 1; j++) {
    const leftWin = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.28, 0.5),
        new THREE.MeshPhongMaterial({
            color: 0x111827,
            emissive: 0x000000
        })
    );

    leftWin.position.set(-0.83, 1.15, zPos + (j * 1.2));
    trainGrp.add(leftWin);

    const rightWin = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.28, 0.5),
        new THREE.MeshPhongMaterial({
            color: 0x111827,
            emissive: 0x000000
        })
    );

    rightWin.position.set(0.83, 1.15, zPos + (j * 1.2));
    trainGrp.add(rightWin);
}
}

/* =========================
   RODA
========================= */

function addWheelPair(z) {
    [-0.75, 0.75].forEach(x => {
        const wheel = new THREE.Mesh(
            new THREE.CylinderGeometry(0.22, 0.22, 0.18, 16),
            new THREE.MeshPhongMaterial({ color: 0x111111 })
        );

        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(x, 0.3, z);

        trainGrp.add(wheel);
    });
}

/* roda lokomotif */
[-0.5, -2.0, -3.2].forEach(addWheelPair);

/* roda gerbong */
[-6.0, -8.0, -11.4, -13.4, -16.8, -18.8].forEach(addWheelPair);




function updateSensorLamp(lamp, status) {
    lamp.classList.remove('standby', 'detect');

    if (status === 'DETEKSI') {
        lamp.classList.add('detect');
    } else {
        lamp.classList.add('standby');
    }
}

function updateLastUpdate() {
    lastUpdate.innerText = new Date().toLocaleTimeString('id-ID');
}

function updateUI(danger) {
    const t = new Date().toLocaleTimeString('id-ID');

    updateLastUpdate();

    if (danger) {
        lbl.innerText = 'BAHAYA';
        lbl.style.color = '#ff003c';

        tStatus.innerText = 'MENDEKAT';
        tStatus.className = 'value danger';

        gateStatus.innerText = 'TERTUTUP';

        accentLight.color.setHex(0xff0055);

        trainMoving = true;
        trainGrp.visible = true;

        if (trainDirection == "KANAN") {
          trainPos = 30;
        }

        else if (trainDirection == "KIRI") {
         trainPos = -30;
        }

        trainGrp.position.set(0, 0, trainPos);



    } else {
       

        lbl.innerText = 'AMAN';
        lbl.style.color = '#00f2ff';

        tStatus.innerText = 'TIDAK TERDETEKSI';
        tStatus.className = 'value';

        gateStatus.innerText = 'TERBUKA';

        accentLight.color.setHex(0x00f2ff);

        trainMoving = false;
        trainGrp.visible = false;
    }

    isDanger = danger;
}

/* FIREBASE */
    onValue(ref(db, 'status'), snap => {
    const status = snap.val();

    // Update tampilan utama
    updateUI(status === 'ADA KERETA');

});

onValue(ref(db, 'sensor1_status'), snap => {
    updateSensorLamp(sensor1Lamp, snap.val());
    updateLastUpdate();
});

onValue(ref(db, 'arah'), snap => {

    const arah = snap.val();

    ledDirection = arah;
    trainDirection = arah;

    leftBox.classList.remove("direction-active");
    rightBox.classList.remove("direction-active");

    if (arah === "KIRI") {
         rightBox.classList.add("direction-active");
    }

    else if (arah === "KANAN") {
       leftBox.classList.add("direction-active");
    }

});

onValue(ref(db, 'sensor2_status'), snap => {
    updateSensorLamp(sensor2Lamp, snap.val());
    updateLastUpdate();
});

    
   onValue(ref(db, 'total_melintas'), (snap) => {
    cntEl.innerText = snap.val() || 0;
}); 

onValue(ref(db, 'log_aktivitas'), (snap) => {
    const data = snap.val();

    if (!data)  {
            logEl.innerHTML = "> Belum Ada Aktivitas";
            return;
    }

    const logs = Object.values(data);

    logEl.innerHTML = logs
        .reverse()
        .slice(0, 50)
        .map(log => `${log}`)
        .join("<br>");
});

// [BARU] Delay Monitoring: ESP32 -> Website
// Menghitung selisih waktu antara saat ESP32 mempublish status (timestamp_esp32)
// dengan saat website menerima update tersebut dari Firebase.
const delayEl = document.getElementById('delayValue');

onValue(ref(db, 'timestamp_esp32'), snap => {
    const tEsp32 = snap.val();
    if (!tEsp32) return;

    const delay = Date.now() - Number(tEsp32);
    console.log(`[DELAY] ESP32 -> Website: ${delay} ms`);

    if (delayEl) delayEl.innerText = delay + ' ms';
});


/* CLOCK */
setInterval(() => {
    document.getElementById('clock').innerText =
        new Date().toLocaleTimeString('id-ID');
}, 1000);

/* ANIMATION */
const clock3D = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);

    const targetAngle = isDanger ? 0 : Math.PI / 2;

    gateAngle += (targetAngle - gateAngle) * 0.06;

    gateNear.rotation.x = gateAngle;
    gateFar.rotation.x = -gateAngle;

   if (trainMoving) {

    if (trainDirection == "KANAN") {
        trainPos -= 0.35;
    }

    else if (trainDirection == "KIRI") {
        trainPos += 0.35;
    }

    trainGrp.position.set(0,0,trainPos);

    if(trainDirection=="KANAN" && trainPos<-30){
        trainMoving=false;
        trainGrp.visible=false;
    }

    if(trainDirection=="KIRI" && trainPos>30){
        trainMoving=false;
        trainGrp.visible=false;
    }

}
    renderer.render(scene, camera);

    ledFrame++;

    drawLedTest();
}

let ledDirection = "-";
let ledFrame = 0;

function drawLedTest(){

    ledCtx.clearRect(0,0,ledCanvas.width,ledCanvas.height);

    const radius=2;
    const gap=2;

    const pitch=radius*2+gap;

    const cols=Math.ceil(ledCanvas.width/pitch);
    const rows=Math.ceil(ledCanvas.height/pitch);

    const shift=Math.floor(ledFrame/4);

    for(let y=0;y<rows;y++){

        for(let x=0;x<cols;x++){

            let color="#07344d";

            if (ledDirection == "-") {
             color = "#07344d";
            }

           const arrowRight = [
"00010000",
"00011000",
"00011100",
"11111111",
"11111111",
"00011100",
"00011000",
"00010000"
];

const arrowLeft = [
"00001000",
"00011000",
"00111000",
"11111111",
"11111111",
"00111000",
"00011000",
"00001000"
];

const arrow = (ledDirection == "KANAN") ? arrowRight : arrowLeft;

const shift = Math.floor(ledFrame / 2);
const spacing = 14;

const xx = (ledDirection == "KANAN")
    ? ((x - shift) % spacing + spacing) % spacing
    : ((x + shift) % spacing);

if (ledDirection != "-" && y < 8) {

    if (xx < 8 && arrow[y][xx] == "1")  {
        color = "#ff3030";
    }

}

            ledCtx.beginPath();

            ledCtx.arc(

                x*pitch+radius,

                y*pitch+radius,

                radius,

                0,

                Math.PI*2

            );

            ledCtx.fillStyle=color;

            ledCtx.fill();

        }

    }

}


animate();