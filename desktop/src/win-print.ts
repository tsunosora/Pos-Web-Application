// Cetak RAW di Windows via PowerShell — tanpa native module.
// Mode "windows": P/Invoke winspool.drv WritePrinter (setara ctypes agent.py).
// Mode COM (usb/bluetooth): System.IO.Ports.SerialPort bawaan .NET.
import { spawn } from "node:child_process";

function runPowerShell(script: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const ps = spawn(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script],
      { windowsHide: true },
    );
    let out = "";
    let err = "";
    ps.stdout.on("data", (d) => (out += d.toString()));
    ps.stderr.on("data", (d) => (err += d.toString()));
    ps.on("error", reject);
    ps.on("close", (code) =>
      code === 0 ? resolve(out) : reject(new Error(err.trim() || `powershell exit ${code}`)),
    );
  });
}

// Escape string untuk disisipkan di dalam string berkutip-ganda PowerShell.
function psQuote(s: string): string {
  return s.replace(/`/g, "``").replace(/"/g, '`"').replace(/\$/g, "`$");
}

export async function listPrintersWindows(): Promise<{ name: string }[]> {
  const script =
    "try { Get-Printer | Select-Object -ExpandProperty Name } " +
    "catch { Get-CimInstance Win32_Printer | Select-Object -ExpandProperty Name }";
  const out = await runPowerShell(script);
  return out
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((name) => ({ name }));
}

// tmpFile: path file biner berisi byte ESC/POS. printerName: nama dari Get-Printer.
export async function printRawWindows(printerName: string, tmpFile: string): Promise<void> {
  const script = `
$src = @"
using System;
using System.Runtime.InteropServices;
public class RawPrinter {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  public struct DOCINFO {
    [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPWStr)] public string pDataType;
  }
  [DllImport("winspool.Drv", EntryPoint="OpenPrinterW", SetLastError=true, CharSet=CharSet.Unicode)]
  public static extern bool OpenPrinter(string src, out IntPtr h, IntPtr pd);
  [DllImport("winspool.Drv", EntryPoint="ClosePrinter", SetLastError=true)]
  public static extern bool ClosePrinter(IntPtr h);
  [DllImport("winspool.Drv", EntryPoint="StartDocPrinterW", SetLastError=true, CharSet=CharSet.Unicode)]
  public static extern bool StartDocPrinter(IntPtr h, int level, ref DOCINFO di);
  [DllImport("winspool.Drv", EntryPoint="EndDocPrinter", SetLastError=true)]
  public static extern bool EndDocPrinter(IntPtr h);
  [DllImport("winspool.Drv", EntryPoint="StartPagePrinter", SetLastError=true)]
  public static extern bool StartPagePrinter(IntPtr h);
  [DllImport("winspool.Drv", EntryPoint="EndPagePrinter", SetLastError=true)]
  public static extern bool EndPagePrinter(IntPtr h);
  [DllImport("winspool.Drv", EntryPoint="WritePrinter", SetLastError=true)]
  public static extern bool WritePrinter(IntPtr h, byte[] pBytes, int dwCount, out int dwWritten);
  public static void SendBytes(string printerName, byte[] bytes) {
    IntPtr h;
    if(!OpenPrinter(printerName, out h, IntPtr.Zero))
      throw new Exception("OpenPrinter gagal (" + Marshal.GetLastWin32Error() + ")");
    try {
      DOCINFO di = new DOCINFO(); di.pDocName = "POSPRO Struk"; di.pDataType = "RAW";
      if(!StartDocPrinter(h, 1, ref di))
        throw new Exception("StartDocPrinter gagal (" + Marshal.GetLastWin32Error() + ")");
      StartPagePrinter(h);
      int written;
      if(!WritePrinter(h, bytes, bytes.Length, out written))
        throw new Exception("WritePrinter gagal (" + Marshal.GetLastWin32Error() + ")");
      EndPagePrinter(h); EndDocPrinter(h);
    } finally { ClosePrinter(h); }
  }
}
"@
Add-Type -TypeDefinition $src -Language CSharp
$bytes = [System.IO.File]::ReadAllBytes("${psQuote(tmpFile)}")
[RawPrinter]::SendBytes("${psQuote(printerName)}", $bytes)
`;
  await runPowerShell(script);
}

// comPath: "COM5". Chunking dilakukan .NET secara internal; jeda kecil utk buffer.
export async function printSerialWindows(comPath: string, tmpFile: string): Promise<void> {
  const script = `
$port = New-Object System.IO.Ports.SerialPort "${psQuote(comPath)}",9600,None,8,One
$port.WriteTimeout = 8000
$port.Open()
try {
  $bytes = [System.IO.File]::ReadAllBytes("${psQuote(tmpFile)}")
  $i = 0
  while ($i -lt $bytes.Length) {
    $len = [Math]::Min(180, $bytes.Length - $i)
    $port.Write($bytes, $i, $len)
    Start-Sleep -Milliseconds 20
    $i += $len
  }
  Start-Sleep -Milliseconds 200
} finally { $port.Close() }
`;
  await runPowerShell(script);
}
