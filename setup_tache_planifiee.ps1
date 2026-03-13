# ============================================================
# setup_tache_planifiee.ps1
# Crée une tâche planifiée Windows pour exécuter update_planning.py
# chaque jour à l'heure souhaitée.
#
# ▶ UTILISATION :
#   1. Modifie les variables $pythonPath, $scriptPath et $heure ci-dessous
#   2. Ouvre PowerShell en tant qu'Administrateur
#   3. Exécute : .\setup_tache_planifiee.ps1
# ============================================================

# -----------------------------
# CONFIG — À MODIFIER
# -----------------------------
$pythonPath = "C:\Users\tompo\AppData\Local\Programs\Python\Python312\python.exe"  # Chemin vers python.exe
$scriptPath = "C:\Users\tompo\OneDrive\Documents\Dev\python\helpdesk\python\update_planning.py"                          # Chemin vers update_planning.py
$heure      = "20:00"   # Heure d'exécution quotidienne (format HH:MM)
$nomTache   = "UpdatePlanning"

# -----------------------------
# CRÉATION DE LA TÂCHE
# -----------------------------
$action    = New-ScheduledTaskAction -Execute $pythonPath -Argument $scriptPath
$trigger   = New-ScheduledTaskTrigger -Daily -At $heure
$settings  = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Hours 1) `
                                          -StartWhenAvailable `

Register-ScheduledTask `
    -TaskName   $nomTache `
    -Action     $action `
    -Trigger    $trigger `
    -Settings   $settings `
    -RunLevel   Highest `
    -Force

Write-Host ""
Write-Host "✅ Tâche '$nomTache' créée avec succès !" -ForegroundColor Green
Write-Host "   → Exécution quotidienne à $heure"
Write-Host "   → Script : $scriptPath"
Write-Host ""
Write-Host "Tu peux la retrouver dans : Planificateur de tâches > Bibliothèque du Planificateur de tâches"