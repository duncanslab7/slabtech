$env:Path = [System.Environment]::GetEnvironmentVariable("Path","User") + ";" + [System.Environment]::GetEnvironmentVariable("Path","Machine")
Write-Host "PATH refreshed! Now try: slab" -ForegroundColor Green
