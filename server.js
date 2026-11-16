
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

if (!process.env.CLOUD_NAME ||
    !process.env.API_KEY ||
    !process.env.API_SECRET) {
    console.error("Cloudinary credentials missing!");
}

// =============== PASSWORDS ===============

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

// =============== UPLOAD CONFIG ===============

const storage = multer.memoryStorage();

const upload = multer({
    storage,
    limits: {
        fileSize: 100 * 1024 * 1024
    }
});

// =============== ORIGINAL FILENAME ===============

function getOriginalFilename(file) {

    // Prefer Cloudinary's stored original filename
    if (file.original_filename) {
        return file.original_filename;
    }

    if (file.context?.custom?.original_filename) {
        return file.context.custom.original_filename;
    }

    const publicId = file.public_id;

    // New filename format: timestamp-UUID-base64name.extension
    const extension = path.extname(publicId);
    const idWithoutExtension = extension
        ? publicId.slice(0, -extension.length)
        : publicId;

    const newMatch = idWithoutExtension.match(
        /^\d+-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-(.+)$/i
    );

    if (newMatch) {
        try {
            const decoded = Buffer.from(
                newMatch[1],
                "base64url"
            ).toString("utf8");

            if (decoded) {
                return decoded + extension;
            }
        } catch (error) {
            console.error("Filename decode error:", error);
        }
    }

    // Old filename format: timestamp-UUID-originalname
    const oldMatch = publicId.match(
        /^\d+-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-(.+)$/i
    );

    if (oldMatch) {
        return oldMatch[1];
    }

    return publicId;
}

// =============== HEALTH CHECK ===============

app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        message: "Server running successfully"
    });
});

// =============== PDF MERGER ===============

app.post("/merge", upload.array("pdfs", 20), async (req, res) => {
    try {

        if (!req.files || req.files.length < 2) {
            return res.status(400).send(
                "Please select at least two PDF files."
            );
        }

        const mergedPdf = await PDFDocument.create();

        for (const file of req.files) {

            if (path.extname(file.originalname).toLowerCase() !== ".pdf") {
                return res.status(400).send(
                    "Only PDF files can be merged."
                );
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

        res.status(500).send(
            "PDF merge failed. Check your PDF files."
        );
    }
});

// =============== UNIVERSAL UPLOAD ===============

app.post("/upload", upload.single("file"), async (req, res) => {

    try {

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Please select a file."
            });
        }

        const originalName = path.basename(req.file.originalname);

        const extension = path.extname(originalName);

        const nameWithoutExtension = extension
            ? originalName.slice(0, -extension.length)
            : originalName;

        // Encode filename to preserve spaces and special characters
        const encodedName = Buffer.from(
            nameWithoutExtension,
            "utf8"
        ).toString("base64url");

        const publicId =
            Date.now() + "-" +
            crypto.randomUUID() + "-" +
            encodedName + extension;

        // Raw Cloudinary public IDs have a 255-character limit
        if (publicId.length > 250) {
            return res.status(400).json({
                success: false,
                message: "Filename is too long. Please rename the file."
            });
        }

        const result = await new Promise((resolve, reject) => {

            const stream = cloudinary.uploader.upload_stream(
                {
                    resource_type: "raw",
                    type: "upload",
                    public_id: publicId,
                    filename_override: originalName,
                    context: {
                        original_filename: originalName
                    }
                },
                (error, result) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(result);
                    }
                }
            );

            stream.end(req.file.buffer);

        });

        res.json({
            success: true,
            message: "File uploaded successfully!",
            file: {
                original_filename: originalName,
                public_id: result.public_id
            }
        });

    } catch (error) {

        console.error("Upload error:", error);

        res.status(500).json({
            success: false,
            message: error.message || "Upload failed."
        });
    }
});

// =============== FILE LIST ===============

app.get("/files", async (req, res) => {

    try {

        const result = await cloudinary.search
            .expression("resource_type:raw")
            .sort_by("created_at", "desc")
            .max_results(100)
            .with_field("context")
            .execute();

        const files = result.resources.map(file => {

            return {
                original_filename: getOriginalFilename(file),

                public_id: file.public_id,

                size: file.bytes,

                created_at: file.created_at,

                url: "/download?public_id=" +
                    encodeURIComponent(file.public_id)
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

// =============== DOWNLOAD FILE ===============

app.get("/download", async (req, res) => {

    try {

        const publicId = req.query.public_id;

        if (!publicId || typeof publicId !== "string") {
            return res.status(400).send("Invalid file ID.");
        }

        // Verify the file exists in our Cloudinary account
        const resource = await cloudinary.api.resource(
            publicId,
            {
                resource_type: "raw",
                type: "upload"
            }
        );

        if (!resource.secure_url) {
            return res.status(404).send("File URL not found.");
        }

        // Download file through the server
        const cloudResponse = await fetch(resource.secure_url);

        if (!cloudResponse.ok) {
            throw new Error(
                "Cloudinary returned HTTP " + cloudResponse.status
            );
        }

        const buffer = Buffer.from(
            await cloudResponse.arrayBuffer()
        );

        const originalName = getOriginalFilename(resource);

        // Safe download filename
        const asciiName = originalName
            .replace(/[^\x20-\x7E]/g, "_")
            .replace(/["\\]/g, "_");

        const encodedName = encodeURIComponent(originalName);

        res.setHeader(
            "Content-Type",
            "application/octet-stream"
        );

        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${asciiName}"; filename*=UTF-8''${encodedName}`
        );

        res.setHeader("Content-Length", buffer.length);

        res.setHeader("Cache-Control", "no-store");

        res.send(buffer);

    } catch (error) {

        console.error("Download error:", error);

        res.status(500).send(
            "Download failed: " + error.message
        );
    }
});

// =============== DELETE FILE ===============

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

        const result = await cloudinary.uploader.destroy(
            public_id,
            {
                resource_type: "raw",
                type: "upload",
                invalidate: true
            }
        );

        if (result.result !== "ok") {
            return res.status(404).json({
                success: false,
                message: "File not found."
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
                ? "File exceeds 100 MB limit."
                : error.message
        });
    }

    res.status(500).json({
        success: false,
        message: "Internal server error."
    });
});

// =============== START SERVER ===============

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log("Server running on port " + PORT);
});
