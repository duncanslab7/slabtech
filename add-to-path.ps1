$slabPath = "C:\Users\dunca\OneDrive\Documents\Code_Projects\SLAB"
$userPath = [Environment]::GetEnvironmentVariable("PATH", "User")

if ($userPath -notlike "*$slabPath*") {
    [Environment]::SetEnvironmentVariable("PATH", "$userPath;$slabPath", "User")
    Write-Host "SUCCESS! SLAB directory added to PATH." -ForegroundColor Green
    Write-Host "Please close and reopen your terminal, then type 'slab' from anywhere!" -ForegroundColor Yellow
} else {
    Write-Host "SLAB directory is already in your PATH!" -ForegroundColor Green
}
