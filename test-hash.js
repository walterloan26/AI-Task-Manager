// test-hash.js
import bcrypt from "bcryptjs"

async function testHash() {
  // Replace with the ACTUAL hash from your database
  const hashFromDB = '$2b$10$1r.09mlWtqYDS9zrr.74zeKsD/R2w3cP/vVoytM4pH1dk4r4LJgxO';
  
  console.log('Testing hash:', hashFromDB);
  
  // Test with password "123456"
  const match = await bcrypt.compare('123456', hashFromDB);
  console.log('✓ Password "123456" matches?', match);
  
  // Test with common variations
  const tests = ['123456', '123456 ', ' 123456', '12345', '1234567'];
  for (const test of tests) {
    const result = await bcrypt.compare(test, hashFromDB);
    console.log(`  "${test}": ${result}`);
  }
}

testHash().catch(console.error);