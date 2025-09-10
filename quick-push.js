const { exec } = require('child_process');

console.log('🚀 Pushing changes to GitHub...');

exec('git add .', (error, stdout, stderr) => {
  if (error) {
    console.error('Error adding files:', error);
    return;
  }
  
  exec('git commit -m "🚀 ENHANCED: After-hours scanner + Better ticker extraction + Market status indicators"', (error, stdout, stderr) => {
    if (error) {
      console.error('Error committing:', error);
      return;
    }
    
    exec('git push origin main', (error, stdout, stderr) => {
      if (error) {
        console.error('Error pushing:', error);
        return;
      }
      
      console.log('✅ Done! Your changes have been pushed to GitHub!');
      console.log('🔄 Vercel will automatically deploy the updates...');
    });
  });
});
