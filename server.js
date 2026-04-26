const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const { PDFDocument } = require("pdf-lib");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const uploadDir = path.join(__dirname, "uploads");
const chatFile = path.join(__dirname, "chat.json");
const stateFile = path.join(__dirname, "state.json");

// create files if not exist
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
if (!fs.existsSync(chatFile)) fs.writeFileSync(chatFile, "[]");
if (!fs.existsSync(stateFile)) fs.writeFileSync(stateFile, JSON.stringify({ paused:false }));

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, file.originalname)
});
const upload = multer({ storage });

/* PASSWORDS */
const MAIN_PASS = "1234";
const DELETE_PASS = "delete";
const CHAT_PASS = "chat";
const ADMIN_PASS = "admin";

/* CHECK PAUSE */
function isPaused(){
    return JSON.parse(fs.readFileSync(stateFile)).paused;
}

/* LOGIN CHECK */
app.post("/auth", (req,res)=>{
    const {password} = req.body;

    if(password===ADMIN_PASS) return res.json({role:"admin"});
    if(password===MAIN_PASS) return res.json({role:"main"});
    if(password===DELETE_PASS) return res.json({role:"delete"});
    if(password===CHAT_PASS) return res.json({role:"chat"});

    res.json({role:"none"});
});

/* PAUSE */
app.post("/togglePause",(req,res)=>{
    const {password} = req.body;
    if(password!==ADMIN_PASS) return res.json({success:false});

    const state = JSON.parse(fs.readFileSync(stateFile));
    state.paused = !state.paused;
    fs.writeFileSync(stateFile, JSON.stringify(state));

    res.json({success:true, paused:state.paused});
});

/* GET STATE */
app.get("/state",(req,res)=>{
    res.json(JSON.parse(fs.readFileSync(stateFile)));
});

/* MERGE */
app.post("/merge", upload.array("pdfs"), async (req, res) => {
    if(isPaused()) return res.send("Website Paused");

    const mergedPdf = await PDFDocument.create();

    for (let file of req.files) {
        const pdfBytes = fs.readFileSync(file.path);
        const pdf = await PDFDocument.load(pdfBytes);
        const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        pages.forEach(p => mergedPdf.addPage(p));
        fs.unlinkSync(file.path);
    }

    const mergedBytes = await mergedPdf.save();
    res.send(Buffer.from(mergedBytes));
});

/* UPLOAD */
app.post("/upload", upload.single("file"), (req,res)=>{
    if(isPaused()) return res.send("Paused");
    res.send("ok");
});

/* FILES */
app.get("/files",(req,res)=>{
    res.json(fs.readdirSync(uploadDir));
});

/* DELETE */
app.post("/delete",(req,res)=>{
    const {filename,password} = req.body;

    if(password!==DELETE_PASS && password!==ADMIN_PASS)
        return res.json({success:false});

    fs.unlinkSync(path.join(uploadDir,filename));
    res.json({success:true});
});

/* CHAT */
app.get("/chat",(req,res)=>{
    res.json(JSON.parse(fs.readFileSync(chatFile)));
});

app.post("/chat",(req,res)=>{
    const {msg} = req.body;
    const data = JSON.parse(fs.readFileSync(chatFile));
    data.push(msg);
    fs.writeFileSync(chatFile, JSON.stringify(data));
    res.send("ok");
});

app.post("/chat/delete",(req,res)=>{
    const {password} = req.body;

    if(password!==CHAT_PASS && password!==ADMIN_PASS)
        return res.json({success:false});

    fs.writeFileSync(chatFile,"[]");
    res.json({success:true});
});

/* START */
const PORT = process.env.PORT || 10000;
app.listen(PORT, ()=>console.log("Running..."));
