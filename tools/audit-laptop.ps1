# ============================================================
#  AUDIT SCRIPT — Rulează pe laptopul VECHI (PowerShell 5+)
#  Output: audit_result.txt în același folder
# ============================================================

$outFile = Join-Path $PSScriptRoot "audit_result.txt"
$separator = "`n" + ("=" * 60) + "`n"

function Write-Section($title, $content) {
    $script:sections += "${separator}### $title${separator}$content`n"
}

$sections = ""

# ── 1. SYSTEM INFO ──────────────────────────────────────────
$os = (Get-CimInstance Win32_OperatingSystem).Caption
$arch = [System.Environment]::Is64BitOperatingSystem
Write-Section "SYSTEM" "OS: $os`nArch 64-bit: $arch"

# ── 2. PROGRAMMING LANGUAGES ────────────────────────────────
$langs = @()

# Python
try {
    $pyVer = & python --version 2>&1
    $pipVer = & pip --version 2>&1
    $langs += "Python: $pyVer  |  pip: $pipVer"
} catch { $langs += "Python: NOT FOUND" }

try {
    $py3Ver = & python3 --version 2>&1
    $langs += "Python3: $py3Ver"
} catch {}

# Node.js / npm / yarn / pnpm / bun
try { $langs += "Node.js: $(node --version 2>&1)" } catch { $langs += "Node.js: NOT FOUND" }
try { $langs += "npm: $(npm --version 2>&1)" } catch {}
try { $langs += "yarn: $(yarn --version 2>&1)" } catch {}
try { $langs += "pnpm: $(pnpm --version 2>&1)" } catch {}
try { $langs += "bun: $(bun --version 2>&1)" } catch {}

# Go
try { $langs += "Go: $(go version 2>&1)" } catch { $langs += "Go: NOT FOUND" }

# Rust
try { $langs += "Rust: $(rustc --version 2>&1)" } catch { $langs += "Rust: NOT FOUND" }
try { $langs += "Cargo: $(cargo --version 2>&1)" } catch {}

# Java / Kotlin / Gradle / Maven
try { $langs += "Java: $(java --version 2>&1 | Select-Object -First 1)" } catch { $langs += "Java: NOT FOUND" }
try { $langs += "Kotlin: $(kotlin -version 2>&1)" } catch {}
try { $langs += "Gradle: $(gradle --version 2>&1 | Select-Object -First 3 | Select-Object -Last 1)" } catch {}
try { $langs += "Maven: $(mvn --version 2>&1 | Select-Object -First 1)" } catch {}

# .NET / C#
try { $langs += "dotnet: $(dotnet --version 2>&1)" } catch { $langs += ".NET: NOT FOUND" }

# Ruby
try { $langs += "Ruby: $(ruby --version 2>&1)" } catch { $langs += "Ruby: NOT FOUND" }

# PHP
try { $langs += "PHP: $(php --version 2>&1 | Select-Object -First 1)" } catch { $langs += "PHP: NOT FOUND" }

# Lua
try { $langs += "Lua: $(lua -v 2>&1)" } catch {}

# R
try { $langs += "R: $(Rscript --version 2>&1)" } catch {}

# Zig
try { $langs += "Zig: $(zig version 2>&1)" } catch {}

# GCC / G++ / Clang
try { $langs += "GCC: $(gcc --version 2>&1 | Select-Object -First 1)" } catch {}
try { $langs += "G++: $(g++ --version 2>&1 | Select-Object -First 1)" } catch {}
try { $langs += "Clang: $(clang --version 2>&1 | Select-Object -First 1)" } catch {}

Write-Section "PROGRAMMING LANGUAGES" ($langs -join "`n")

# ── 3. PYTHON PACKAGES (pip) ────────────────────────────────
try {
    $pipList = & pip list --format=freeze 2>&1
    Write-Section "PYTHON PACKAGES (pip freeze)" $pipList
} catch {
    Write-Section "PYTHON PACKAGES" "pip not available"
}

# Conda environments
try {
    $condaEnvs = & conda env list 2>&1
    $condaPackages = & conda list 2>&1
    Write-Section "CONDA ENVIRONMENTS" $condaEnvs
    Write-Section "CONDA PACKAGES (base)" $condaPackages
} catch {}

# ── 4. NODE.JS GLOBAL PACKAGES ──────────────────────────────
try {
    $npmGlobal = & npm list -g --depth=0 2>&1
    Write-Section "NPM GLOBAL PACKAGES" $npmGlobal
} catch {
    Write-Section "NPM GLOBAL" "npm not available"
}

# ── 5. GO MODULES ───────────────────────────────────────────
try {
    $goPath = & go env GOPATH 2>&1
    $goModules = Get-ChildItem "$goPath\pkg\mod" -Directory -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Name
    Write-Section "GO MODULES (cached)" ($goModules -join "`n")
} catch {}

# ── 6. RUST / CARGO ─────────────────────────────────────────
try {
    $cargoInstalled = & cargo install --list 2>&1
    Write-Section "CARGO INSTALLED BINARIES" $cargoInstalled
} catch {}

# ── 7. DEV TOOLS & UTILITIES ────────────────────────────────
$tools = @()
$toolChecks = @(
    @("git",        "git --version"),
    @("docker",     "docker --version"),
    @("kubectl",    "kubectl version --client --short"),
    @("terraform",  "terraform --version"),
    @("aws-cli",    "aws --version"),
    @("gcloud",     "gcloud --version | Select-Object -First 1"),
    @("az-cli",     "az --version | Select-Object -First 1"),
    @("heroku",     "heroku --version"),
    @("vercel",     "vercel --version"),
    @("gh",         "gh --version"),
    @("curl",       "curl --version | Select-Object -First 1"),
    @("wget",       "wget --version | Select-Object -First 1"),
    @("make",       "make --version | Select-Object -First 1"),
    @("cmake",      "cmake --version"),
    @("ffmpeg",     "ffmpeg -version | Select-Object -First 1"),
    @("magick",     "magick --version | Select-Object -First 1"),
    @("7z",         "7z | Select-Object -First 2 | Select-Object -Last 1"),
    @("wsl",        "wsl --version | Select-Object -First 1"),
    @("sqlite3",    "sqlite3 --version"),
    @("psql",       "psql --version"),
    @("mysql",      "mysql --version"),
    @("mongosh",    "mongosh --version"),
    @("redis-cli",  "redis-cli --version")
)

foreach ($t in $toolChecks) {
    try {
        $result = Invoke-Expression $t[1] 2>&1
        $tools += "$($t[0]): $($result | Select-Object -First 1)"
    } catch {}
}

Write-Section "DEV TOOLS & UTILITIES" ($tools -join "`n")

# ── 8. PACKAGE MANAGERS ─────────────────────────────────────
$pkgMgrs = @()
try { $pkgMgrs += "choco: $(choco --version 2>&1)" } catch {}
try { $pkgMgrs += "scoop: $(scoop --version 2>&1 | Select-Object -First 1)" } catch {}
try { $pkgMgrs += "winget: $(winget --version 2>&1)" } catch {}

Write-Section "PACKAGE MANAGERS" ($pkgMgrs -join "`n")

# ── 9. SCOOP / CHOCO INSTALLED ──────────────────────────────
try {
    $scoopList = & scoop list 2>&1
    Write-Section "SCOOP INSTALLED" $scoopList
} catch {}

try {
    $chocoList = & choco list --local-only 2>&1
    Write-Section "CHOCOLATEY INSTALLED" $chocoList
} catch {}

try {
    $wingetList = & winget list 2>&1
    Write-Section "WINGET INSTALLED" $wingetList
} catch {}

# ── 10. VS CODE EXTENSIONS ──────────────────────────────────
try {
    $vscodeExt = & code --list-extensions --show-versions 2>&1
    Write-Section "VS CODE EXTENSIONS" ($vscodeExt -join "`n")
} catch {}

# ── 11. SSH KEYS ─────────────────────────────────────────────
$sshDir = "$env:USERPROFILE\.ssh"
if (Test-Path $sshDir) {
    $sshFiles = Get-ChildItem $sshDir -Name
    Write-Section "SSH KEYS (filenames only)" ($sshFiles -join "`n")
}

# ── 12. GIT CONFIG ───────────────────────────────────────────
try {
    $gitName = & git config --global user.name 2>&1
    $gitEmail = & git config --global user.email 2>&1
    $gitAliases = & git config --global --get-regexp alias 2>&1
    Write-Section "GIT CONFIG" "Name: $gitName`nEmail: $gitEmail`n`nAliases:`n$gitAliases"
} catch {}

# ── 13. ENVIRONMENT VARIABLES (dev-related) ──────────────────
$devEnvVars = [System.Environment]::GetEnvironmentVariables("User") |
    ForEach-Object { $_.GetEnumerator() } |
    Where-Object { $_.Key -match "PATH|HOME|GOPATH|JAVA_HOME|PYTHON|NODE|CARGO|RUST|DOTNET|ANDROID|GRADLE|MAVEN|NPM|YARN|BUN" } |
    ForEach-Object { "$($_.Key) = $($_.Value)" }
Write-Section "DEV ENVIRONMENT VARIABLES" ($devEnvVars -join "`n")

# ── 14. WSL DISTROS ──────────────────────────────────────────
try {
    $wslList = & wsl --list --verbose 2>&1
    Write-Section "WSL DISTRIBUTIONS" $wslList
} catch {}

# ── SAVE ─────────────────────────────────────────────────────
$header = @"
##############################################################
#  LAPTOP AUDIT — $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
#  Machine: $env:COMPUTERNAME
##############################################################
"@

($header + $sections) | Out-File -FilePath $outFile -Encoding utf8
Write-Host "`n✅  Audit complet! Rezultatul salvat in:`n   $outFile" -ForegroundColor Green
Write-Host "`nCopiaza fisierul 'audit_result.txt' si incarca-l in Claude." -ForegroundColor Cyan
