import fs from 'fs';
import mysql from 'mysql';

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: 'apexa_db'
});

db.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL database:', err);
        return;
    }
    console.log('Connected to MySQL database');
});

const insertImage = (imagePath) => {
    try {
        const image = fs.readFileSync(imagePath);
        const sql = 'INSERT INTO images (image) VALUES (?)';

        db.query(sql, [image], (err, result) => {
            if (err) {
                console.error('Error inserting image:', err);
                return;
            }
            console.log('Image inserted successfully');
            db.end(); // Close the database connection after insertion
        });
    } catch (error) {
        console.error('Error reading image file:', error);
    }
};

// Replace with the path to your image file
const imagePath = "C:\\Users\\TUF\\Documents\\APEXA\\Implementation\\images\\c3.jpg";
insertImage(imagePath);
