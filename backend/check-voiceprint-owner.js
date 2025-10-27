const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/meeting-agent';

async function checkVoiceprints() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✓ Connected to MongoDB\n');
    
    const db = mongoose.connection.db;
    const voiceprints = await db.collection('voiceprints')
      .find({})
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray();
    
    console.log('Found ' + voiceprints.length + ' recent voiceprints:\n');
    
    voiceprints.forEach((vp, index) => {
      console.log((index + 1) + '. ' + vp.name);
      console.log('   _id: ' + vp._id);
      console.log('   speakerId: ' + vp.speakerId);
      console.log('   ownerId: ' + vp.ownerId);
      console.log('   sampleCount: ' + vp.sampleCount);
      console.log('   createdAt: ' + vp.createdAt);
      console.log('');
    });
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkVoiceprints();
