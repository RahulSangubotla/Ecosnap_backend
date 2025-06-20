const s3UploadMiddleware = require('../middleware/s3.upload.js');

const uploadImage = (req, res) => {
    // Use the S3 middleware to handle the file upload
    s3UploadMiddleware(req, res, function (err) {
        if (err) {
            console.error("S3 Upload Error:", err);
            return res.status(400).json({ message: "File upload failed.", error: err.message });
        }

        // After a successful upload, the file's info is in req.file
        if (!req.file) {
            return res.status(400).json({ message: "No file was uploaded." });
        }
        
        // Send the public URL of the uploaded image back to the Flutter app
        return res.status(200).json({
            message: 'File uploaded successfully',
            imageUrl: req.file.location 
        });
    });
};

module.exports = {
    uploadImage
};
