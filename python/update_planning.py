from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
import json
import time
import re
import os
from datetime import datetime

# -----------------------------
# CONFIG
# -----------------------------
URL = "https://planning-helpdesk.web.app/login"
EMAIL = "tom.poyeau.ext@groupe-mma.fr"
PASSWORD = "Plutot2023"

GITHUB_TOKEN = "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"       # Ton Personal Access Token GitHub
GITHUB_REPO_PATH = r"C:\Users\tompo\OneDrive\Documents\Dev\python\helpdesk"  # Chemin local vers ton dépôt GitHub

JSON_FILE = "planning.json"

# -----------------------------
# CHARGEMENT DU JSON EXISTANT
# -----------------------------
if not os.path.exists(JSON_FILE):
    print(f"[ERREUR] Le fichier '{JSON_FILE}' est introuvable. Lance d'abord extract.py.")
    exit(1)

with open(JSON_FILE, "r", encoding="utf-8") as f:
    planning = json.load(f)

# -----------------------------
# RECHERCHE DE LA DATE LA PLUS RÉCENTE
# -----------------------------
toutes_les_dates = [
    date
    for collaborateur in planning.values()
    for date in collaborateur.keys()
]

if not toutes_les_dates:
    print("[ERREUR] Le fichier JSON ne contient aucune date. Vérifie son contenu.")
    exit(1)

date_max = max(toutes_les_dates)  # format 'YYYY-MM-DD'
DATE_LIMITE = date_max            # On s'arrêtera quand on retrouve cette date

print(f"[INFO] Date la plus récente dans le JSON : {date_max}")
print(f"[INFO] Le scraping s'arrêtera à cette date (non incluse, données déjà présentes).")

# -----------------------------
# Conversion mois FR → numéro
# -----------------------------
mois_fr = {
    "Janvier": 1, "Février": 2, "Mars": 3, "Avril": 4,
    "Mai": 5, "Juin": 6, "Juillet": 7, "Août": 8,
    "Septembre": 9, "Octobre": 10, "Novembre": 11, "Décembre": 12
}

def parse_date_fr(text):
    """
    Convertit un header du type 'Jeudi 23 Janvier 2026'
    en '2026-01-23'
    """
    parts = text.split()
    jour = int(parts[1])
    mois = mois_fr[parts[2]]
    annee = int(parts[3])
    return f"{annee:04d}-{mois:02d}-{jour:02d}"

# -----------------------------
# SELENIUM
# -----------------------------
options = webdriver.ChromeOptions()
options.add_argument("--headless")
options.add_argument("--disable-gpu")
options.add_argument("--window-size=1920,1080")

driver = webdriver.Chrome(
    service=Service(ChromeDriverManager().install()),
    options=options
)

driver.get(URL)

# -----------------------------
# LOGIN
# -----------------------------
driver.find_element(By.XPATH, "//input[@type='email']").send_keys(EMAIL)
pwd = driver.find_element(By.XPATH, "//input[@type='password']")
pwd.send_keys(PASSWORD)
pwd.send_keys(Keys.ENTER)

time.sleep(5)

regex_nom = r"^[A-ZÉÈÊÎÔÛÄËÏÖÜ][A-Za-zÀ-ÖØ-öø-ÿ-]+ [A-ZÉÈÊÎÔÛÄËÏÖÜ][A-Za-zÀ-ÖØ-öø-ÿ-]+$"
nouvelles_entrees = 0  # Compteur pour le bilan final

def scrape_semaine():
    """
    Scrape la semaine affichée et fusionne les nouvelles données
    dans le dict global 'planning'.
    - Si la date existe déjà → on ne l'écrase PAS (données déjà à jour).
    - Si la date est nouvelle → on l'ajoute.
    Retourne la date la plus ancienne trouvée dans cette semaine.
    """
    global planning, nouvelles_entrees

    tds = driver.find_elements(By.XPATH, "//td[contains(@class,'val')]")
    dates_trouvees = set()

    for td in tds:
        try:
            classes = td.get_attribute("class").split()
            couleur = td.value_of_css_property("background-color")
            horaires = td.text.strip()

            has_horaire = bool(horaires and re.search(r"\d{2}:\d{2}-\d{2}:\d{2}", horaires))
            is_cp = "CP" in classes
            is_indispo = "Indisponible" in classes

            # On ignore les cellules sans horaire ET sans catégorie spéciale
            if not has_horaire and not is_cp and not is_indispo:
                continue

            # Personne
            parent = td.find_element(By.XPATH, "./ancestor::tr")
            nom_cell = parent.find_element(By.XPATH, "./td[1]")
            nom = nom_cell.text.strip()

            if not re.match(regex_nom, nom):
                continue

            # Date
            index = int(td.get_attribute("cellIndex"))
            header = driver.find_element(By.XPATH, f"//thead//th[{index+1}]")
            header_text = header.text.strip()
            date_iso = parse_date_fr(header_text)
            dates_trouvees.add(date_iso)

            # -----------------------------------------------
            # FUSION : on n'écrase pas les données existantes
            # -----------------------------------------------
            if nom not in planning:
                planning[nom] = {}

            if date_iso not in planning[nom]:
                # Nouvelle date → on ajoute
                planning[nom][date_iso] = []
                nouvelles_entrees += 1

                # Cas CP ou Indisponible (pas d'horaire)
                if is_cp or is_indispo:
                    planning[nom][date_iso].append({
                        "horaire": None,
                        "categorie": "CP" if is_cp else "Indisponible",
                        "couleur": couleur
                    })

                # Cas normal avec horaire(s)
                else:
                    categorie = next(
                        (c for c in classes if c not in ["val"] and "ng-star" not in c),
                        "Inconnue"
                    )
                    for slot in horaires.split():
                        planning[nom][date_iso].append({
                            "horaire": slot,
                            "categorie": categorie,
                            "couleur": couleur
                        })
            # Si la date existe déjà → on ne touche pas aux données

        except Exception:
            continue

    return min(dates_trouvees) if dates_trouvees else None


# -----------------------------
# SCRAPING MULTI-SEMAINES
# -----------------------------
print("=== Début du scraping incrémental ===")

date_min = scrape_semaine()
print(f"[Semaine actuelle] Plus ancienne date trouvée : {date_min}")

while date_min and date_min > DATE_LIMITE:
    print(f"[LOG] Passage à la semaine précédente (actuellement {date_min})...")

    btn_prev = driver.find_element(
        By.XPATH,
        "//button[.//mat-icon[normalize-space(text())='arrow_back_ios_new']]"
    )
    btn_prev.click()

    time.sleep(3)

    date_min = scrape_semaine()
    print(f"[Semaine scrapée] Plus ancienne date trouvée : {date_min}")

    # Sécurité : si on a rejoint ou dépassé la date limite → stop
    if date_min and date_min <= DATE_LIMITE:
        print(f"[INFO] Date limite '{DATE_LIMITE}' atteinte. Arrêt du scraping.")
        break

print("=== Fin du scraping ===")
driver.quit()

# -----------------------------
# SAUVEGARDE DU JSON MIS À JOUR
# -----------------------------
with open(JSON_FILE, "w", encoding="utf-8") as f:
    json.dump(planning, f, ensure_ascii=False, indent=2)

print(f"[OK] '{JSON_FILE}' mis à jour avec {nouvelles_entrees} nouvelle(s) entrée(s) ajoutée(s).")

# -----------------------------
# PUSH AUTOMATIQUE VERS GITHUB
# -----------------------------
if nouvelles_entrees > 0:
    try:
        from git import Repo

        repo = Repo(GITHUB_REPO_PATH)

        # Configure le token dans l'URL remote si pas déjà fait
        remote = repo.remotes.origin
        remote_url = remote.url
        if "@" not in remote_url:
            # Injecte le token dans l'URL HTTPS
            remote_url_with_token = remote_url.replace(
                "https://", f"https://{GITHUB_TOKEN}@"
            )
            remote.set_url(remote_url_with_token)

        # Stage le JSON
        repo.index.add([JSON_FILE])

        # Commit avec la date du jour
        from datetime import datetime
        today = datetime.now().strftime("%Y-%m-%d %H:%M")
        repo.index.commit(f"[auto] Mise à jour planning - {today}")

        # Push
        remote.push()
        print(f"[OK] JSON poussé sur GitHub avec succès.")

    except Exception as e:
        print(f"[ERREUR] Push GitHub échoué : {e}")
else:
    print("[INFO] Aucune nouvelle donnée, push GitHub ignoré.")