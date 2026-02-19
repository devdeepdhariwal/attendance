import mongoose from 'mongoose';

const SessionSchema = new mongoose.Schema({
  name:           { type: String, required: true },
  active:         { type: Boolean, default: true },
  currentToken:   { type: String, required: true },
  tokenExpiresAt: { type: Number, required: true },
  // Short-lived submit tokens issued after a valid scan
  submitTokens: [{
    token:     { type: String },
    expiresAt: { type: Number },
    used:      { type: Boolean, default: false },
  }],
  createdAt: { type: Number, default: () => Date.now() },
});

export default mongoose.models.Session || mongoose.model('Session', SessionSchema);
