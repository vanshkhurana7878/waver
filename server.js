const express = require("express");
const path = require("path");
const dotenv = require("dotenv");
const { Resend } = require("resend");

dotenv.config();

const app = express();

const resend = new Resend(process.env.RESEND_API_KEY);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ---------------- HOME ----------------

app.get("/", (req, res) => {
    res.render("index");
});

app.get("/login", (req, res) => {
    res.render("login");
});

// ---------------- OTP STORAGE ----------------

let storedOTP = null;
let userEmail = null;

// ---------------- SEND OTP ----------------

app.post("/send-email-otp", async (req, res) => {

    const email = req.body.email;

    if (!email) {
        return res.send("Email required");
    }

    userEmail = email;

    storedOTP = Math.floor(100000 + Math.random() * 900000);

    console.log("Generated OTP:", storedOTP);

    try {

        await resend.emails.send({
            from: "Waver <noreply@waver.co.in>",
            to: email,
            subject: "Your OTP Code",
            html: `
                <h2>Waver Login OTP</h2>
                <p>Your OTP is:</p>
                <h1>${storedOTP}</h1>
                <p>This OTP will expire soon.</p>
            `
        });

        console.log("Email Sent Successfully");

        res.send("OTP sent to email 📩");

    } catch (error) {

        console.error(error);

        res.send("Error sending OTP");

    }

});

// ---------------- VERIFY OTP ----------------

app.post("/verify-email-otp", (req, res) => {

    const otp = req.body.otp;

    if (otp == storedOTP) {

        storedOTP = null;

        res.send("Login Success 🎉");

    } else {

        res.send("Invalid OTP ❌");

    }

});

// ---------------- SERVER ----------------

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {

    console.log(`🚀 Waver Running on Port ${PORT}`);

});