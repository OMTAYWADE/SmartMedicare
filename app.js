/****************************************************
 * SmartMedicare - Main Application File (app.js)
 * Author: SmartMedicare
 * Description:
 *  - Express server setup
 *  - MongoDB connection
 *  - Authentication (Passport.js)
 *  - Sessions, Flash messages
 *  - Routes & middleware
 ****************************************************/

// Load environment variables from .env file
require('dotenv').config();

// Core dependencies
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require('passport');
const flash = require('connect-flash');

// Passport configuration (local strategy)
require('./config/passport');

// Mongoose models
const User = require('./models/User');
const Patient = require('./models/Patient');
const Medicine = require('./models/Medicine');
const Prescription = require('./models/Prescription');

// Initialize express app
const app = express();

/* --------------------------------------------------
   DATABASE CONNECTION
-------------------------------------------------- */
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err));


/* --------------------------------------------------
   APP & MIDDLEWARE SETUP
-------------------------------------------------- */

// Set EJS as the view engine
const path = require("path");

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "../views"));

// Serve static files (CSS, JS, Images)
// IMPORTANT: All static assets must be inside "public" folder
app.use(express.static('public'));

// Parse form data (POST requests)
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET, // session encryption key
    resave: false,                      // do not save unchanged sessions
    saveUninitialized: false            // do not create empty sessions
  })
);

// Initialize Passport authentication
app.use(passport.initialize());
app.use(passport.session());

// Flash messages (for login/signup errors)
app.use(flash());


/* --------------------------------------------------
   GLOBAL VARIABLES (Available in all EJS files)
-------------------------------------------------- */
app.use((req, res, next) => {
  res.locals.user = req.user || null;      // logged-in user
  res.locals.message = req.flash('error'); // error messages
  next();
});


/* --------------------------------------------------
   AUTHENTICATION MIDDLEWARE
-------------------------------------------------- */
const isAuth = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/login');
};

/* --------------------------------------------------
   ROLE-BASED ACCESS CONTROL
-------------------------------------------------- */

// Allow access only to doctors
const isDoctor = (req, res, next) => {
  if (req.user && req.user.role === 'doctor') {
    return next();
  }
  return res.status(403).send('Access Denied: Doctors only');
};


/* --------------------------------------------------
   ROUTES
-------------------------------------------------- */

// Home page
app.get('/', (req, res) => {
  res.render('home');
});

// dashboard
app.get('/dashboard' , isAuth ,(req, res) => {
  res.render("dashboard", {user: req.user});
});

// Health-tips
app.get('/healthTips', (req, res) => {
  res.render('healthTips');
});

// Login page
app.get('/login', (req, res) => {
  res.render('login');
});

// Signup page
app.get('/signup', (req, res) => {
  res.render('signup');
});

// Login handler
app.post(
  '/login',
  passport.authenticate('local', {
    failureRedirect: '/login',
    failureFlash: true
  }),
  (req, res) => {
    if (req.user.role === 'doctor') {
      return res.redirect('/doctor/dashboard');
    }

    if (req.user.role === 'patient') {
      console.log("Redirecting to patient ID:", req.user.patient);
      console.log("Type:", typeof req.user.patient);
      return res.redirect(`/patient/${req.user.patient}`);
    }

    res.redirect('/dashboard');
  }
);

// Signup handler
app.post('/signup', async (req, res) => {
  try {
    const { email, password, role, name, patientId } = req.body;

    // 1️⃣ Check email
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      req.flash('error', 'Email already registered');
      return res.redirect('/signup');
    }

    let patient;

    // 2️⃣ Patient logic
    if (role === 'patient') {
      const existingPatient = await Patient.findOne({ patientCode: patientId });
      if (existingPatient) {
        req.flash('error', 'Patient ID already exists');
        return res.redirect('/signup');
      }

      patient = await Patient.create({
        name,
        patientCode: patientId
      });
    } else {
      patient = await Patient.findOne({ patientCode: patientId });
      if (!patient) {
        req.flash('error', 'Patient ID not found');
        return res.redirect('/signup');
      }
    }

    // 3️⃣ Create user ONCE
    const user = new User({
      email,
      password,
      role,
      patient: patient._id
    });

    await user.save(); // password hashes here

    res.redirect('/login');

  } catch (err) {
    console.error(err);
    req.flash('error', 'Signup failed');
    res.redirect('/signup');
  }
});

// Dashboard (protected)
app.get('/patient/:id', isAuth, async (req, res) => {
  if (!req.params.id || req.params.id === 'undefined') {
    return res.redirect('/dashboard');
  }

  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).send("Invalid patient ID");
  }

  const patient = await Patient.findById(req.params.id);

  if (!patient) {
    return res.status(404).send('Patient not found');
  }

  res.render('patientView', { patient });
});

/* --------------------------------------------------
   DOCTOR DASHBOARD (Protected + Role-based)
-------------------------------------------------- */

app.get('/doctor/dashboard', isAuth, isDoctor, async (req, res) => {
  try {
    // Fetch the patient linked to this doctor
    const patientId = req.user.patient._id || req.user.patient;
    const patient = await Patient.findById(patientId);
    
    if (!patient) {
      return res.status(404).send('Patient not found');
    }
    // assignedDoctor id by patient means patient ki id hogi
     if (!patient.assignedDoctor) {
      patient.assignedDoctor = req.user._id;
      await patient.save();
      console.log("✅ Patient auto-assigned to doctor");
    }
    const medicines = await Medicine.find({ _id: { $in: patient.medicines } });

    // Render professional doctor panel
    res.render('doctorView', { patient, medicines });

  } catch (error) {
    console.error('Doctor dashboard error:', error);
    res.status(500).send('Server Error');
  }
});

// Medicine view page
app.get('/patient/:id/medicines', isAuth, async (req, res) => {
  const patient = await Patient.findById(req.params.id);
  const medicines = await Medicine.find({ patient: patient._id });
  if (!patient) {
    return res.status(404).send('Patient not found');
  }
  res.render('medicineView', { patient, medicines });
});

// Doctor's view of patient's medicines
app.get('/doctor/patient/:id/medicines', isAuth, isDoctor, async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id);
    const medicines = await Medicine.find({ patient: patient._id }).sort({id: -1});

    if (!patient) {
      return res.status(404).send('Patient not found');
    }

    res.render('medicineView', { patient, medicines });
  } catch (error) {
    console.error('Medicine view error:', error);
    res.status(500).send('Server Error');
  }
});

// post new medicine (doctor)
app.post('/doctor/patient/:id/medicines', isAuth, isDoctor, async (req, res) => {
  try {
    const newMed = new Medicine({
      name: req.body.name,
      dosesRemaining: req.body.dosesRemaining,
      frequency: req.body.frequency,
      reason: req.body.reason,
      patient: req.params.id
    });
    await newMed.save();

    res.redirect(`/doctor/patient/${req.params.id}/medicines`);
  } catch (error) {
    console.error('Add medicine error:', error);
    res.status(500).send('Server Error');
  }
});

// update and delete medicines
app.post('/doctor/medicine/:id/update', isAuth, isDoctor, async (req, res) => {
  try {
    const med = await Medicine.findById(req.params.id);
    
    med.name = req.body.name;
    med.dosesRemaining = req.body.dosesRemaining;
    med.frequency = req.body.frequency;
    med.reason = req.body.reason;

    await med.save();

    res.redirect('/doctor/patient/${req.params.id}/medicines');
  }
  catch(error) {
    console.log(error);
    res.status(500).send("Failure to update Medicine")
  }
});

app.post('/doctor/medicine/:id/delete', isAuth, isDoctor, async (req, res) => {
  try {
    const med = await Medicine.findByIdAndDelete(req.params.id);
    res.redirect('/doctor/patient/${req.params.id}/medicines');
  } catch (err) {
    console.log(err);
    res.status(500).send(" Failure to Delete medicines");
  }
});

// Prescriptions 
app.get('/doctor/patient/:id/prescriptions', isAuth, isDoctor, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.send("InValid patient Id")
    }

    // Security: only assigned doctor can do
    const patient = await Patient.findById(req.params.id);
    if (!patient) return res.send("Patient not found");

    // ✅ SECURITY: doctor owns this patient
    if (String(req.user.patient) !== String(patient._id)) {
      return res.send("Unauthorized");
    }

    const prescriptions = await Prescription.find({ patient: patient._id }).sort({ date: -1 })
    res.render('doctorPrescriptions', { patient, prescriptions })
  }
  catch (error) {
    console.log(error);
    res.status(500).send("Error loading Precriptions");
  }
});

// Save prescription
app.post('/doctor/patient/:id/prescriptions', isAuth, isDoctor, async (req, res) => {
  try {
    const newPrescription = new Prescription({
      patient: req.params.id,
      doctor: req.user._id,
      medicines: req.body.medicines,
      notes: req.body.notes,
    });
    await newPrescription.save();
    res.redirect(`/doctor/patient/${req.params.id}/prescriptions`)
  }
  catch (err) {
    console.log(err);
    res.status(500).send("Failed to save Prescription");
  }
});

app.get('/doctor/patient/:id/ai-insights', isAuth, isDoctor, async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id);

    if (!patient) return res.send("Patient not found");

    // SECURITY (your current design: doctor has only one patient)
    if (String(req.user.patient) !== String(patient._id)) {
      return res.send("Unauthorized");
    }

    const prescriptions = await Prescription.find({ patient: patient._id });

    // 🧠 SIMPLE AI LOGIC (TEST VERSION)
    let score = 100;
    let risks = [];
    let suggestions = [];

    // Safe checks
    const bp = patient.vitals?.bp || "";
    const sugar = parseInt(patient.vitals?.sugar || "0");

    if (bp.includes("140") || bp.includes("150")) {
      risks.push("High Blood Pressure");
      score -= 20;
    }

    if (sugar > 140) {
      risks.push("High Blood Sugar");
      score -= 20;
    }

    if (prescriptions.length > 3) {
      risks.push("Long-term medication dependency");
      score -= 10;
    }

    if (risks.length === 0) {
      risks.push("No major risks detected");
    }

    if (score < 80) suggestions.push("Lifestyle improvement recommended");
    if (risks.includes("High Blood Pressure")) suggestions.push("Reduce salt intake");
    if (risks.includes("High Blood Sugar")) suggestions.push("Avoid sugar and carbs");

    if (suggestions.length === 0) suggestions.push("Keep following current treatment");

    // DEBUG LOG
    console.log("AI DATA:", { score, risks, suggestions });

    res.render("aiInsights", {
      patient,
      score,
      risks,
      suggestions
    });

  } catch (err) {
    console.error("AI ERROR:", err);
    res.status(500).send("AI analysis failed");
  }
});


// Logout
app.get('/logout', (req, res) => {
  req.logout(() => {
    res.redirect('/');
  });
});

// About
app.get('/about', (req, res) => {
  res.render('about');
});

// Contact
app.get('/contact', (req, res) => {
  res.render('contact');
});

// Appointment
app.get('/appointment', (req, res) => {
  res.render('appointment');
});

/* --------------------------------------------------
   SERVER START
-------------------------------------------------- */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`✅ SmartMedicare running on port ${PORT}`);
});
