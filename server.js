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

// ✅ Ensure uploads folder exists (IMPORTANT for Render)
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// ✅ Storage config
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
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
    res.json({ success: req.body.password === USER_PASSWORD });
});

// PDF Merge
app.post("/merge", upload.array("pdfs"), async (req, res) => {
    try {
        const mergedPdf = await PDFDocument.create();

        for (let file of req.files) {
            const pdfBytes = fs.readFileSync(file.path);
            const pdf = await PDFDocument.load(pdfBytes);
            const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
            pages.forEach(p => mergedPdf.addPage(p));
        }

        const mergedBytes = await mergedPdf.save();
        const outputPath = path.join(uploadDir, "merged.pdf");

        fs.writeFileSync(outputPath, mergedBytes);

        res.download(outputPath, () => {
            fs.unlinkSync(outputPath);
        });

    } catch (err) {
        console.error(err);
        res.status(500).send("Error merging PDFs");
    }
});

// Upload file
app.post("/upload", upload.single("file"), (req, res) => {
    res.json({ message: "Uploaded successfully" });
});

// List files
app.get("/files", (req, res) => {
    try {
        const files = fs.readdirSync(uploadDir);
        const filtered = files.filter(f => f.endsWith(".f3d"));
        res.json(filtered);
    } catch (err) {
        res.json([]);
    }
});

// Download
app.get("/download/:name", (req, res) => {
    res.download(path.join(uploadDir, req.params.name));
});

// Delete
app.post("/delete", (req, res) => {
    const { filename, adminPassword } = req.body;

    if (adminPassword !== ADMIN_PASSWORD) {
        return res.json({ success: false });
    }

    const filePath = path.join(uploadDir, filename);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }

    res.json({ success: true });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port " + PORT));
