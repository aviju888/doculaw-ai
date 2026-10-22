const fs=require('node:fs');fs.cpSync('src/modern/lib/doculaw/samples','dist/modern/lib/doculaw/samples',{recursive:true,filter:p=>!p.endsWith('.ts')});
