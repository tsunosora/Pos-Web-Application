' ── Launcher agent printer TANPA JENDELA ────────────────────────────────
' Menjalankan agent-hidden.bat di folder yang sama, benar-benar tersembunyi.
'
' Cara pakai auto-run saat Windows nyala:
'   1) Isi dulu URL/TOKEN/COM di agent-hidden.bat.
'   2) Tes: dobel-klik file ini — tak ada jendela muncul = benar.
'      Cek Task Manager > Details ada proses python.exe.
'   3) Win+R -> shell:startup -> taruh SHORTCUT file ini di folder itu
'      (buat shortcut: klik-kanan run-hidden.vbs > Create shortcut).
'      Jangan pindahkan .vbs aslinya — cukup shortcut-nya, biar path ke
'      agent.py tetap benar.
Dim fso, sh, folder
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh  = CreateObject("WScript.Shell")
folder  = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = folder
' arg2 = 0 -> jendela disembunyikan; arg3 = False -> tak menunggu selesai
sh.Run """" & folder & "\agent-hidden.bat""", 0, False
