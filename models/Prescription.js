const mongoose = require('mongoose');

const prescriptionSchema = new mongoose.Schema({
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient' },
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    
    medicines: [{
        name: String,
        dosage: Number,
        days: Number
    }],

    notes: String,
    date: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Prescription', prescriptionSchema);