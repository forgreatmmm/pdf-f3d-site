const express = require("express");
const multer = require("multer");
const fs = require("fs");
const { PDFDocument } = require("pdf-lib");
const cors = require("cors");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// ✅ Better storage (keeps original file name)
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "uploads/");
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname);
    }
});

const upload = multer({ storage: storage });

// 🔐 Passwords
const USER_PASSWORD = "1234";
const ADMIN_PASSWORD = "admin123";

// Login
app.post("/login", (req, res) => {
    if (req.body.password === USER_PASSWORD) {
        res.json({ success: true });
    } else {
        res.json({ success: false });
    }
});

// 📄 PDF Merge
app.post("/merge", upload.array("pdfs"), async (req, res) => {
    const mergedPdf = await PDFDocument.create();

    for (let file of req.files) {
        const pdfBytes = fs.readFileSync(file.path);
        const pdf = await PDFDocument.load(pdfBytes);
        const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        pages.forEach(p => mergedPdf.addPage(p));
    }

    const mergedBytes = await mergedPdf.save();
    const outputPath = "uploads/merged.pdf";

    fs.writeFileSync(outputPath, mergedBytes);

    // ✅ send + auto delete
    res.download(outputPath, () => {
        fs.unlinkSync(outputPath);
    });
});

// 📁 Upload file
app.post("/upload", upload.single("file"), (req, res) => {
    res.json({ message: "Uploaded" });
});

// 📂 List ONLY .f3d files
app.get("/files", (req, res) => {
    const files = fs.readdirSync("uploads");

    const filtered = files.filter(file => file.endsWith(".f3d"));

    res.json(filtered);
});

// ⬇️ Download
app.get("/download/:name", (req, res) => {
    res.download(path.join(__dirname, "uploads", req.params.name));
});

// ❌ Delete (admin only)
app.post("/delete", (req, res) => {
    const { filename, adminPassword } = req.body;

    if (adminPassword !== ADMIN_PASSWORD) {
        return res.json({ success: false });
    }

    fs.unlinkSync(path.join(__dirname, "uploads", filename));
    res.json({ success: true });
});

// 🚀 Server start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port " + PORT));