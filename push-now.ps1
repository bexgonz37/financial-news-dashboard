Write-Host "🚀 Pushing changes to GitHub..." -ForegroundColor Green
git add .
git commit -m "🚀 ENHANCED: After-hours scanner + Better ticker extraction + Market status indicators"
git push origin main
Write-Host "✅ Done! Your changes have been pushed!" -ForegroundColor Green
Write-Host "🔄 Vercel will automatically deploy the updates..." -ForegroundColor Yellow
Read-Host "Press Enter to continue"
