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

/* FOLDERS */
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

/* STORAGE */
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, file.originalname)
});
const upload = multer({ storage });

/* PASSWORDS */
const MAIN_PASS = "1234";
const DELETE_PASS = "delete";

/* MERGE (NO PASSWORD) */
app.post("/merge", upload.array("pdfs"), async (req, res) => {
    try {
        const mergedPdf = await PDFDocument.create();

        for (let file of req.files) {
            const pdfBytes = fs.readFileSync(file.path);
            const pdf = await PDFDocument.load(pdfBytes);
            const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
            pages.forEach(p => mergedPdf.addPage(p));

            fs.unlinkSync(file.path);
        }

        const mergedBytes = await mergedPdf.save();

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", "attachment; filename=merged.pdf");
        res.send(Buffer.from(mergedBytes));

    } catch (err) {
        console.log(err);
        res.status(500).send("Error merging PDFs");
    }
});

/* UPLOAD (MAIN PASSWORD REQUIRED) */
app.post("/upload", upload.single("file"), (req, res) => {
    const pass = req.headers["password"];

    if (pass !== MAIN_PASS) {
        return res.status(403).send("Wrong password");
    }

    res.send("Uploaded");
});

/* LIST FILES */
app.get("/files", (req, res) => {
    const files = fs.readdirSync(uploadDir);
    res.json(files);
});

/* DOWNLOAD (MAIN PASSWORD REQUIRED) */
app.get("/download/:name", (req, res) => {
    const pass = req.headers["password"];

    if (pass !== MAIN_PASS) {
        return res.status(403).send("Wrong password");
    }

    const filePath = path.join(uploadDir, req.params.name);
    res.download(filePath);
});

/* DELETE (DELETE PASSWORD REQUIRED) */
app.post("/delete", (req, res) => {
    const { filename, password } = req.body;

    if (password !== DELETE_PASS) {
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

/* START */
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Server running"));
