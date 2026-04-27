const express = require("express");
const multer = require("multer");
const fs = require("fs");
const { PDFDocument } = require("pdf-lib");
const cors = require("cors");
const path = require("path");
const cloudinary = require("cloudinary").v2;

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// ================= CLOUDINARY =================
cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.API_KEY,
    api_secret: process.env.API_SECRET
});

// ================= TEMP STORAGE =================
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname)
});
const upload = multer({ storage });

// ================= PASSWORDS =================
const USER_PASSWORD = "1234";
const ADMIN_PASSWORD = "admin123";

// ================= MERGE =================
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

        res.download(outputPath, () => fs.unlinkSync(outputPath));

    } catch {
        res.status(500).send("Merge failed");
    }
});

// ================= UPLOAD =================
app.post("/upload", upload.single("file"), async (req, res) => {
    try {
        const result = await cloudinary.uploader.upload(req.file.path, {
            resource_type: "raw",
            public_id: req.file.originalname // ⭐ FIX: keep original name
        });

        fs.unlinkSync(req.file.path);

        res.json({ success: true });

    } catch {
        res.json({ success: false });
    }
});

// ================= FILE LIST =================
app.get("/files", async (req, res) => {
    try {
        const result = await cloudinary.search
            .expression("resource_type:raw")
            .sort_by("created_at", "desc")
            .max_results(50)
            .execute();

        const files = result.resources.map(f => ({
            url: f.secure_url,
            public_id: f.public_id,
            original_filename: f.public_id // ⭐ show real name
        }));

        res.json(files);

    } catch {
        res.json([]);
    }
});

// ================= DELETE =================
app.post("/delete", async (req, res) => {
    const { public_id, adminPassword } = req.body;

    if (adminPassword !== ADMIN_PASSWORD) {
        return res.json({ success: false });
    }

    await cloudinary.uploader.destroy(public_id, {
        resource_type: "raw"
    });

    res.json({ success: true });
});

// ================= START =================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port " + PORT));
