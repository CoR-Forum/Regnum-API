const bcrypt = require('bcrypt');

const password = 'jwa2wjv.JHC*mcn6bmd';
const hash = '$2a$08$hUE79D3vPmKIEXLm0dmZBeOZNl9f6F0KIiNeRCiqeYF.8ivzr0LJO';

console.log('Password:', password);
console.log('Hash:', hash);

// Step 1: Compare the password with the existing hash
bcrypt.compare(password, hash, (err, result) => {
  if (err) {
    console.error('Error comparing password:', err);
  } else {
    console.log('Password match:', result);

    if (!result) {
      console.log('Rehashing the password for verification...');

      // Step 2: Rehash the password and log the new hash
      bcrypt.hash(password, 8, (hashErr, newHash) => {
        if (hashErr) {
          console.error('Error generating new hash:', hashErr);
        } else {
          console.log('Generated New Hash:', newHash);

          // Step 3: Compare the rehashed password with itself for verification
          bcrypt.compare(password, newHash, (compareErr, newResult) => {
            if (compareErr) {
              console.error('Error comparing rehashed password:', compareErr);
            } else {
              console.log('Password matches with newly generated hash:', newResult);
            }
          });
        }
      });
    }
  }
});
