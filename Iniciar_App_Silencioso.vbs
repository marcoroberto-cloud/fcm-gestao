Set WshShell = CreateObject("WScript.Shell")
currentDir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = currentDir

' 1. Inicia o servidor Python/Uvicorn em segundo plano (invisível, sem janela de prompt)
WshShell.Run "cmd /c python -m uvicorn backend.server:app --host 0.0.0.0 --port 8000", 0, False

' 2. Aguarda 1.5s para o servidor subir
WScript.Sleep 1500

' 3. Abre o painel automaticamente
WshShell.Run "http://localhost:8000"
