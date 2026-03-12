from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
import json
import time
import re

# -----------------------------
# CONFIG
# -----------------------------
URL = "https://planning-helpdesk.web.app/login"
EMAIL = "tom.poyeau.ext@groupe-mma.fr"
PASSWORD = "Plutot2023"

DATE_LIMITE = "2024-01-01"   # On s'arrête quand on atteint cette date

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
options.add_argument("--headless")  # Mode sans interface graphique

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

planning = {}
regex_nom = r"^[A-ZÉÈÊÎÔÛÄËÏÖÜ][A-Za-zÀ-ÖØ-öø-ÿ-]+ [A-ZÉÈÊÎÔÛÄËÏÖÜ][A-Za-zÀ-ÖØ-öø-ÿ-]+$"

def scrape_semaine():
    """
    Scrape la semaine actuellement affichée dans le planning
    et fusionne les données dans le dict global 'planning'.
    Retourne la date la plus ancienne trouvée dans cette semaine.
    """
    global planning

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

            if nom not in planning:
                planning[nom] = {}

            if date_iso not in planning[nom]:
                planning[nom][date_iso] = []

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

        except Exception:
            continue

    # Retourne la date la plus ancienne de la semaine
    return min(dates_trouvees) if dates_trouvees else None


# -----------------------------
# SCRAPING MULTI-SEMAINES
# -----------------------------
print("=== Début du scraping multi-semaines ===")

date_min = scrape_semaine()
print(f"[Semaine actuelle] plus ancienne date trouvée : {date_min}")

while date_min and date_min > DATE_LIMITE:
    print(f"[LOG] Passage à la semaine précédente (actuellement {date_min})...")

    # Bouton semaine précédente (icône arrow_back_ios_new)
    btn_prev = driver.find_element(
        By.XPATH,
        "//button[.//mat-icon[normalize-space(text())='arrow_back_ios_new']]"
    )
    btn_prev.click()

    time.sleep(3)

    date_min = scrape_semaine()
    print(f"[Semaine scrapée] plus ancienne date trouvée : {date_min}")

print("=== Fin du scraping ===")
driver.quit()

# -----------------------------
# EXPORT JSON
# -----------------------------
with open("planning_enrichi.json", "w", encoding="utf-8") as f:
    json.dump(planning, f, ensure_ascii=False, indent=2)

print("[OK] planning_enrichi.json généré (toutes les semaines jusqu'au 2 novembre 2023).")