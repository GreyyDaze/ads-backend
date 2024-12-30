import mongoose from 'mongoose';

const fbUserSchema = new mongoose.Schema({
    facebookId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    accessToken: { type: String, required: true },
});

export default mongoose.model('FBUser', fbUserSchema);
