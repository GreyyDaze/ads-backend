import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  googleId: { type: String, required: true },
  email: { type: String, required: true },
  accessToken: { type: String},
  refreshToken: { type: String },
});

const User = mongoose.model("User", UserSchema);

export default User;
