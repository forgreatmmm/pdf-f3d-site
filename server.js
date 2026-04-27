const express = require("express");
const multer = require("multer");
const fs = require("fs");
const { PDFDocument } = require("pdf-lib");
const cors = require("cors");
const path = require("path");

// 🔥 Cloudinary
const cloudinary = require("cloudinary").v2;

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// ================= CLOUDINARY CONFIG =================
cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.API_KEY,
    api_secret: process.env.API_SECRET
});

// ================= LOCAL UPLOAD TEMP =================
const uploadDir = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname)
});

const upload = multer({ storage });

// ================= PASSWORDS =================
const USER_PASSWORD = "1234";
const ADMIN_PASSWORD = "admin123";

// ================= LOGIN =================
app.post("/login", (req, res) => {
    res.json({ success: req.body.password === USER_PASSWORD });
});

// ================= PDF MERGE =================
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

// ================= UPLOAD TO CLOUDINARY =================
app.post("/upload", upload.single("file"), async (req, res) => {
    try {
        const result = await cloudinary.uploader.upload(req.file.path, {
            resource_type: "raw"
        });

        // delete local temp file
        fs.unlinkSync(req.file.path);

        res.json({
            success: true,
            file: {
                url: result.secure_url,
                public_id: result.public_id,
                original_filename: req.file.originalname
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false });
    }
});

// ================= LIST FILES =================
app.get("/files", async (req, res) => {
    try {
        const result = await cloudinary.search
            .expression("resource_type:raw")
            .sort_by("created_at", "desc")
            .max_results(30)
            .execute();

        const files = result.resources.map(f => ({
            url: f.secure_url,
            public_id: f.public_id,
            original_filename: f.original_filename || f.public_id
        }));

        res.json(files);

    } catch (err) {
        console.error(err);
        res.json([]);
    }
});

// ================= DELETE =================
app.post("/delete", async (req, res) => {
    const { public_id, adminPassword } = req.body;

    if (adminPassword !== ADMIN_PASSWORD) {
        return res.json({ success: false });
    }

    try {
        await cloudinary.uploader.destroy(public_id, {
            resource_type: "raw"
        });

        res.json({ success: true });

    } catch (err) {
        console.error(err);
        res.json({ success: false });
    }
});

// ================= START =================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port " + PORT));
