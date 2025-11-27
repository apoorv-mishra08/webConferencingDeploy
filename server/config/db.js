import mongoose from 'mongoose';

export async function connectDB() {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/ly_conference';
    
    await mongoose.connect(mongoUri);
    
    console.log('✅ MongoDB Connected:', mongoUri);
    return true;
  } catch (error) {
    console.error('❌ MongoDB Connection Failed:', error.message);
    console.log('⚠️ Running in in-memory mode (data will not persist)');
    return false;
  }
}

export async function disconnectDB() {
  try {
    await mongoose.disconnect();
    console.log('✅ MongoDB Disconnected');
  } catch (error) {
    console.error('❌ Error disconnecting from MongoDB:', error.message);
  }
}
