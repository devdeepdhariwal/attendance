import mongoose from 'mongoose';

const SessionSchema = new mongoose.Schema({
  name:           { type: String, required: true },
  active:         { type: Boolean, default: true },
  currentToken:   { type: String, required: true },
  tokenExpiresAt: { type: Number, required: true },
  venueLat:       { type: Number, default: null },
  venueLng:       { type: Number, default: null },
  createdAt:      { type: Number, default: () => Date.now() },
});

export default mongoose.models.Session || mongoose.model('Session', SessionSchema);
