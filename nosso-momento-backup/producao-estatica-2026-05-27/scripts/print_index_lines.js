const fs = require('fs');
const lines = fs.readFileSync('functions/index.js','utf8').split('\n');
lines.forEach((l,i)=>{
  console.log((i+1)+': '+l);
});
