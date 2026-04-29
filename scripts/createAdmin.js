// backend/scripts/createAdmin.js
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

const createAdminUser = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Delete existing admin if any
    await User.deleteOne({ username: 'admin' });
    console.log('Removed existing admin user');

    // Create new admin user
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('admin123', salt);
    
    const adminUser = new User({
      username: 'admin',
      password: hashedPassword,
      name: 'System Administrator',
      email: 'admin@erp.com',
      role: 'admin',
      permissions: [],
      isActive: true
    });
    
    await adminUser.save();
    console.log('✅ Admin user created successfully!');
    console.log('   Username: admin');
    console.log('   Password: admin123');
    
    // Verify the user
    const verifyUser = await User.findOne({ username: 'admin' });
    console.log('User found in DB:', verifyUser ? 'Yes' : 'No');
    console.log('User role:', verifyUser?.role);
    
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

createAdminUser();