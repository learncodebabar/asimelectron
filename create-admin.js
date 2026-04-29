// backend/create-admin.js
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import User from './models/User.js';

dotenv.config();

const createAdmin = async () => {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected\n');
    
    // Delete existing admin
    await User.deleteOne({ username: 'admin' });
    console.log('✓ Removed existing admin\n');
    
    // Create new admin with pre-hashed password (to avoid pre-save middleware)
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    const admin = new User({
      username: 'admin',
      password: hashedPassword,
      name: 'System Administrator',
      email: 'admin@erp.com',
      role: 'admin',
      permissions: [],
      isActive: true
    });
    
    await admin.save();
    console.log('✓ Admin created successfully\n');
    
    // Verify
    const verify = await User.findOne({ username: 'admin' });
    const testMatch = await bcrypt.compare('admin123', verify.password);
    
    console.log('Verification:');
    console.log('  - Username:', verify.username);
    console.log('  - Password match:', testMatch ? '✓ Yes' : '✗ No');
    
    if (testMatch) {
      console.log('\n✅ SUCCESS! Login with: admin / admin123');
    }
    
    await mongoose.disconnect();
    
  } catch (error) {
    console.error('Error:', error);
  }
};

createAdmin();