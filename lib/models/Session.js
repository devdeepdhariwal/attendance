import mongoose from 'mongoose';

const SessionSchema = new mongoose.Schema({
  name:    { type: String, required: true },
  active:  { type: Boolean, default: true }, // overall session

  // Check-In window
  checkinActive:        { type: Boolean, default: false },
  checkinToken:         { type: String,  default: null },
  checkinTokenExpiresAt:{ type: Number,  default: null },

  // Check-Out window
  checkoutActive:        { type: Boolean, default: false },
  checkoutToken:         { type: String,  default: null },
  checkoutTokenExpiresAt:{ type: Number,  default: null },

  // Submit tokens (issued after scan, valid 2 mins)
  submitTokens: [{
    token:     { type: String },
    type:      { type: String, enum: ['checkin', 'checkout'] },
    expiresAt: { type: Number },
    used:      { type: Boolean, default: false },
  }],

  createdAt: { type: Number, default: () => Date.now() },
});

export default mongoose.models.Session || mongoose.model('Session', SessionSchema);
