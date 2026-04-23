
$tempFile = [System.IO.Path]::GetTempFileName()
cmd /c "call `"C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat`" && set" > $tempFile

Get-Content $tempFile | ForEach-Object {
    if ($_ -match '^(.*?)=(.*)$') {
        $name = $matches[1]
        $value = $matches[2]
        if ($name -ne "Path") {
            [System.Environment]::SetEnvironmentVariable($name, $value, "Process")
        } else {
            # Append MSVC paths to existing Path
            $env:Path = "$value;$env:Path"
        }
    }
}
Remove-Item $tempFile

Write-Host "MSVC Environment Loaded. Launching Codra..."
cd apps/desktop
pnpm tauri dev
