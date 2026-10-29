# Clean start of the `kenna` emulator for a demo, then centre its window on the screen.
#   powershell -ExecutionPolicy Bypass -File Kenna\path-b\start_emulator.ps1 [-Gpu host|angle_indirect|swiftshader_indirect] [-NoWindow]
# Kills a stale/frozen emulator, removes lock files, boots fresh (no snapshot), waits for boot, centres the window.
param(
  [string]$Gpu = 'host',
  [switch]$NoWindow
)
$ErrorActionPreference = 'Continue'
$sdk = 'D:\AndroidSdk'
$env:ANDROID_SDK_ROOT = $sdk
$env:ANDROID_AVD_HOME = "$sdk\avd"
$adb = "$sdk\platform-tools\adb.exe"
$emu = "$sdk\emulator\emulator.exe"

Write-Host '1/4 stopping any old emulator / adb ...'
foreach ($n in 'emulator', 'qemu-system-x86_64', 'adb') { Get-Process $n -ErrorAction SilentlyContinue | Stop-Process -Force }
Remove-Item "$sdk\avd\kenna.avd\*.lock" -Recurse -Force -ErrorAction SilentlyContinue
Start-Sleep 2

Write-Host "2/4 launching (gpu=$Gpu) ..."
$args = @('-avd', 'kenna', '-no-snapshot-load', '-no-snapshot-save', '-no-audio', '-no-boot-anim', '-gpu', $Gpu)
if ($NoWindow) { $args += '-no-window' }
$log = "$sdk\emulator-run.log"
Start-Process -FilePath $emu -ArgumentList $args -RedirectStandardOutput $log -RedirectStandardError "$sdk\emulator-run.err" -WindowStyle Hidden | Out-Null

Write-Host '3/4 waiting for boot (about a minute) ...'
& $adb start-server | Out-Null
& $adb wait-for-device
$deadline = (Get-Date).AddMinutes(4)
do {
  Start-Sleep 3
  $b = (& $adb shell getprop sys.boot_completed 2>$null) -join ''
} until ($b.Trim() -eq '1' -or (Get-Date) -gt $deadline)
if ($b.Trim() -ne '1') { Write-Host 'Boot did not finish. Try -Gpu angle_indirect or swiftshader_indirect.'; exit 1 }

if (-not $NoWindow) {
  Write-Host '4/4 centring the window ...'
  Add-Type @'
using System; using System.Runtime.InteropServices;
public static class W {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr h, int x, int y, int w, int hh, bool r);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern int GetSystemMetrics(int i);
}
'@
  [W]::SetProcessDPIAware() | Out-Null
  Add-Type -AssemblyName System.Windows.Forms
  $wa = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea   # excludes the taskbar
  $h = [int]($wa.Height * 0.94)
  $w = [int]($h * 1080 / 2400) + 70                                # phone aspect + side toolbar
  $x = $wa.X + [int](($wa.Width - $w) / 2)
  $y = $wa.Y + [int](($wa.Height - $h) / 2)
  $win = $null
  for ($i = 0; $i -lt 20 -and -not $win; $i++) {
    $win = Get-Process | Where-Object { $_.MainWindowTitle -like 'Android Emulator*' } | Select-Object -First 1
    if (-not $win) { Start-Sleep 1 }
  }
  if ($win) {
    [W]::ShowWindow($win.MainWindowHandle, 9) | Out-Null          # restore if minimised
    [W]::MoveWindow($win.MainWindowHandle, $x, $y, $w, $h, $true) | Out-Null
    [W]::SetForegroundWindow($win.MainWindowHandle) | Out-Null
    Write-Host "window '$($win.MainWindowTitle)' placed at $x,$y size ${w}x$h"
  } else { Write-Host 'Emulator window not found (is it headless?).' }
}
& $adb devices
Write-Host 'Ready. Check: python Kenna\path-b\adb_capture.py devices'
