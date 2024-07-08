import express from 'express';
import mysql from 'mysql';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import cookieParser from 'cookie-parser';
import nodemailer from 'nodemailer';
import bodyParser from 'body-parser';

const salt = 10;
const app = express();
app.use(bodyParser.json({ limit: '10mb' })); // Image Size
app.use(bodyParser.urlencoded({ limit: '100mb', extended: true }));
app.use(express.json());
app.use(cors({
    origin: ['http://localhost:3000'],
    methods: ["POST", "GET","DELETE"],
    credentials: true
}));

app.use(cookieParser());

// Connection 
const db = mysql.createPool({
    connectionLimit: 10,
    host: 'localhost',
    user: 'root',
    password: 'root', 
    database: 'apexa_db'
});

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'teamapexa2024@gmail.com',
        pass: 'glsd dxny pwjo kqoq'
    }
});

const verifyUser = (req, res, next) => {
    const token = req.cookies.token;
    if (!token) {
        return res.json({ Error: "You are not authenticated" });
    } else {
        jwt.verify(token, "jwt-secrty-key", (err, decoded) => {
            if (err) {
                return res.json({ Error: "Token is not correct" });
            } else {
                req.name = decoded.name;
                next();
            }
        });
    }
};

//admin page
app.get('/adminpage', verifyUser, (req, res) => {
    return res.json({ Status: "Success", name: req.name });
});

app.get('/user-details', verifyUser, (req, res) => {
    const sql = "SELECT username, email FROM users";
    db.query(sql, (err, result) => {
        if (err) {
            return res.json({ Error: "Error fetching users from database" });
        }
        return res.json({ Status: "Success", users: result });
    });
});

app.delete('/deleteuser', verifyUser, (req, res) => {
    const { email } = req.body;
    const sql = "DELETE FROM users WHERE email = ?";

    db.query(sql, [email], (err, result) => {
        if (err) return res.json({ Error: "Error deleting user from database" });
        if (result.affectedRows === 0) {
            return res.json({ Error: "No user found with this email" });
        }
        return res.json({ Status: "Success", Message: "User deleted successfully" });
    });
});

app.get('/uploadImagePage', verifyUser, (req, res) => {
    return res.json({ Status: "Success", name: req.name });
});

//register
app.post('/register', (req, res) => {
    const checkEmailSql = "SELECT * FROM users WHERE email = ?";
    db.query(checkEmailSql, [req.body.email], (err, result) => {
        if (err) return res.json({ Error: "Server error while checking email" });

        if (result.length > 0) {
            return res.json({ Error: "Email already exists" });
        } else {
            const sql = "INSERT INTO users (`username`, `email`, `password`, `role`) VALUES (?)";
            bcrypt.hash(req.body.password.toString(), salt, (err, hash) => {
                if (err) return res.json({ Error: "Error hashing password" });

                const values = [
                    req.body.username,
                    req.body.email,
                    hash,
                    'user' // Set role to 'user'
                ];

                db.query(sql, [values], (err, result) => {
                    if (err) return res.json({ Error: "Inserting data error in server" });
                    return res.json({ Status: "Success" });
                });
            });
        }
    });
});


app.get('/user-details', verifyUser, (req, res) => {
    const sql = "SELECT username, email FROM users";
    db.query(sql, (err, result) => {
        if (err) {
            return res.json({ Error: "Error fetching users from database" });
        }
        return res.json({ Status: "Success", users: result });
    });
});

app.delete('/deleteuser', verifyUser, (req, res) => {
    const { email } = req.body;
    const sql = "DELETE FROM users WHERE email = ?";

    db.query(sql, [email], (err, result) => {
        if (err) return res.json({ Error: "Error deleting user from database" });
        if (result.affectedRows === 0) {
            return res.json({ Error: "No user found with this email" });
        }
        return res.json({ Status: "Success", Message: "User deleted successfully" });
    });
});

//login
app.post('/login', (req, res) => {
    const sql = "SELECT * FROM users WHERE email = ?";
    db.query(sql, [req.body.email], (err, data) => {
        if (err) return res.json({ Error: "Login error in server" });
        if (data.length > 0) {
            bcrypt.compare(req.body.password.toString(), data[0].password, (err, response) => {
                if (err) return res.json({ Error: "Password compare error" });
                if (response) {
                    const name = data[0].name;
                    const role = data[0].role;
                    const token = jwt.sign({ name, role }, "jwt-secrty-key", { expiresIn: '1d' });
                    res.cookie('token', token);
                    return res.json({ Status: "Success", role });
                } else {
                    return res.json({ Error: "Password not matched" });
                }
            });
        } else {
            return res.json({ Error: "No email existed" });
        }
    });
});

app.get('/logout', (req, res) => {
    res.clearCookie('token');
    return res.json({ Status: "Success" });
});

//forgot password
app.post('/forgotpassword', (req, res) => {
    const { email } = req.body;
    const sql = "SELECT * FROM users WHERE email = ?";
    db.query(sql, [email], (err, data) => {
        if (err) return res.json({ Error: "Error finding email" });
        if (data.length > 0) {
            const token = jwt.sign({ email: data[0].email }, "jwt-secret-key", { expiresIn: '1h' });
            const url = `http://localhost:3000/resetpassword/${token}`;

            const mailOptions = {
                from: 'teamapexa2024@gmail.com',
                to: email,
                subject: 'Password Reset',
                html: `<p>Click <a href="${url}">here</a> to reset your password</p>`
            };

            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    return res.json({ Error: "Error sending email" });
                }
                return res.json({ Status: "Success", Message: "Email sent" });
            });
        } else {
            return res.json({ Error: "No email existed" });
        }
    });
});

//reset password
app.post('/resetpassword/:token', (req, res) => {
    const { token } = req.params;
    const { password } = req.body;

    jwt.verify(token, "jwt-secret-key", (err, decoded) => {
        if (err) {
            return res.json({ Error: "Invalid or expired token" });
        }

        bcrypt.hash(password.toString(), salt, (err, hash) => {
            if (err) return res.json({ Error: "Error hashing password" });

            const sql = "UPDATE users SET password = ? WHERE email = ?";
            db.query(sql, [hash, decoded.email], (err, result) => {
                if (err) return res.json({ Error: "Error updating password" });
                return res.json({ Status: "Success", Message: "Password updated successfully" });
            });
        });
    });
});

//Upload survay plan
app.post('/upload', (req, res) => {
    const { fileData, fileName } = req.body;
    const sql = 'INSERT INTO `user_input_image` (image) VALUES (?)';
    db.query(sql, [fileData], (err, result) => {
        if (err) {
            console.error('Error inserting data into the database:', err);
            res.status(500).send('Error saving data.');
            return;
        }
        res.status(200).send('File uploaded successfully.');
    });
});

// Fetch all users
app.get('/users', (req, res) => {
    const sql = "SELECT * FROM user_input";
    db.query(sql, (err, data) => {
        if (err) {
            console.error("Error fetching users:", err);
            return res.status(500).json({ error: "Failed to fetch users" });
        }
        return res.json(data);
    });
});

// Fetch generated floor plan images
app.get('/api/images', (req, res) => {
    const sql = "SELECT * FROM images limit 3";
    db.query(sql, (err, data) => {
      if (err) {
        console.error("Error fetching images:", err);
        return res.status(500).json({ error: "Failed to fetch images" });
      }
      return res.json(data);
    });
  });
  

  // Download floor plan image
app.get('/api/images/download/:id', (req, res) => {
    const id = req.params.id;
    const sql = "SELECT image FROM images WHERE id = ?";
    db.query(sql, [id], (err, data) => {
      if (err) {
        console.error("Error fetching image:", err);
        return res.status(500).json({ error: "Failed to fetch image" });
      }
      if (data.length > 0) {
        const imageBuffer = data[0].image;
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Content-Disposition', `attachment; filename=image_${id}.jpg`);
        res.send(imageBuffer);
      } else {
        return res.status(404).json({ error: "Image not found" });
      }
    });
  });

// user requirements
app.post('/users', (req, res) => {
    const { number_of_room, land_width, land_length, floor_angle } = req.body;
    const sql = "INSERT INTO user_input (number_of_room, land_width, land_length, floor_angle) VALUES (?, ?, ?, ?)";
    db.query(sql, [number_of_room, land_width, land_length, floor_angle], (err, result) => {
        if (err) {
            console.error("Error adding user:", err);
            return res.status(500).json({ error: "Failed to add user", details: err.message });
        }
        console.log("New user added:", result);
        return res.status(201).json({ message: "User added successfully" });
    });
});

// Insert 3d image
app.post('/api/images/insert', (req, res) => {
    const { image_id, image_data } = req.body;
    const decodedImage = Buffer.from(image_data, 'base64');
    const sql = "INSERT INTO 3dmodelinput (image_data) VALUES (?)";
    db.query(sql, [image_id, decodedImage], (err, result) => {
      if (err) {
        console.error("Error saving image:", err);
        return res.status(500).json({ error: "Failed to save image" });
      }
      console.log("Image saved successfully:", result);
      return res.status(201).json({ message: "Image saved successfully" });
    });
  });

  // Fetch 3d images
app.get('/api/3dmodeloutput', (req, res) => {
    const sql = "SELECT * FROM 3dmodeloutput limit 1";
    db.query(sql, (err, data) => {
      if (err) {
        console.error("Error fetching images:", err);
        return res.status(500).json({ error: "Failed to fetch images" });
      }
      return res.json(data);
    });
  });
  

  // Download 3d image
app.get('/api/3dmodeloutput/download/:id', (req, res) => {
    const id = req.params.id;
    const sql = "SELECT image_data FROM 3dmodeloutput WHERE id = ?";
    db.query(sql, [id], (err, data) => {
      if (err) {
        console.error("Error fetching image:", err);
        return res.status(500).json({ error: "Failed to fetch image" });
      }
      if (data.length > 0) {
        const imageBuffer = data[0].image;
        res.setHeader('Content-Type', 'image_data/jpeg');
        res.setHeader('Content-Disposition', `attachment; filename=image_data_${id}.jpg`);
        res.send(imageBuffer);
      } else {
        return res.status(404).json({ error: "Image not found" });
      }
    });
  });
  
app.listen(8081, () => {
    console.log("Server running on port 8081...");
});
