const mongoose = require('mongoose');

const patientSchema = new mongoose.Schema({
  patientCode: {
  type: String,
  unique: true,
  default: () => 'PAT-' + Math.random().toString(36).slice(2, 8).toUpperCase()
},
  name: String,
  age: Number,
  gender: String,
  bloodGroup: String,
  phone: String,
  hospital: String,
  medicines: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Medicine' }],
  schedules: [{ date: Date, type: String, status: String }],
  notifications: [{ message: String, date: Date }],
  vitals: {
    bp: String,
    sugar: String,
    weight: String,
    temperature: String
  },
  assignedDoctor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  image: String
});


module.exports = mongoose.model('Patient', patientSchema);
