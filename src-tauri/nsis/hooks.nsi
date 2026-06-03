; ZipTag NSIS Installer Hooks — Context Menu Integration
; This file is referenced in tauri.conf.json: bundle.windows.nsis.installerHooks
;
; It adds an OPTIONAL, unchecked-by-default section that registers ZipTag
; as a right-click context menu entry in Windows Explorer.
;
; Registry paths used:
;   HKCR\*\shell\ZipTag.Compress        — right-click any file
;   HKCR\Directory\shell\ZipTag.Compress — right-click any folder
;   HKCR\<ext>\shell\ZipTag.Extract     — right-click archive files

; ── Declare the optional component page section ──────────────────────────────
!macro customInstall
  ${If} $ContextMenuChecked == 1
    Call InstallContextMenu
  ${EndIf}
!macroend

!macro customUnInstall
  Call un.RemoveContextMenu
!macroend

; ── Page: show the context menu checkbox ─────────────────────────────────────
Var ContextMenuChecked

Function ContextMenuPage
  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}

  ${NSD_CreateCheckbox} 0 30u 100% 10u "Add ZipTag to right-click context menu (recommended)"
  Pop $1
  ; Unchecked by default — user must opt in
  ${NSD_SetState} $1 ${BST_UNCHECKED}

  nsDialogs::Show

  ${NSD_GetState} $1 $ContextMenuChecked
FunctionEnd

Function InstallContextMenu
  ; ── Compress on any file ──
  WriteRegStr HKCR "*\shell\ZipTag.Compress" "" "Compress with ZipTag"
  WriteRegStr HKCR "*\shell\ZipTag.Compress" "Icon" "$INSTDIR\ziptag.exe,0"
  WriteRegStr HKCR "*\shell\ZipTag.Compress\command" "" '"$INSTDIR\ziptag.exe" --quick-compress "%1"'

  ; ── Compress on any folder ──
  WriteRegStr HKCR "Directory\shell\ZipTag.Compress" "" "Compress with ZipTag"
  WriteRegStr HKCR "Directory\shell\ZipTag.Compress" "Icon" "$INSTDIR\ziptag.exe,0"
  WriteRegStr HKCR "Directory\shell\ZipTag.Compress\command" "" '"$INSTDIR\ziptag.exe" --quick-compress "%1"'

  ; ── Extract on supported archive extensions ──
  !macro AddExtractEntry EXT
    WriteRegStr HKCR "${EXT}\shell\ZipTag.Extract" "" "Extract with ZipTag"
    WriteRegStr HKCR "${EXT}\shell\ZipTag.Extract" "Icon" "$INSTDIR\ziptag.exe,0"
    WriteRegStr HKCR "${EXT}\shell\ZipTag.Extract\command" "" '"$INSTDIR\ziptag.exe" --quick-extract "%1"'
  !macroend

  !insertmacro AddExtractEntry ".zip"
  !insertmacro AddExtractEntry ".7z"
  !insertmacro AddExtractEntry ".rar"
  !insertmacro AddExtractEntry ".tar"
  !insertmacro AddExtractEntry ".gz"
  !insertmacro AddExtractEntry ".xz"
  !insertmacro AddExtractEntry ".bz2"
  !insertmacro AddExtractEntry ".zst"
  !insertmacro AddExtractEntry ".iso"
FunctionEnd

Function un.RemoveContextMenu
  DeleteRegKey HKCR "*\shell\ZipTag.Compress"
  DeleteRegKey HKCR "Directory\shell\ZipTag.Compress"

  !macro RemoveExtractEntry EXT
    DeleteRegKey HKCR "${EXT}\shell\ZipTag.Extract"
  !macroend

  !insertmacro RemoveExtractEntry ".zip"
  !insertmacro RemoveExtractEntry ".7z"
  !insertmacro RemoveExtractEntry ".rar"
  !insertmacro RemoveExtractEntry ".tar"
  !insertmacro RemoveExtractEntry ".gz"
  !insertmacro RemoveExtractEntry ".xz"
  !insertmacro RemoveExtractEntry ".bz2"
  !insertmacro RemoveExtractEntry ".zst"
  !insertmacro RemoveExtractEntry ".iso"
FunctionEnd
