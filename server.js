
const express = require("express");
const multer = require("multer");
const { PDFDocument } = require("pdf-lib");
const cors = require("cors");
const path = require("path");
const crypto = require("crypto");
const cloudinary = require("cloudinary").v2;

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// =============== CLOUDINARY ===============

cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.API_KEY,
    api_secret: process.env.API_SECRET
});

// Check credentials are configured
if (!process.env.CLOUD_NAME ||
    !process.env.API_KEY ||
    !process.env.API_SECRET) {
    console.error("Cloudinary credentials missing!");
}

// =============== PASSWORDS ===============

const USER_PASSWORD = "1234";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

// =============== FILE UPLOAD CONFIG ===============

const storage = multer.memoryStorage();

const upload = multer({
    storage,
    limits: {
        fileSize: 100 * 1024 * 1024 // 100 MB per file
    }
});

// =============== HEALTH CHECK ===============

app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        message: "PDF Merger server running"
    });
});

// =============== PDF MERGE ===============

app.post("/merge", upload.array("pdfs", 20), async (req, res) => {
    try {
        if (!req.files || req.files.length < 2) {
            return res.status(400).send("Select at least two PDF files.");
        }

        const mergedPdf = await PDFDocument.create();

        for (const file of req.files) {
            if (path.extname(file.originalname).toLowerCase() !== ".pdf") {
                return res.status(400).send("Only PDF files can be merged.");
            }

            const pdf = await PDFDocument.load(file.buffer);

            const pages = await mergedPdf.copyPages(
                pdf,
                pdf.getPageIndices()
            );

            pages.forEach(page => mergedPdf.addPage(page));
        }

        const mergedBytes = await mergedPdf.save();

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
            "Content-Disposition",
            'attachment; filename="merged.pdf"'
        );

        res.send(Buffer.from(mergedBytes));

    } catch (error) {
        console.error("Merge error:", error);
        res.status(500).send("PDF merge failed. Check your PDF files.");
    }
});

// =============== UNIVERSAL FILE UPLOAD ===============

app.post("/upload", upload.single("file"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Please select a file."
            });
        }

        const originalName = path.basename(req.file.originalname);

        // Create a unique Cloudinary public ID.
        // Preserve the extension for raw files.
        const safeName = originalName.replace(/[^\w.\-]/g, "_");
        const publicId = `${Date.now()}-${crypto.randomUUID()}-${safeName}`;

        const result = await new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
                {
                    resource_type: "raw",
                    public_id: publicId,
                    filename_override: originalName,
                    context: {
                        original_filename: originalName
                    }
                },
                (error, result) => {
                    if (error) reject(error);
                    else resolve(result);
                }
            );

            stream.end(req.file.buffer);
        });

        res.json({
            success: true,
            message: "File uploaded successfully!",
            file: {
                original_filename: originalName,
                public_id: result.public_id,
                url: result.secure_url
            }
        });

    } catch (error) {
        console.error("Upload error:", error);

        res.status(500).json({
            success: false,
            message: error.message || "File upload failed."
        });
    }
});

// =============== FILE LIST ===============

app.get("/files", async (req, res) => {
    try {
        const result = await cloudinary.search
            .expression("resource_type:raw AND resource_type:raw")
            .sort_by("created_at", "desc")
            .max_results(100)
            .with_field("context")
            .execute();

        const files = result.resources.map(file => {
            const originalName =
                file.context?.custom?.original_filename ||
                file.public_id.replace(/^[^-]+-[^-]+-/, "");

            return {
                original_filename: originalName,
                public_id: file.public_id,
                url: cloudinary.url(file.public_id, {
                    resource_type: "raw",
                    secure: true,
                    flags: "attachment"
                }),
                size: file.bytes,
                created_at: file.created_at
            };
        });

        res.json(files);

    } catch (error) {
        console.error("File listing error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to load files."
        });
    }
});

// =============== DOWNLOAD ===============

app.get("/download", async (req, res) => {
    try {
        const publicId = req.query.public_id;

        if (!publicId || typeof publicId !== "string") {
            return res.status(400).send("Invalid file ID.");
        }

        const downloadUrl = cloudinary.url(publicId, {
            resource_type: "raw",
            secure: true,
            flags: "attachment"
        });

        res.redirect(downloadUrl);

    } catch (error) {
        console.error("Download error:", error);
        res.status(500).send("Download failed.");
    }
});

// =============== DELETE ===============

app.post("/delete", async (req, res) => {
    try {
        const { public_id, adminPassword } = req.body;

        if (adminPassword !== ADMIN_PASSWORD) {
            return res.status(401).json({
                success: false,
                message: "Wrong admin password."
            });
        }

        if (!public_id || typeof public_id !== "string") {
            return res.status(400).json({
                success: false,
                message: "Invalid file ID."
            });
        }

        const result = await cloudinary.uploader.destroy(public_id, {
            resource_type: "raw",
            type: "upload",
            invalidate: true
        });

        if (result.result !== "ok") {
            return res.status(404).json({
                success: false,
                message: "File not found or already deleted."
            });
        }

        res.json({
            success: true,
            message: "File deleted successfully."
        });

    } catch (error) {
        console.error("Delete error:", error);

        res.status(500).json({
            success: false,
            message: "Delete failed."
        });
    }
});

// =============== ERROR HANDLER ===============

app.use((error, req, res, next) => {
    console.error("Server error:", error);

    if (error instanceof multer.MulterError) {
        return res.status(400).json({
            success: false,
            message: error.code === "LIMIT_FILE_SIZE"
                ? "File exceeds the 100 MB upload limit."
                : error.message
        });
    }

    res.status(500).json({
        success: false,
        message: "Something went wrong."
    });
});

// =============== START SERVER ===============

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log("Server running on port " + PORT);
});
