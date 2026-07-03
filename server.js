const express = require("express");
const path = require("path");
const dotenv = require("dotenv");

const { Resend } = require("resend");

dotenv.config();
console.log("SUPABASE URL:", process.env.SUPABASE_URL);
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);
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
app.get("/service", (req, res) => {
    res.render("service");
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

        return res.json({
            success: true,
            redirect: "/service"
        });

    } else {

        return res.json({
            success: false
        });
    }

});
app.get("/test", async (req, res) => {
  const { data, error } = await supabase
    .from("users")
    .select("*");

  if (error) {
    console.log(error);
    return res.send("Supabase Error");
  }

  res.json(data);
});
//-----------------Database------------------
app.get("/barbers", async (req, res) => {

    const { data, error } = await supabase
        .from("user")
        .select("*");

    if (error) {
        console.log(error);
        return res.json(error);
    }

    res.render("barber", {
        barbers: data
    });
    // database -----------------2
    app.get("/pricing/:id", async (req, res) => {

    const barberId = req.params.id;

    const { data, error } = await supabase
        .from("user")
        .select("*")
        .eq("id", barberId)
        .single();

    if (error) {
        console.log(error);
        return res.send("Error");
    }

    res.render("pricing", {
        barber: data
    });

});

});

// ---------------- BOOKING CREATE ----------------

app.post("/create-booking", async (req, res) => {

    const {
        barber_id,
        services,
        total_price,
        payment_method
    } = req.body;

    const parsedServices = JSON.parse(services);

    const { data, error } = await supabase
        .from("user")
        .insert([
            {
                barber_id,
                services: parsedServices,
                total_price,
                payment_method,
                status: "pending"
            }
        ])
        .select()
        .single();

    if (error) {
        console.log(error);
        return res.send("Booking failed");
    }

    res.redirect(`/waiting/${data.id}`);
});
//----------------------------Database 3
app.get("/confirmation/:id", async (req, res) => {
    const { data } = await supabase
        .from("user")
        .select("*")
        .eq("id", req.params.id)
        .single();

    res.render("confirmation", { booking: data });
});
// ---------------- BOOKING STATUS CHECK ----------------

app.get("/booking-status/:id", async (req, res) => {

    const { data, error } = await supabase
        .from("user")
        .select("status")
        .eq("id", req.params.id)
        .single();

    if (error) {
        console.log(error);
        return res.send("Error fetching status");
    }

    res.json(data);
});
// ---------------- SERVER ----------------

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {

    console.log(`🚀 Waver Running on Port ${PORT}`);

});