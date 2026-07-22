const express = require("express");
const path = require("path");
const dotenv = require("dotenv");

const Razorpay = require("razorpay");
const session = require("express-session");
const cookieParser = require("cookie-parser");

const { Resend } = require("resend");
//---razorpay
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});//-----

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
app.use(cookieParser());

app.use(
    session({
        secret: "waver-secret-key",
        resave: false,
        saveUninitialized: false,
        cookie: {
            maxAge: 1000 * 60 * 60 * 24 // 24 hours
        }
    })
);
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
//--------------barber login logic
app.post("/barber-send-otp", async (req, res) => {

    const { email } = req.body;

    const { data, error } = await supabase
        .from("user")
        .select("*")
        .eq("email", email)
        .eq("role", "barber")
        .single();

    if (error || !data) {
        return res.json({
            success: false,
            message: "Access Denied"
        });
    }

    userEmail = email;

    storedOTP = Math.floor(100000 + Math.random() * 900000);

    await resend.emails.send({
        from: "Waver <noreply@waver.co.in>",
        to: email,
        subject: "Barber Login OTP",
        html: `<h1>${storedOTP}</h1>`
    });

    res.json({
        success: true
    });

});
//-------test
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
//Razor 
app.post("/create-order", async (req, res) => {

    const options = {
        amount: req.body.amount * 100, // ₹200 => 20000 paise
        currency: "INR",
        receipt: "receipt_" + Date.now()
    };

    try {

        const order = await razorpay.orders.create(options);

        res.json(order);

    } catch (err) {

        console.log(err);
        res.status(500).send("Order creation failed");

    }

});

// ---------------- BOOKING CREATE ----------------

app.post("/create-booking", async (req, res) => {
    const token = req.headers.authorization?.replace("Bearer ", "");

if (!token) {
    return res.status(401).json({
        success:false,
        message:"Login required"
    });
}


const {
    data:{ user },
    error:userError
} = await supabase.auth.getUser(token);


if(userError || !user){
    return res.status(401).json({
        success:false,
        message:"Invalid user"
    });
}

    const {
        barber_id,
        services,
        total_price,
        payment_method
        
    } = req.body;

    const parsedServices = JSON.parse(services);

    const { data, error } = await supabase
        .from("bookings")
        .insert([
            {
               
   barber_id,
    user_id:user.id,
    user_email:user.email,
    services: parsedServices,
    total_price,
    payment_method,
    status:"pending"
            }
        ])
        .select()
        .single();

    if (error) {
    console.log("Supabase Error:", error);

    return res.status(500).json({
        success: false,
        error: error.message
    });
}

    return res.json({
    success: true,
    bookingId: data.id
});
});
//---- accept booking 
app.post("/accept-booking/:id", async (req, res) => {

    const { id } = req.params;

    const { error } = await supabase
        .from("bookings")
        .update({
            status: "confirmed"
        })
        .eq("id", id);

    if (error) {
        console.log(error);
        return res.json({
            success: false
        });
    }

    res.json({
        success: true
    });

});
//-----------reject booking 
app.post("/reject-booking/:id", async (req, res) => {

    const { id } = req.params;

    const { error } = await supabase
        .from("bookings")
        .update({
            status: "rejected"
        })
        .eq("id", id);

    if (error) {
        console.log(error);
        return res.json({
            success: false
        });
    }

    res.json({
        success: true
    });

});
//----------------------------Database 3
app.get("/confirmation/:id", async (req, res) => {
    const { data } = await supabase
        .from("bookings")
        .select("*")
        .eq("id", req.params.id)
        .single();

    res.render("confirmation", { booking: data });
});
// ---------------- BOOKING STATUS CHECK ----------------

app.get("/booking-status/:id", async (req, res) => {

    const { data, error } = await supabase
        .from("bookings")
        .select("status")
        .eq("id", req.params.id)
        .single();

    if (error) {
        console.log(error);
        return res.send("Error fetching status");
    }

    res.json(data);
});
//////google setup 2
app.get("/api/me", async (req, res) => {

    const token = req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
        return res.status(401).json({
            success: false,
            message: "Not logged in"
        });
    }

    const {
        data: { user },
        error
    } = await supabase.auth.getUser(token);

    if (error || !user) {
        return res.status(401).json({
            success: false,
            message: "Invalid session"
        });
    }

    res.json({
        success: true,
        user
    });

});
//------------google login
app.get("/auth/google", async (req, res) => {

    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
            redirectTo: "https://waver-66rr.onrender.com/service"
        }
    });

    if (error) {
        console.log(error);
        return res.send("Google Login Failed");
    }

    res.redirect(data.url);

});
//barber dashboard
app.get("/barber-dashboard", async (req, res) => {

    const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .eq("status", "pending");

    if (error) {
        console.log(error);
        return res.send("Error");
    }

    res.render("barber-dashboard", {
        bookings: data
    });

});
//barber booking pending 
app.get("/pending-bookings", async (req, res) => {

    const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .eq("status", "pending");

    if (error) {
        console.log(error);
        return res.json([]);
    }

    res.json(data);

});
//barber login
app.get("/barber-login", (req, res) => {
    res.render("barber-login");
});

// ---------------- BOOKING HISTORY ----------------

app.get("/booking-history", async (req, res) => {

    const token = req.headers.authorization?.replace("Bearer ", "");

req.query.token;
    if (!token) {
        return res.send("Login required");
    }


    const {
        data: { user },
        error: userError
    } = await supabase.auth.getUser(token);


    if (userError || !user) {
        return res.send("Invalid User");
    }


    const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });


    if (error) {
        console.log(error);
        return res.send("Error fetching bookings");
    }


    res.render("booking-history", {
        bookings: data
    });

});
// ---------------- SERVER ----------------

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {

    console.log(`🚀 Waver Running on Port ${PORT}`);

});