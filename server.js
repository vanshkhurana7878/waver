const express = require("express");
const path = require("path");
const dotenv = require("dotenv");
const nodemailer = require("nodemailer");

dotenv.config();

const app = express();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// -------------------- PAGES --------------------

app.get("/", (req, res) => {
    res.render("index");
});

app.get("/login", (req, res) => {
    res.render("login");
});

// -------------------- OTP STORAGE --------------------

let storedOTP = null;
let userEmail = null;

// -------------------- SEND EMAIL OTP --------------------

app.post("/send-email-otp", async (req, res) => {
    const email = req.body.email;

    if (!email) {
        return res.send("Email required");
    }

    userEmail = email;

    storedOTP = Math.floor(100000 + Math.random() * 900000);

    console.log("Generated OTP:", storedOTP);

    try {
        let transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: 465,
            secure: true,
            family: 4,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        let info = await transporter.sendMail({
            from: `"Waver" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: "Your OTP Code",
            text: `Your OTP is: ${storedOTP}`
        });

        console.log("Email Sent:", info.response);

        res.send("OTP sent to email 📩");

    } catch (error) {
        console.log("Email Error:", error);
        res.send("Error sending OTP");
    }
});

// -------------------- VERIFY OTP --------------------

app.post("/verify-email-otp", (req, res) => {
    const otp = req.body.otp;

    if (otp == storedOTP) {
        res.send("Login Success 🎉");
    } else {
        res.send("Invalid OTP ❌");
    }
});

// -------------------- START SERVER --------------------

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚀 Waver Running on Port ${PORT}`);
});