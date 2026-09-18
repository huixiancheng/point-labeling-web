Option Explicit

Dim fso, shell, packageRoot, packageParent, exePath, assetsPath, webRoot, logPath, dataRoot, port, profile, openBrowser
Dim i, arg, command
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
packageRoot = fso.GetParentFolderName(WScript.ScriptFullName)
packageParent = fso.GetParentFolderName(packageRoot)
exePath = fso.BuildPath(packageRoot, "point_labeler_server.exe")
assetsPath = fso.BuildPath(packageRoot, "assets")
webRoot = fso.BuildPath(packageRoot, "web")
logPath = fso.BuildPath(fso.BuildPath(packageParent, "logs"), "server.log")
dataRoot = fso.BuildPath(packageParent, "clips")
port = "8090"
profile = "auto"
openBrowser = False

i = 0
Do While i < WScript.Arguments.Count
  arg = LCase(WScript.Arguments(i))
  If arg = "-dataroot" Then
    If i + 1 >= WScript.Arguments.Count Then WScript.Quit 2
    dataRoot = WScript.Arguments(i + 1): i = i + 2
  ElseIf arg = "-port" Then
    If i + 1 >= WScript.Arguments.Count Then WScript.Quit 2
    port = WScript.Arguments(i + 1): i = i + 2
  ElseIf arg = "-profile" Then
    If i + 1 >= WScript.Arguments.Count Then WScript.Quit 2
    profile = WScript.Arguments(i + 1): i = i + 2
  ElseIf arg = "-openbrowser" Then
    openBrowser = True: i = i + 1
  ElseIf arg = "-nobrowser" Then
    openBrowser = False: i = i + 1
  Else
    WScript.Quit 2
  End If
Loop

If Not fso.FileExists(exePath) Then WScript.Quit 2
If Not fso.FolderExists(assetsPath) Then WScript.Quit 2
If Not fso.FolderExists(webRoot) Then WScript.Quit 2
If Not fso.FolderExists(dataRoot) Then fso.CreateFolder(dataRoot)
If Not fso.FolderExists(fso.GetParentFolderName(logPath)) Then fso.CreateFolder(fso.GetParentFolderName(logPath))

command = Quote(exePath) _
  & " --root " & Quote(dataRoot) _
  & " --assets " & Quote(assetsPath) _
  & " --web-root " & Quote(webRoot) _
  & " --log " & Quote(logPath) _
  & " --host 127.0.0.1 --port " & Quote(port)
shell.Run command, 0, False
WScript.Quit 0

Function Quote(value)
  Quote = Chr(34) & value & Chr(34)
End Function
