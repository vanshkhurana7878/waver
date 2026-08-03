const express = require("express");
const path = require("path");
const dotenv = require("dotenv");
dotenv.config();
const Razorpay = require("razorpay");
const session = require("express-session");
const cookieParser = require("cookie-parser");

const { Resend } = require("resend");
//------------fcm 
const { initializeApp, cert } = require("firebase-admin/app");
const { getMessaging } = require("firebase-admin/messaging");

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

initializeApp({
    credential: cert(serviceAccount)
});
//---razorpay
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});//-----

// dotenconfig
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
//customer saver
app.post("/save-customer", async (req, res) => {

    const { name, email, auth_id, avatar } = req.body;

    const { data: existingCustomer } = await supabase
        .from("customers")
        .select("id")
        .eq("email", email)
        .maybeSingle();

    if (!existingCustomer) {

        const { error } = await supabase
            .from("customers")
            .insert({
                
                name,
                email
                
            });

        if (error) {
            console.log(error);
            return res.status(500).json({ success: false });
        }
    }

    res.json({ success: true });

});
//-----------FCM TOKEN SAVE 
app.post("/save-fcm-token", async (req, res) => {

    const { email, fcm_token } = req.body;

    const { error } = await supabase
        .from("customers")
        .update({ fcm_token })
        .eq("email", email);

    if (error) {
        console.log(error);
        return res.status(500).json({
            success: false
        });
    }

    res.json({
        success: true
    });

});
//fcm mesagging testing 
app.post("/send-notification", async (req, res) => {

    const { title, body } = req.body;

    const { data: customers, error } = await supabase
        .from("customers")
        .select("fcm_token")
        .not("fcm_token", "is", null);

    if (error) {
        console.log(error);
        return res.status(500).json({ success: false });
    }

    const tokens = customers
        .map(c => c.fcm_token)
        .filter(Boolean);

    if (tokens.length === 0) {
        return res.json({
            success: false,
            message: "No FCM tokens found"
        });
    }

    const message = {
        notification: {
            title,
            body
        },
        tokens
    };

    const response = await getMessaging().sendEachForMulticast(message);

    res.json({
        success: true,
        sent: response.successCount,
        failed: response.failureCount
    });

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
console.log("Inserted booking:", data);
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

    const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .eq("id", req.params.id)
        .single();


    if(error || !data){

        console.log("Confirmation Error:", error);
        return res.send("Booking not found");

    }


    res.render("confirmation", { 
        booking: data 
    });

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
//----------admin panel
app.get("/admin", async (req, res) => {

    if (!req.session.isAdmin) {
        return res.redirect("/admin-login");
    }

    const { data: bookings } = await supabase
        .from("bookings")
        .select("*")
        .order("created_at", { ascending: false });

    const { count: totalUsers } = await supabase
        .from("customers")
        .select("*", { count: "exact", head: true })
        

    const { count: totalBarbers } = await supabase
        .from("user")
        .select("*", { count: "exact", head: true })
        .eq("role", "barber");

    let revenue = 0;

    bookings.forEach(b => {
        if (b.status === "confirmed") {
            revenue += Number(b.total_price);
        }
    });

    res.render("admin", {
        bookings,
        totalUsers,
        totalBarbers,
        totalBookings: bookings.length,
        revenue
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
//----terms
app.get("/term", (req, res) => {
    res.render("term");
});
//-----------contact us
app.get("/contactus", (req, res) => {
    res.render("contactus");
});

//--------admin login
app.get("/admin-login", (req, res) => {
    res.render("admin-login");
});
app.post("/admin-login", (req, res) => {

    const { email, password } = req.body;

    if (
        email === process.env.ADMIN_EMAIL &&
        password === process.env.ADMIN_PASSWORD
    ) {

        req.session.isAdmin = true;

        return res.json({
            success: true
        });

    }

    res.json({
        success: false
    });

});
// ---------------- BOOKING HISTORY ----------------

app.get("/booking-history", async (req, res) => {

console.log("QUERY TOKEN:", req.query.token);

const token =
    req.headers.authorization?.replace("Bearer ", "")
    ||
    req.query.token;


console.log("FINAL TOKEN:", token);


if (!token) {
    return res.send("Login required");
}


const {
    data: { user },
    error: userError
} = await supabase.auth.getUser(token);


if (userError || !user) {
    console.log(userError);
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
    bookings:data
});

});
// admin users
app.get("/admin/users", async (req,res)=>{

    if(!req.session.isAdmin){
        return res.redirect("/admin-login");
    }


    const { data, error } = await supabase
        .from("customers")
        .select("*")
        
        .order("created_at",{ascending:false});


    if(error){
        console.log(error);
        return res.send("Error loading users");
    }


    res.render("admin-users",{
        users:data
    });

});
//admin barbers
app.get("/admin/barbers", async (req, res) => {

    if (!req.session.isAdmin) {
        return res.redirect("/admin-login");
    }

    const { data, error } = await supabase
        .from("user")
        .select("*")
        .eq("role", "barber")
        .order("created_at", { ascending: false });

    if (error) {
        console.log(error);
        return res.send("Error loading barbers");
    }

    res.render("admin-barbers", {
        barbers: data
    });

});

app.get("/admin/bookings", (req, res) => {
    if (!req.session.isAdmin) {
        return res.redirect("/admin-login");
    }

    res.render("admin-bookings");
});
//revenue graph
app.get("/admin/revenue", async (req, res) => {

    if (!req.session.isAdmin) {
        return res.redirect("/admin-login");
    }

    const { data } = await supabase
        .from("bookings")
        .select("*");

    res.render("admin-revenue", {
        bookings: data
    });

});
//--------settings
app.get("/admin/settings", (req, res) => {
    if (!req.session.isAdmin) {
        return res.redirect("/admin-login");
    }

    res.render("admin-settings");
});
//database admin ----
app.get("/admin/database", async (req, res) => {

    if (!req.session.isAdmin) {
        return res.redirect("/admin-login");
    }

    const { count: customers } = await supabase
        .from("customers")
        .select("*", { count: "exact", head: true });
const { count: barbers } = await supabase
    .from("user")
    .select("*", { count: "exact", head: true })
    .eq("role", "barber");
    res.render("admin-database", {
        customers,
        barbers
    });

});
//------------admin-barber management
app.get("/admin/barber-management", async (req, res) => {

    if (!req.session.isAdmin) {
        return res.redirect("/admin-login");
    }

    const { data: barbers, error } = await supabase
        .from("user")
        .select("*")
        .eq("role", "barber")
        .order("id");

    if (error) {
        console.log(error);
        return res.send("Error");
    }

    res.render("admin-barber-management", {
        barbers
    });

});
//--------------add barber 
app.post("/add-barber", async (req, res) => {

    if (!req.session.isAdmin) {
        return res.redirect("/admin-login");
    }

    const { name, email, phone } = req.body;

    const { error } = await supabase
        .from("user")
        .insert([
            {
                name,
                email,
                phone,
                role: "barber"
            }
        ]);

    if (error) {
        console.log(error);
        return res.send("Failed to add barber");
    }

    res.redirect("/admin/barber-management");

});
// ---------------- SERVER ----------------

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {

    console.log(`🚀 Waver Running on Port ${PORT}`);

});