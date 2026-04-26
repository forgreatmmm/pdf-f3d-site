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

// 📁 Ensure uploads folder exists
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// 📤 Multer setup
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, file.originalname)
});
const upload = multer({ storage });

// 🔐 PASSWORD (change anytime)
const PASSWORD = "1234";          // main login password
const ADMIN_PASSWORD = "admin";   // delete password

// 🔐 LOGIN
app.post("/login", (req, res) => {
    if (req.body.password === PASSWORD) {
        res.json({ success: true });
    } else {
        res.json({ success: false });
    }
});

// 📄 MERGE PDFs
app.post("/merge", upload.array("pdfs"), async (req, res) => {
    try {
        const mergedPdf = await PDFDocument.create();

        for (let file of req.files) {
            const pdfBytes = fs.readFileSync(file.path);
            const pdf = await PDFDocument.load(pdfBytes);
            const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
            pages.forEach(p => mergedPdf.addPage(p));

            fs.unlinkSync(file.path); // delete temp file
        }

        const mergedBytes = await mergedPdf.save();

        res.setHeader("Content-Type", "application/pdf");
        res.send(Buffer.from(mergedBytes));

    } catch (err) {
        console.error(err);
        res.status(500).send("Error merging PDFs");
    }
});

// 📤 UPLOAD F3D
app.post("/upload", upload.single("file"), (req, res) => {
    res.send("Uploaded");
});

// 📂 LIST FILES
app.get("/files", (req, res) => {
    const files = fs.readdirSync(uploadDir);
    res.json(files);
});

// ⬇ DOWNLOAD
app.get("/download/:name", (req, res) => {
    const filePath = path.join(uploadDir, req.params.name);
    res.download(filePath);
});

// ❌ DELETE FILE
app.post("/delete", (req, res) => {
    const { filename, adminPassword } = req.body;

    if (adminPassword !== ADMIN_PASSWORD) {
        return res.json({ success: false });
    }

    const filePath = path.join(uploadDir, filename);

    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        res.json({ success: true });
    } else {
        res.json({ success: false });
    }
});

// 🚀 START SERVER (IMPORTANT FOR RENDER)
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log("Server running on port " + PORT);
});
