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

/* ================= CLOUDINARY CONFIG ================= */
cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.API_KEY,
    api_secret: process.env.API_SECRET
});

/* ================= LOCAL TEMP FOLDER ================= */
const uploadDir = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

/* ================= MULTER ================= */
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname)
});

const upload = multer({ storage });

/* ================= PASSWORDS ================= */
const USER_PASSWORD = "1234";
const ADMIN_PASSWORD = "admin123";

/* ================= LOGIN ================= */
app.post("/login", (req, res) => {
    res.json({ success: req.body.password === USER_PASSWORD });
});

/* ================= PDF MERGE ================= */
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
        res.status(500).send("Merge failed");
    }
});

/* ================= UPLOAD (CLOUDINARY) ================= */
app.post("/upload", upload.single("file"), async (req, res) => {
    try {
        const result = await cloudinary.uploader.upload(req.file.path, {
            resource_type: "raw" // important for any file type
        });

        fs.unlinkSync(req.file.path); // remove local file

        res.json({
            message: "Uploaded",
            url: result.secure_url,
            public_id: result.public_id,
            created_at: Date.now()
        });

    } catch (err) {
        console.error(err);
        res.status(500).send("Upload failed");
    }
});

/* ================= LIST FILES ================= */
app.get("/files", async (req, res) => {
    try {
        const result = await cloudinary.api.resources({
            resource_type: "raw"
        });

        const files = result.resources.map(f => ({
            name: f.original_filename,
            url: f.secure_url,
            id: f.public_id,
            created: new Date(f.created_at).getTime()
        }));

        res.json(files);
    } catch (err) {
        console.error(err);
        res.json([]);
    }
});

/* ================= DOWNLOAD ================= */
app.get("/download/:id", async (req, res) => {
    const id = req.params.id;
    const url = cloudinary.url(id, { resource_type: "raw" });
    res.redirect(url);
});

/* ================= DELETE ================= */
app.post("/delete", async (req, res) => {
    const { id, adminPassword } = req.body;

    if (adminPassword !== ADMIN_PASSWORD) {
        return res.json({ success: false });
    }

    try {
        await cloudinary.uploader.destroy(id, { resource_type: "raw" });
        res.json({ success: true });
    } catch {
        res.json({ success: false });
    }
});

/* ================= AUTO DELETE (1 DAY) ================= */
setInterval(async () => {
    try {
        const result = await cloudinary.api.resources({
            resource_type: "raw"
        });

        const now = Date.now();

        for (let file of result.resources) {
            const created = new Date(file.created_at).getTime();

            if (now - created > 24 * 60 * 60 * 1000) {
                await cloudinary.uploader.destroy(file.public_id, {
                    resource_type: "raw"
                });
                console.log("Deleted old file:", file.public_id);
            }
        }
    } catch (err) {
        console.log("Auto delete error:", err.message);
    }
}, 60 * 60 * 1000); // every 1 hour

/* ================= START ================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port " + PORT));
