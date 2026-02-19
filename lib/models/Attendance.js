import mongoose from 'mongoose';

const AttendanceSchema = new mongoose.Schema({
  sessionId:   { type: String, required: true },
  name:        { type: String, required: true },
  email:       { type: String, required: true },
  rollNo:      { type: String, required: true },
  department:  { type: String, required: true },
  fingerprint: { type: String, required: true },
  checkIn:     { type: Number, default: null },
  checkOut:    { type: Number, default: null },
});

// One record per student per session
AttendanceSchema.index({ sessionId: 1, email: 1 }, { unique: true });

export default mongoose.models.Attendance || mongoose.model('Attendance', AttendanceSchema);
