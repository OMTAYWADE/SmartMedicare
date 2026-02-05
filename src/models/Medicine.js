const mongoose = require('mongoose');

const medicineSchema = new mongoose.Schema({
  name: String,
  dosesRemaining: Number,
  frequency: String,
  reason: String,
  patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient' }
});

module.exports = mongoose.model('Medicine', medicineSchema);
