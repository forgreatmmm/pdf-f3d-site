<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>PDF MERGER</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<style>
body {
    margin: 0;
    font-family: 'Segoe UI', sans-serif;
    background: radial-gradient(circle at top, #0f172a, #020617);
    color: white;
}

/* TITLE */
.title {
    text-align: center;
    font-size: 65px;
    font-weight: bold;
    margin-top: 60px;
    background: linear-gradient(90deg,#6366f1,#9333ea,#6366f1);
    background-size: 200%;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    animation: shine 4s infinite linear;
}

@keyframes shine {
    0% { background-position: 0% }
    100% { background-position: 200% }
}

.subtitle {
    text-align: center;
    color: #cbd5f5;
    margin-top: 10px;
}

/* PASSWORD SMALL */
.pass-box {
    position: fixed;
    top: 15px;
    right: 20px;
}

.pass-box input {
    padding: 6px;
    border-radius: 6px;
    border: none;
}

.pass-box button {
    padding: 6px 10px;
}

/* CARD */
.card {
    max-width: 600px;
    margin: 40px auto;
    padding: 25px;
    border-radius: 16px;
    background: rgba(255,255,255,0.05);
    backdrop-filter: blur(15px);
    text-align: center;
}

/* BIG BUTTON */
.big-btn {
    padding: 20px 50px;
    font-size: 20px;
    border-radius: 12px;
    border: none;
    background: linear-gradient(90deg,#ef4444,#dc2626);
    color: white;
    cursor: pointer;
}

.big-btn:hover {
    transform: scale(1.08);
}

/* MORE */
.more-btn {
    text-align: center;
    margin-top: 30px;
    opacity: 0.7;
    cursor: pointer;
}

/* HIDDEN */
#extra {
    max-height: 0;
    overflow: hidden;
    transition: 0.7s;
}

#extra.show {
    max-height: 1000px;
}

/* FILE LIST */
.file {
    display: flex;
    justify-content: space-between;
    margin-top: 10px;
    padding: 10px;
    background: rgba(255,255,255,0.05);
    border-radius: 8px;
}

/* FLOWER */
.flower {
    position: fixed;
    top: -50px;
    font-size: 22px;
    animation: fall 3s linear forwards;
}

@keyframes fall {
    to {
        transform: translateY(100vh) rotate(360deg);
        opacity: 0;
    }
}
</style>
</head>

<body>

<!-- SMALL PASSWORD -->
<div class="pass-box">
    <input id="pass" type="password" placeholder="Password">
    <button onclick="login()">Enter</button>
</div>

<div class="title">Merge PDF Files</div>
<div class="subtitle">
Combine PDFs in the order you want with the easiest PDF merger available.
</div>

<div id="main" style="display:none">

<div class="card">
    <input type="file" id="pdfs" multiple style="display:none">
    <button class="big-btn" onclick="document.getElementById('pdfs').click()">
        Select PDF files
    </button>
</div>

<div class="more-btn" onclick="toggleExtra()">✨ More Options</div>

<div id="extra">

<div class="card">
    <div>hmmm... this is something new, give it a try!</div>
    <input type="file" id="file">
    <button onclick="upload()">Upload</button>
</div>

<div class="card">
    <div>Thanks</div>
    <div id="list"></div>
</div>

</div>

</div>

<script>

/* LOGIN */
async function login() {
    const password = document.getElementById("pass").value;
    const res = await fetch("/login", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({password})
    });
    const data = await res.json();

    if(data.success){
        document.getElementById("main").style.display = "block";
        document.querySelector(".pass-box").style.opacity = "0.3";
        loadFiles();
    } else {
        alert("Wrong password");
    }
}

/* MERGE */
document.getElementById("pdfs").addEventListener("change", merge);

async function merge() {
    const files = document.getElementById("pdfs").files;
    const form = new FormData();

    for(let f of files){
        form.append("pdfs", f);
    }

    const res = await fetch("/merge", {
        method: "POST",
        body: form
    });

    const blob = await res.blob();
    window.open(URL.createObjectURL(blob));
}

/* UPLOAD */
async function upload() {
    const file = document.getElementById("file").files[0];
    const form = new FormData();
    form.append("file", file);

    await fetch("/upload", {
        method: "POST",
        body: form
    });

    loadFiles();
}

/* LOAD FILES */
async function loadFiles() {
    const res = await fetch("/files");
    const files = await res.json();

    const list = document.getElementById("list");
    list.innerHTML = "";

    files.forEach(f => {
        list.innerHTML += `
        <div class="file">
            ${f}
            <div>
                <button onclick="download('${f}')">Download</button>
                <button onclick="del('${f}')">Delete</button>
            </div>
        </div>`;
    });
}

/* DOWNLOAD */
function download(name){
    window.open("/download/" + name);
}

/* DELETE */
async function del(name){
    const pass = prompt("Enter admin password:");

    const res = await fetch("/delete", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({filename: name, adminPassword: pass})
    });

    const data = await res.json();

    if(data.success){
        loadFiles();
    } else {
        alert("Wrong admin password");
    }
}

/* TOGGLE + FLOWERS */
function toggleExtra(){
    document.getElementById("extra").classList.toggle("show");

    createFlower();
    setTimeout(createFlower, 2000);
}

function createFlower(){
    const flower = document.createElement("div");
    flower.className = "flower";
    flower.innerHTML = "🌸";
    flower.style.left = Math.random()*100 + "vw";

    document.body.appendChild(flower);
    setTimeout(()=>flower.remove(),3000);
}

</script>

</body>
</html>
