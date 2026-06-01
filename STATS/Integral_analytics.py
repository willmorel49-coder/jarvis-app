# -*- coding: utf-8 -*-
"""
Intégral Analytics – Tableau de bord commercial (design premium)
Inspiré du style Power BI : KPI cards colorées, graphiques modernes, sidebar stylisée.
"""

import os
import re
import sys
import glob
import io
import base64
from datetime import datetime

import numpy as np
import pandas as pd
import streamlit as st
import plotly.express as px
import plotly.graph_objects as go
import streamlit.components.v1 as components

from pathlib import Path

# =========================================================
# LISTES SANOFI / UPSA
# =========================================================
def load_sano_upsa_lists():
    base_dir = Path(__file__).resolve().parent
    sano_file = base_dir / "SANO-UPSA 26.xlsx"
    liste_sanofi = []
    liste_upsa = []

    if not sano_file.exists():
        return liste_sanofi, liste_upsa

    try:
        df_sanofi_list = pd.read_excel(sano_file, sheet_name="SANOFI")
        df_upsa_list = pd.read_excel(sano_file, sheet_name="UPSA")

        liste_sanofi = (
            df_sanofi_list.iloc[:, 0]
            .dropna()
            .astype(str)
            .str.replace(r"\.0$", "", regex=True)
            .str.strip()
            .tolist()
        )
        liste_upsa = (
            df_upsa_list.iloc[:, 0]
            .dropna()
            .astype(str)
            .str.replace(r"\.0$", "", regex=True)
            .str.strip()
            .tolist()
        )
    except Exception:
        liste_sanofi = []
        liste_upsa = []

    return liste_sanofi, liste_upsa

LISTE_SANOFI, LISTE_UPSA = load_sano_upsa_lists()


# =========================================================
# CONFIG STREAMLIT
# =========================================================
st.set_page_config(
    page_title="Intégral Analytics",
    layout="wide",
    initial_sidebar_state="expanded",
)

# =========================================================
# PALETTE & DESIGN
# =========================================================
COLOR_PRIMARY   = "#E8440A"   # Orange-rouge vif (accent)
COLOR_SECONDARY = "#1E3A5F"   # Bleu marine profond
COLOR_KPI = ["#E8440A", "#1E3A5F", "#27AE60", "#8E44AD", "#2980B9", "#F39C12"]
COLOR_BAR = "#E8440A"
COLOR_BAR2 = "#1E3A5F"
BG_SIDEBAR = "#1E3A5F"

# =========================
# CONFIG
# =========================
ACTIVER_EXPORT = False  # Passe à True pour réactiver l'export Excel

# Affichage conditionnel de certains modules avancés
AFFICHER_MODULE_ABANDON = False

# =========================================================
# CSS GLOBAL
# =========================================================
CUSTOM_CSS = f"""
<style>
@import url('https://fonts.googleapis.com/css2?family=Barlow:wght@400;600;700;900&family=Barlow+Condensed:wght@600;700;900&display=swap');

/* ---- BASE ---- */
html, body, [class*="css"] {{
    font-family: 'Barlow', sans-serif;
}}

/* ---- SIDEBAR ---- */
section[data-testid="stSidebar"] {{
    background: {BG_SIDEBAR} !important;
    border-right: none !important;
}}
section[data-testid="stSidebar"] * {{
    color: #FFFFFF !important;
}}
section[data-testid="stSidebar"] .stSelectbox label,
section[data-testid="stSidebar"] .stMultiSelect label,
section[data-testid="stSidebar"] .stDateInput label,
section[data-testid="stSidebar"] .stCheckbox label,
section[data-testid="stSidebar"] .stSlider label {{
    color: #B0C4DE !important;
    font-size: 0.75rem !important;
    font-weight: 600 !important;
    text-transform: uppercase !important;
    letter-spacing: 0.06em !important;
}}
section[data-testid="stSidebar"] .stButton button {{
    background: {COLOR_PRIMARY} !important;
    color: #fff !important;
    border: none !important;
    border-radius: 6px !important;
    font-weight: 700 !important;
    width: 100%;
}}
section[data-testid="stSidebar"] .stFormSubmitButton button {{
    background: #2E9ECC !important;
    color: #fff !important;
    border: none !important;
    border-radius: 6px !important;
    font-weight: 700 !important;
    width: 100%;
    transition: background 0.2s ease !important;
}}
section[data-testid="stSidebar"] .stFormSubmitButton button:hover {{
    background: #2E9ECC !important;
    color: #fff !important;
    border: none !important;
}}
section[data-testid="stSidebar"] hr {{
    border-color: rgba(255,255,255,0.15) !important;
}}
section[data-testid="stSidebar"] .stForm {{
    background: transparent !important;
    border: none !important;
}}
section[data-testid="stSidebar"] .stSelectbox > div > div,
section[data-testid="stSidebar"] .stMultiSelect > div > div,
section[data-testid="stSidebar"] .stDateInput > div > div input,
section[data-testid="stSidebar"] input[type="text"],
section[data-testid="stSidebar"] input[type="date"],
section[data-testid="stSidebar"] .stDateInput input {{
    background-color: #122440 !important;
    color: #FFFFFF !important;
    border: 1px solid rgba(255,255,255,0.15) !important;
    border-radius: 6px !important;
}}
section[data-testid="stSidebar"] .stSelectbox > div > div:hover,
section[data-testid="stSidebar"] .stMultiSelect > div > div:hover {{
    border-color: rgba(255,255,255,0.35) !important;
}}
section[data-testid="stSidebar"] .stMultiSelect span[data-baseweb="tag"] {{
    background-color: {COLOR_PRIMARY} !important;
    color: #fff !important;
}}
section[data-testid="stSidebar"] svg {{
    fill: rgba(255,255,255,0.6) !important;
}}

/* ---- PAGE TITLE ZONE ---- */
.dash-title-bar {{
    background: linear-gradient(135deg, {COLOR_SECONDARY} 0%, #2C5282 100%);
    border-radius: 8px;
    padding: 8px 18px;
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    box-shadow: 0 2px 10px rgba(30,58,95,0.18);
}}
.dash-title-bar h1 {{
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 1.25rem;
    font-weight: 900;
    color: #FFFFFF;
    margin: 0;
    letter-spacing: 0.02em;
    text-transform: uppercase;
}}
.dash-title-bar .dash-subtitle {{
    font-size: 0.7rem;
    color: #90B4D8;
    margin: 0;
    margin-top: 1px;
}}

/* ---- KPI CARDS ---- */
.kpi-grid {{
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 8px;
    margin-bottom: 8px;
}}
.kpi-card {{
    border-radius: 8px;
    padding: 10px 12px 8px 12px;
    color: #fff;
    position: relative;
    overflow: hidden;
    box-shadow: 0 2px 8px rgba(0,0,0,0.13);
    min-height: 0;
}}
.kpi-card::after {{
    content: '';
    position: absolute;
    bottom: -12px; right: -12px;
    width: 50px; height: 50px;
    border-radius: 50%;
    background: rgba(255,255,255,0.10);
}}
.kpi-icon {{
    font-size: 1.1rem;
    margin-bottom: 2px;
    display: block;
}}
.kpi-label {{
    font-size: 0.6rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    opacity: 0.85;
    margin-bottom: 2px;
}}
.kpi-value {{
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 1.15rem;
    font-weight: 900;
    line-height: 1.1;
    word-break: break-all;
}}

/* ---- SECTION HEADERS ---- */
.section-header {{
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 0.9rem;
    font-weight: 900;
    color: {COLOR_SECONDARY};
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-left: 3px solid {COLOR_PRIMARY};
    padding-left: 8px;
    margin: 8px 0 4px 0;
}}

/* ---- CHART CONTAINERS ---- */
.chart-card {{
    background: #fff;
    border-radius: 8px;
    padding: 8px 10px 4px 10px;
    box-shadow: 0 1px 6px rgba(30,58,95,0.07);
    border: 1px solid #E8EEF5;
    margin-bottom: 6px;
}}
.chart-card-title {{
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: #64748b;
    margin-bottom: 4px;
}}

/* ---- TABLES ---- */
.stDataFrame {{
    border-radius: 10px !important;
    overflow: hidden !important;
    box-shadow: 0 2px 10px rgba(30,58,95,0.07) !important;
}}

/* ---- MAIN CONTENT ---- */
.block-container {{
    padding-top: 0.5rem !important;
    padding-bottom: 0.5rem !important;
    max-width: 1600px !important;
}}

/* ---- ALERTS ---- */
.stAlert {{
    border-radius: 10px !important;
}}

/* ---- PRINT ---- */
.no-print {{}}
.print-block {{
    break-inside: avoid;
    page-break-inside: avoid;
}}
.print-header {{
    font-size: 18px;
    font-weight: 900;
    margin: 0 0 6mm 0;
    padding: 0 0 4mm 0;
    border-bottom: 2px solid #000;
    color:#000;
}}
.report-header, .report-footer {{ display:none; }}
.report-header__inner{{display:flex;align-items:center;justify-content:space-between;gap:12px;}}
.report-left{{display:flex;align-items:center;gap:12px;min-width:0;}}
.report-logo{{width:56px;height:56px;object-fit:contain;}}
.report-title{{font-size:16px;font-weight:900;line-height:1.1;margin:0;}}
.report-sub{{font-size:12px;font-weight:700;opacity:0.95;margin-top:2px;}}
.report-right{{text-align:right;font-size:12px;font-weight:700;}}
.report-filters{{margin-top:6px;font-size:11px;font-weight:650;opacity:0.95;border-top:1px solid #000;padding-top:6px;}}

@media print {{
    @page {{ size: A4 landscape; margin: 12mm; }}
    section[data-testid="stSidebar"] {{ display: none !important; }}
    header, footer, .stAppToolbar {{ display: none !important; }}
    .no-print {{ display:none !important; }}
    * {{-webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;}}
    html, body {{ background:#fff !important; }}
    .block-container{{padding:0 !important;margin:0 !important;max-width:100% !important;}}
    body.report-mode{{margin-top:54mm;margin-bottom:18mm;}}
    .report-header{{display:block !important;position:fixed;top:0;left:0;right:0;padding:10mm 12mm 6mm 12mm;background:#fff;z-index:999999;border-bottom:2px solid #000;}}
    .report-footer{{display:block !important;position:fixed;bottom:0;left:0;right:0;padding:4mm 12mm 8mm 12mm;background:#fff;z-index:999999;border-top:2px solid #000;font-size:11px;font-weight:700;}}
    .report-footer .page-number:after{{content:"Page " counter(page) " / " counter(pages);}}
    a:link:after, a:visited:after{{ content:"" !important; }}
}}
</style>
"""

st.markdown(CUSTOM_CSS, unsafe_allow_html=True)


# =========================================================
# LOGO LOCAL
# =========================================================
def load_local_logo_b64(filename: str = "Integral.png") -> str:
    try:
        here = os.path.dirname(os.path.abspath(__file__))
        path = os.path.join(here, filename)
        if not os.path.isfile(path):
            return ""
        with open(path, "rb") as f:
            return base64.b64encode(f.read()).decode("ascii")
    except Exception:
        return ""


LOGO_B64 = load_local_logo_b64("Integral.png")


# =========================================================
# DOSSIER DONNÉES
# =========================================================
def get_data_dir() -> str:
    if "--" in sys.argv:
        i = sys.argv.index("--")
        if i + 1 < len(sys.argv):
            p = sys.argv[i + 1].strip('"').strip()
            if p and os.path.isdir(p):
                return os.path.abspath(p)
    envp = os.environ.get("INTEGRAL_DATA_DIR", "").strip('"').strip()
    if envp and os.path.isdir(envp):
        return os.path.abspath(envp)
    return os.path.abspath(os.getcwd())


DATA_DIR = get_data_dir()


def list_files_in_folder(folder: str) -> list:
    patterns = [os.path.join(folder, "*.xlsx"), os.path.join(folder, "*.xls"), os.path.join(folder, "*.csv")]
    files = []
    for p in patterns:
        files.extend(glob.glob(p))
    return sorted(set(files))


def folder_signature(folder: str) -> tuple:
    files = list_files_in_folder(folder)
    sig = []
    for f in files:
        try:
            stt = os.stat(f)
            sig.append((os.path.abspath(f), int(stt.st_mtime), int(stt.st_size)))
        except Exception:
            sig.append((os.path.abspath(f), 0, 0))
    return tuple(sig)


# =========================================================
# COLONNES ATTENDUES
# =========================================================
REQUIRED_COLUMNS = [
    "PCVNUM", "PCVDATEEFFET", "TIRCODE", "Commercial", "TIRSOCIETE",
    "PROCODE", "ARTCODE", "PLVDESIGNATION",
    "PLVQTE", "PLVPUBRUT", "PLVPUNET", "PLVMNTNETHT",
    "ARTSOUSFAMILLE", "ARTCATEGORIE", "ARTNATURE", "ARTCOLLECTION",
    "AFMCODE", "PLVDIVERS", "ARTMARQUE", "ARTCLASSE",
    "TVATAUX", "PLVREMISE_F", "ARTCODEBARRE"
]
NUMERIC_COLS = ["PLVQTE", "PLVPUBRUT", "PLVPUNET", "PLVMNTNETHT", "TVATAUX"]
TEXT_COLS = [
    "PCVNUM", "TIRCODE", "Commercial", "TIRSOCIETE",
    "PROCODE", "ARTCODE", "PLVDESIGNATION", "ARTSOUSFAMILLE",
    "ARTCATEGORIE", "ARTNATURE", "ARTCOLLECTION", "AFMCODE",
    "PLVDIVERS", "ARTMARQUE", "ARTCLASSE", "PLVREMISE_F", "ARTCODEBARRE"
]

EUR = st.column_config.NumberColumn(format="%.2f €")
PCT = st.column_config.NumberColumn(format="%.2f %%")
INT = st.column_config.NumberColumn(format="%d")


def format_eur(x):
    if x is None or pd.isna(x):
        return "—"
    return f"{float(x):,.2f} €".replace(",", "X").replace(".", ",").replace("X", " ")


def format_int(x):
    if x is None or pd.isna(x):
        return "—"
    return f"{int(x):,}".replace(",", " ")


def format_pct_ratio(x, digits=2):
    if x is None or pd.isna(x):
        return "—"
    return f"{float(x) * 100:.{digits}f} %".replace(".", ",")

def safe_variation_pct(current, previous):
    """
    Variation % métier robuste.

    Règles :
    - si N-1 > 0 et N >= 0  : formule classique ((N - N-1) / N-1) * 100
    - si N-1 > 0 et N < 0   : baisse réelle (bascule en avoir) -> ((N - N-1) / N-1) * 100  (résultat négatif)
    - si N-1 < 0 et N >= 0  : reprise après avoir -> non pertinent (signe du dénominateur trompeur)
    - si N-1 < 0 et N < 0   : comparaison relative sur la valeur absolue de N-1
    - si N-1 = 0             : non pertinent
    """
    if current is None or previous is None:
        return np.nan
    if pd.isna(current) or pd.isna(previous):
        return np.nan

    cur = float(current)
    prev = float(previous)

    if abs(prev) < 1e-9:
        return np.nan

    # Cas normal : base positive (qu'il y ait ou non un avoir côté N)
    if prev > 0:
        return ((cur - prev) / prev) * 100.0

    # Base négative (avoir en N-1) et N également négatif : variation sur valeur absolue
    if prev < 0 and cur < 0:
        return ((cur - prev) / abs(prev)) * 100.0

    # Base négative et N positif (reprise d'avoir) : non pertinent
    return np.nan

def variation_status(current, previous):
    if current is None or previous is None or pd.isna(current) or pd.isna(previous):
        return ""
    cur = float(current)
    prev = float(previous)

    if abs(prev) < 1e-9:
        return "Base nulle"

    if prev < 0 and cur >= 0:
        return "Reprise après avoir"

    if prev > 0 and cur < 0:
        return "Bascule en avoir"

    if cur > prev:
        return "Hausse"
    if cur < prev:
        return "Baisse"
    return "Stable"

def negative_cell_style(val):
    try:
        return "background-color: #FDECEA; color: #B42318; font-weight: 700;" if pd.notna(val) and float(val) < 0 else ""
    except Exception:
        return ""

def style_negative_values(df_in, columns):
    if df_in is None or len(df_in) == 0:
        return df_in
    cols = [c for c in columns if c in df_in.columns]
    if not cols:
        return df_in
    return df_in.style.map(negative_cell_style, subset=cols)


# =========================================================
# UTILS
# =========================================================
def safe_col(df, col):
    if col not in df.columns:
        df[col] = np.nan


def _to_str(x):
    if pd.isna(x):
        return ""
    return str(x).strip()


def norm_text(s):
    return s.astype(str).fillna("").str.strip()


def parse_fr_number(series):
    s = series.copy()
    if pd.api.types.is_numeric_dtype(s):
        return pd.to_numeric(s, errors="coerce")
    s = s.astype(str).str.strip()
    s = s.str.replace("\u00A0", "", regex=False).str.replace(" ", "", regex=False)
    sci_mask = s.str.contains(r"^[+-]?\d+,\d+E[+-]?\d+$", regex=True)
    s.loc[sci_mask] = s.loc[sci_mask].str.replace(",", ".", regex=False)
    s = s.str.replace(".", "", regex=False)
    s = s.str.replace(",", ".", regex=False)
    return pd.to_numeric(s, errors="coerce")


def parse_date_fr(series):
    s = series.copy()
    if np.issubdtype(s.dtype, np.datetime64):
        return pd.to_datetime(s, errors="coerce")
    return pd.to_datetime(s, dayfirst=True, errors="coerce")


def ensure_date_range_state(key, default_tuple):
    if key in st.session_state:
        v = st.session_state[key]
        if isinstance(v, (list, tuple)) and len(v) == 2:
            return
    st.session_state[key] = default_tuple


def read_date_range(value, fallback_tuple):
    if isinstance(value, (list, tuple)):
        if len(value) == 2:
            return value[0], value[1]
        if len(value) == 1:
            return value[0], value[0]
    if value is None:
        return fallback_tuple[0], fallback_tuple[1]
    return value, value


def to_excel_bytes(df_dict):
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        for name, d in df_dict.items():
            sheet = re.sub(r"[\[\]\:\*\?\/\\]", "_", str(name))[:31]
            (d if d is not None else pd.DataFrame()).to_excel(writer, index=False, sheet_name=sheet)
    return output.getvalue()


def read_one_file(path):
    ext = os.path.splitext(path)[1].lower()
    if ext in [".xlsx", ".xls"]:
        return pd.read_excel(path)
    try:
        return pd.read_csv(path, sep=";", engine="python", encoding="utf-8")
    except Exception:
        try:
            return pd.read_csv(path, sep=";", engine="python", encoding="cp1252")
        except Exception:
            try:
                return pd.read_csv(path, sep=",", engine="python", encoding="utf-8")
            except Exception:
                return pd.read_csv(path, sep=",", engine="python", encoding="cp1252")


# =========================================================
# LOAD DATA (cache)
# =========================================================
@st.cache_data(show_spinner=False)
def load_folder(sig, folder_path):
    files = list_files_in_folder(folder_path)
    if not files:
        return pd.DataFrame()

    frames = []
    failed_files = []

    for f in files:
        try:
            tmp = read_one_file(f)
            tmp["__source_file__"] = os.path.basename(f)
            frames.append(tmp)
        except Exception as e:
            failed_files.append((os.path.basename(f), str(e)))

    if failed_files:
        for fname, reason in failed_files:
            st.warning(f"⚠️ Fichier ignoré : **{fname}** — {reason}")

    if not frames:
        return pd.DataFrame()

    df = pd.concat(frames, ignore_index=True, sort=False)
    df.columns = [str(c).strip() for c in df.columns]

    # Colonnes obligatoires
    for c in REQUIRED_COLUMNS:
        safe_col(df, c)

    # Nettoyage texte
    for c in TEXT_COLS:
        if c in df.columns:
            df[c] = df[c].astype(str).replace({"nan": "", "None": ""}).map(_to_str)

    # Dates
    df["PCVDATEEFFET"] = parse_date_fr(df["PCVDATEEFFET"])
    df = df[df["PCVDATEEFFET"].notna()].copy()

    # Numérique
    for c in NUMERIC_COLS:
        if c in df.columns:
            df[c] = parse_fr_number(df[c])

    # Nettoyage codes
    df["TIRCODE"] = df["TIRCODE"].astype(str).str.replace(r"\.0$", "", regex=True).str.strip()

    # =========================
    # GESTION DES AVOIRS (AC_)
    # =========================
    # Règle métier :
    # - les avoirs doivent être comptabilisés en négatif
    # - on garde les prix unitaires positifs
    # - on force la quantité et le montant net HT en négatif
    #   pour obtenir un CA brut cohérent :
    #   MONTANT_BRUT = PLVPUBRUT * PLVQTE
    mask_avoir = df["PCVNUM"].astype(str).str.upper().str.startswith("AC_", na=False)

    if "PLVQTE" in df.columns:
        df.loc[mask_avoir, "PLVQTE"] = -df.loc[mask_avoir, "PLVQTE"].abs()

    if "PLVMNTNETHT" in df.columns:
        df.loc[mask_avoir, "PLVMNTNETHT"] = -df.loc[mask_avoir, "PLVMNTNETHT"].abs()

    if "PLVPUBRUT" in df.columns:
        df.loc[mask_avoir, "PLVPUBRUT"] = df.loc[mask_avoir, "PLVPUBRUT"].abs()

    if "PLVPUNET" in df.columns:
        df.loc[mask_avoir, "PLVPUNET"] = df.loc[mask_avoir, "PLVPUNET"].abs()

    # Normalisation CIP13
    df["ARTCODEBARRE"] = df["ARTCODEBARRE"].astype(str).str.replace(r"\.0$", "", regex=True).str.strip()
    df["ARTCODEBARRE_N"] = df["ARTCODEBARRE"].replace({
        "": np.nan,
        "0": np.nan,
        "nan": np.nan,
        "None": np.nan,
        "#N/A": np.nan
    })

    # Calculs métier
    df["CA_HT"] = df["PLVMNTNETHT"]
    df["MONTANT_BRUT"] = df["PLVPUBRUT"] * df["PLVQTE"]
    df["abandon_EUR"] = df["MONTANT_BRUT"] - df["CA_HT"]

    df["taux_abandon_ratio"] = np.where(
        df["MONTANT_BRUT"] != 0,
        df["abandon_EUR"] / df["MONTANT_BRUT"],
        np.nan
    )

    # Dates analytiques
    df["MOIS"] = df["PCVDATEEFFET"].dt.to_period("M").dt.to_timestamp()
    df["ANNEE"] = df["PCVDATEEFFET"].dt.year

    # Flags métier
    df["ARTNATURE_N"] = norm_text(df["ARTNATURE"]).str.lower()
    df["ARTSOUSFAMILLE_N"] = norm_text(df["ARTSOUSFAMILLE"]).str.lower()
    df["EST_BIOSIM"] = df["ARTNATURE_N"].eq("biosimilaire")
    df["EST_FROID"] = df["ARTSOUSFAMILLE_N"].eq("froid")

    return df


# =========================================================
# AGGREGATIONS (cache)
# =========================================================
@st.cache_data(show_spinner=False)
def build_client_list(df_in):
    out = df_in[["TIRCODE", "TIRSOCIETE"]].drop_duplicates().copy()
    out["TIRCODE"] = out["TIRCODE"].astype(str).str.strip()
    out["TIRSOCIETE"] = out["TIRSOCIETE"].astype(str).str.strip()
    out["client_label"] = out["TIRCODE"] + " — " + out["TIRSOCIETE"]
    return out.sort_values("client_label")


@st.cache_data(show_spinner=False)
def agg_products(df_in):
    df_tmp = df_in.copy()
    df_tmp["_cle_produit"] = df_tmp["ARTCODEBARRE_N"].astype(str).str.strip()
    df_tmp["_cle_produit"] = df_tmp["_cle_produit"].replace({"", "nan", "None", "#N/A"}, np.nan)
    df_tmp["_cle_produit"] = df_tmp["_cle_produit"].fillna(df_tmp["ARTCODE"].astype(str).str.strip())

    g = (
        df_tmp.groupby(["TIRCODE", "TIRSOCIETE", "_cle_produit"], as_index=False)
        .agg(
            ARTCODE=("ARTCODE", "first"),
            ARTCODEBARRE=("ARTCODEBARRE", "first"),
            PLVDESIGNATION=("PLVDESIGNATION", "first"),
            CA_HT=("CA_HT", "sum"),
            BRUT=("MONTANT_BRUT", "sum"),
            abandon_EUR=("abandon_EUR", "sum"),
            QTE=("PLVQTE", "sum"),
            LIGNES=("PCVNUM", "count"),
            ARTNATURE_N=("ARTNATURE_N", "first"),
            ARTSOUSFAMILLE_N=("ARTSOUSFAMILLE_N", "first"),
        )
    )
    g = g.drop(columns=["_cle_produit"])
    g["taux_abandon_pct"] = np.where(g["BRUT"] != 0, (g["abandon_EUR"] / g["BRUT"]) * 100, np.nan)
    return g


@st.cache_data(show_spinner=False)
def agg_clients(df_in):
    g = (
        df_in.groupby(["TIRCODE", "TIRSOCIETE"], as_index=False)
        .agg(
            CA_HT=("CA_HT", "sum"),
            BRUT=("MONTANT_BRUT", "sum"),
            abandon_EUR=("abandon_EUR", "sum"),
            QTE=("PLVQTE", "sum"),
            LIGNES=("PCVNUM", "count"),
            FACTURES=("PCVNUM", "nunique"),
        )
    )
    g["taux_abandon_pct"] = np.where(g["BRUT"] != 0, (g["abandon_EUR"] / g["BRUT"]) * 100, np.nan)
    return g


@st.cache_data(show_spinner=False)
def agg_month(df_in):
    return (
        df_in.groupby("MOIS", as_index=False)
        .agg(CA_HT=("CA_HT", "sum"), BRUT=("MONTANT_BRUT", "sum"), abandon_EUR=("abandon_EUR", "sum"))
        .sort_values("MOIS")
    )


@st.cache_data(show_spinner=False)
def agg_products_for_charts(df_prod: pd.DataFrame) -> pd.DataFrame:
    if df_prod is None or df_prod.empty:
        return pd.DataFrame(columns=["ARTCODE", "PLVDESIGNATION", "CA_HT", "BRUT", "abandon_EUR", "QTE", "LIGNES", "ARTNATURE_N", "ARTSOUSFAMILLE_N", "taux_abandon_pct"])

    tmp = df_prod.copy()
    tmp["_product_key"] = tmp["ARTCODE"].astype(str).str.strip()
    tmp["_product_key"] = tmp["_product_key"].replace({"": np.nan, "nan": np.nan, "None": np.nan})
    tmp["_product_key"] = tmp["_product_key"].fillna(tmp["PLVDESIGNATION"].astype(str).str.strip())

    g = (
        tmp.groupby(["_product_key"], as_index=False)
        .agg(
            ARTCODE=("ARTCODE", "first"),
            PLVDESIGNATION=("PLVDESIGNATION", "first"),
            CA_HT=("CA_HT", "sum"),
            BRUT=("BRUT", "sum"),
            abandon_EUR=("abandon_EUR", "sum"),
            QTE=("QTE", "sum"),
            LIGNES=("LIGNES", "sum"),
            ARTNATURE_N=("ARTNATURE_N", "first"),
            ARTSOUSFAMILLE_N=("ARTSOUSFAMILLE_N", "first"),
        )
    )
    g = g.drop(columns=["_product_key"])
    g["taux_abandon_pct"] = np.where(g["BRUT"] != 0, (g["abandon_EUR"] / g["BRUT"]) * 100, np.nan)
    return g


@st.cache_data(show_spinner=False)
def compute_scope(df_in, selected_client):
    if selected_client is None:
        sdf = df_in.copy()
    else:
        sdf = df_in[df_in["TIRCODE"] == selected_client].copy()
    prod_scope = agg_products(sdf)
    clients_scope = agg_clients(sdf)
    mois_scope = agg_month(sdf)
    return sdf, prod_scope, clients_scope, mois_scope


def segment_ca_safe(series: pd.Series) -> pd.Series:
    s = pd.to_numeric(series, errors="coerce").fillna(0)

    if s.empty:
        return pd.Series(dtype="object", index=series.index)

    if s.nunique(dropna=False) <= 1:
        return pd.Series(["Développement"] * len(s), index=s.index, dtype="object")

    try:
        seg = pd.qcut(
            s,
            q=3,
            labels=["Standard", "Développement", "Premium"],
            duplicates="drop"
        )
        if hasattr(seg, "cat") and len(seg.cat.categories) == 3:
            return seg.astype(str)
    except Exception:
        pass

    try:
        ranks = s.rank(method="average", pct=True)
        return pd.cut(
            ranks,
            bins=[-np.inf, 1/3, 2/3, np.inf],
            labels=["Standard", "Développement", "Premium"],
            include_lowest=True
        ).astype(str)
    except Exception:
        return pd.Series(["Développement"] * len(s), index=s.index, dtype="object")


@st.cache_data(show_spinner=False)
def enrich_clients(clients_df: pd.DataFrame) -> pd.DataFrame:
    if clients_df is None or clients_df.empty:
        return pd.DataFrame()
    out = clients_df.copy()
    out["PANIER_MOYEN"] = np.where(out["FACTURES"] > 0, out["CA_HT"] / out["FACTURES"], np.nan)

    def _norm(series):
        s = pd.to_numeric(series, errors="coerce")
        if s.notna().sum() == 0:
            return pd.Series(np.zeros(len(s)), index=s.index)
        mn, mx = s.min(), s.max()
        if pd.isna(mn) or pd.isna(mx) or mx == mn:
            return pd.Series(np.ones(len(s)) * 50, index=s.index)
        return ((s - mn) / (mx - mn)) * 100

    score_ca = _norm(out["CA_HT"])
    # Taux d'abandon élevé = marge partagée importante = favorable pour le pharmacien
    score_abandon = _norm(out["taux_abandon_pct"].fillna(out["taux_abandon_pct"].median()))
    score_panier = _norm(out["PANIER_MOYEN"])
    out["SCORE_CLIENT"] = (score_ca * 0.5 + score_abandon * 0.3 + score_panier * 0.2).round(1)
    out["SEGMENT_CA"] = segment_ca_safe(out["CA_HT"])
    return out


@st.cache_data(show_spinner=False)
def compute_opportunities(fdf, selected_client, top_n=20):
    if selected_client is None or fdf is None or fdf.empty:
        return pd.DataFrame()

    portfolio = agg_products_for_charts(agg_products(fdf))
    client = agg_products_for_charts(agg_products(fdf[fdf["TIRCODE"] == selected_client]))

    ref = portfolio[["ARTCODE", "PLVDESIGNATION", "CA_HT", "QTE", "ARTNATURE_N", "ARTSOUSFAMILLE_N"]].copy()
    cli_codes = set(client["ARTCODE"].astype(str).str.strip())
    ref = ref[~ref["ARTCODE"].astype(str).str.strip().isin(cli_codes)].copy()
    if ref.empty:
        return ref

    ref = ref.sort_values(["CA_HT", "QTE"], ascending=[False, False]).head(top_n).copy()
    ref["POTENTIEL_INDICE"] = (ref["CA_HT"].rank(ascending=False, pct=True) * 100).round(1)
    return ref


@st.cache_data(show_spinner=False)
def compute_period_compare(sdf: pd.DataFrame):
    if sdf is None or sdf.empty or sdf["MOIS"].nunique() < 2:
        return {}
    months = sorted(sdf["MOIS"].dropna().unique())
    last_m = months[-1]
    prev_m = months[-2]
    cur = sdf[sdf["MOIS"] == last_m]
    prv = sdf[sdf["MOIS"] == prev_m]

    def _sum(df_part, col):
        return float(df_part[col].sum()) if not df_part.empty else 0.0

    cur_ca, prv_ca = _sum(cur, "CA_HT"), _sum(prv, "CA_HT")
    cur_ab, prv_ab = _sum(cur, "abandon_EUR"), _sum(prv, "abandon_EUR")
    cur_br, prv_br = _sum(cur, "MONTANT_BRUT"), _sum(prv, "MONTANT_BRUT")

    cur_tx = (cur_ab / cur_br * 100) if cur_br > 0 else np.nan
    prv_tx = (prv_ab / prv_br * 100) if prv_br > 0 else np.nan

    return {
        "last_month": pd.Timestamp(last_m),
        "prev_month": pd.Timestamp(prev_m),
        "ca_current": cur_ca,
        "ca_previous": prv_ca,
        "ca_var_pct": safe_variation_pct(cur_ca, prv_ca),
        "tx_current": cur_tx,
        "tx_previous": prv_tx,
        "tx_var_pts": (cur_tx - prv_tx) if pd.notna(cur_tx) and pd.notna(prv_tx) else np.nan,
    }


@st.cache_data(show_spinner=False)
def compute_yoy_compare(df_all: pd.DataFrame, date_from, date_to, selected_client=None):
    if df_all is None or df_all.empty:
        return {}
    cur_start = pd.Timestamp(date_from)
    cur_end = pd.Timestamp(date_to)
    prev_start = cur_start - pd.DateOffset(years=1)
    prev_end = cur_end - pd.DateOffset(years=1)

    cur = df_all[(df_all["PCVDATEEFFET"] >= cur_start) & (df_all["PCVDATEEFFET"] <= cur_end)].copy()
    prev = df_all[(df_all["PCVDATEEFFET"] >= prev_start) & (df_all["PCVDATEEFFET"] <= prev_end)].copy()

    if selected_client is not None:
        cur = cur[cur["TIRCODE"] == selected_client].copy()
        prev = prev[prev["TIRCODE"] == selected_client].copy()

    if cur.empty and prev.empty:
        return {}

    def _metrics(part: pd.DataFrame):
        ca = float(part["CA_HT"].sum()) if not part.empty else 0.0
        brut = float(part["MONTANT_BRUT"].sum()) if not part.empty else 0.0
        ab = float(part["abandon_EUR"].sum()) if not part.empty else 0.0
        qte = float(part["PLVQTE"].sum()) if not part.empty else 0.0
        tx = (ab / brut * 100) if brut > 0 else np.nan
        return ca, brut, ab, qte, tx

    ca_cur, brut_cur, ab_cur, qte_cur, tx_cur = _metrics(cur)
    ca_prev, brut_prev, ab_prev, qte_prev, tx_prev = _metrics(prev)

    return {
        "current_start": cur_start,
        "current_end": cur_end,
        "previous_start": prev_start,
        "previous_end": prev_end,
        "ca_current": ca_cur,
        "ca_previous": ca_prev,
        "ca_var_pct": safe_variation_pct(ca_cur, ca_prev),
        "ab_current": ab_cur,
        "ab_previous": ab_prev,
        "ab_var_pct": safe_variation_pct(ab_cur, ab_prev),
        "qte_current": qte_cur,
        "qte_previous": qte_prev,
        "qte_var_pct": safe_variation_pct(qte_cur, qte_prev),
        "tx_current": tx_cur,
        "tx_previous": tx_prev,
        "tx_var_pts": (tx_cur - tx_prev) if pd.notna(tx_cur) and pd.notna(tx_prev) else np.nan,
    }


@st.cache_data(show_spinner=False)
def agg_brands(df_in: pd.DataFrame) -> pd.DataFrame:
    if df_in is None or df_in.empty:
        return pd.DataFrame(columns=["ARTCOLLECTION", "CA_HT", "BRUT", "abandon_EUR", "QTE", "LIGNES", "taux_abandon_pct"])
    tmp = df_in.copy()
    tmp["ARTCOLLECTION"] = tmp["ARTCOLLECTION"].astype(str).str.strip()
    tmp = tmp[tmp["ARTCOLLECTION"].isin([x for x in tmp["ARTCOLLECTION"].unique() if x not in ["", "nan", "None", "#N/A"]])].copy()
    if tmp.empty:
        return pd.DataFrame(columns=["ARTCOLLECTION", "CA_HT", "BRUT", "abandon_EUR", "QTE", "LIGNES", "taux_abandon_pct"])
    out = tmp.groupby("ARTCOLLECTION", as_index=False).agg(
        CA_HT=("CA_HT", "sum"),
        BRUT=("MONTANT_BRUT", "sum"),
        abandon_EUR=("abandon_EUR", "sum"),
        QTE=("PLVQTE", "sum"),
        LIGNES=("PCVNUM", "count"),
    )
    out["taux_abandon_pct"] = np.where(out["BRUT"] > 0, (out["abandon_EUR"] / out["BRUT"]) * 100, np.nan)
    return out.sort_values(["CA_HT", "abandon_EUR"], ascending=[False, False])


@st.cache_data(show_spinner=False)
def compute_client_priority(df_in: pd.DataFrame) -> pd.DataFrame:
    if df_in is None or df_in.empty:
        return pd.DataFrame()

    base = enrich_clients(agg_clients(df_in))
    if base.empty:
        return base

    months = sorted(df_in["MOIS"].dropna().unique())
    if len(months) >= 2:
        last_m = months[-1]
        prev_m = months[-2]
        cur = (
            df_in[df_in["MOIS"] == last_m]
            .groupby(["TIRCODE", "TIRSOCIETE"], as_index=False)
            .agg(CA_CUR=("CA_HT", "sum"), BRUT_CUR=("MONTANT_BRUT", "sum"), AB_CUR=("abandon_EUR", "sum"))
        )
        prv = (
            df_in[df_in["MOIS"] == prev_m]
            .groupby(["TIRCODE", "TIRSOCIETE"], as_index=False)
            .agg(CA_PREV=("CA_HT", "sum"), BRUT_PREV=("MONTANT_BRUT", "sum"), AB_PREV=("abandon_EUR", "sum"))
        )
        evo = cur.merge(prv, on=["TIRCODE", "TIRSOCIETE"], how="outer").fillna(0)
        evo["VAR_CA_PCT"] = [safe_variation_pct(cur_v, prev_v) for cur_v, prev_v in zip(evo["CA_CUR"], evo["CA_PREV"])]
        evo["TX_CUR"] = np.where(evo["BRUT_CUR"] > 0, (evo["AB_CUR"] / evo["BRUT_CUR"]) * 100, np.nan)
        evo["TX_PREV"] = np.where(evo["BRUT_PREV"] > 0, (evo["AB_PREV"] / evo["BRUT_PREV"]) * 100, np.nan)
        evo["VAR_TX_PTS"] = evo["TX_CUR"] - evo["TX_PREV"]
        out = base.merge(evo[["TIRCODE", "VAR_CA_PCT", "VAR_TX_PTS"]], on="TIRCODE", how="left")
    else:
        out = base.copy()
        out["VAR_CA_PCT"] = np.nan
        out["VAR_TX_PTS"] = np.nan

    def _norm(series, reverse=False):
        s = pd.to_numeric(series, errors="coerce")
        if s.notna().sum() == 0:
            return pd.Series(np.zeros(len(s)), index=s.index)
        mn, mx = s.min(), s.max()
        if pd.isna(mn) or pd.isna(mx) or mx == mn:
            val = pd.Series(np.ones(len(s)) * 50, index=s.index)
        else:
            val = ((s - mn) / (mx - mn)) * 100
        return 100 - val if reverse else val

    score_ca = _norm(out["CA_HT"])
    # Taux d'abandon élevé = marge partagée importante = opportunité valorisée positivement
    score_opportunity = _norm(out["taux_abandon_pct"].fillna(out["taux_abandon_pct"].median()))
    score_risk = _norm(out["VAR_CA_PCT"].fillna(0), reverse=True)
    out["SCORE_PRIORITE_VISITE"] = (score_ca * 0.40 + score_opportunity * 0.30 + score_risk * 0.30).round(1)

    def classify(score):
        if pd.isna(score):
            return "À analyser"
        if score >= 75:
            return "Priorité haute"
        if score >= 50:
            return "Priorité moyenne"
        return "Suivi normal"

    out["PRIORITE_VISITE"] = out["SCORE_PRIORITE_VISITE"].apply(classify)
    return out.sort_values(["SCORE_PRIORITE_VISITE", "CA_HT"], ascending=[False, False])


@st.cache_data(show_spinner=False)
def compute_commercial_summary(df_in: pd.DataFrame) -> pd.DataFrame:
    if df_in is None or df_in.empty:
        return pd.DataFrame()

    tmp = df_in.copy()

    # Normalisation du commercial
    tmp["Commercial"] = tmp["Commercial"].astype(str).str.strip()
    tmp = tmp[
        ~tmp["Commercial"].isin(["", "nan", "None", "#N/A"])
    ].copy()

    if tmp.empty:
        return pd.DataFrame()

    # Agrégation intermédiaire par commercial + pharmacie
    # pour fiabiliser les totaux
    inter = (
        tmp.groupby(["Commercial", "TIRCODE", "TIRSOCIETE"], as_index=False)
        .agg(
            CA_NET_HT=("CA_HT", "sum"),
            CA_BRUT_HT=("MONTANT_BRUT", "sum"),
            abandon_EUR=("abandon_EUR", "sum"),
            QTE=("PLVQTE", "sum"),
            FACTURES=("PCVNUM", "nunique"),
        )
    )

    # Résumé final par commercial
    out = (
        inter.groupby("Commercial", as_index=False)
        .agg(
            CA_NET_HT=("CA_NET_HT", "sum"),
            CA_BRUT_HT=("CA_BRUT_HT", "sum"),
            abandon_EUR=("abandon_EUR", "sum"),
            QTE=("QTE", "sum"),
            PHARMACIES=("TIRCODE", "nunique"),
            FACTURES=("FACTURES", "sum"),
        )
    )

    out["taux_abandon_pct"] = np.where(
        out["CA_BRUT_HT"] != 0,
        (out["abandon_EUR"] / out["CA_BRUT_HT"]) * 100,
        np.nan
    )

    # Variation vs mois précédent
    months = sorted(tmp["MOIS"].dropna().unique())
    if len(months) >= 2:
        last_m = months[-1]
        prev_m = months[-2]

        cur = (
            tmp[tmp["MOIS"] == last_m]
            .groupby("Commercial", as_index=False)
            .agg(CA_CUR=("CA_HT", "sum"))
        )
        prv = (
            tmp[tmp["MOIS"] == prev_m]
            .groupby("Commercial", as_index=False)
            .agg(CA_PREV=("CA_HT", "sum"))
        )

        out = out.merge(cur, on="Commercial", how="left").merge(prv, on="Commercial", how="left")
        out["CA_VAR_PCT"] = [
            safe_variation_pct(cur_v, prev_v)
            for cur_v, prev_v in zip(out["CA_CUR"].fillna(0), out["CA_PREV"].fillna(0))
        ]
    else:
        out["CA_CUR"] = np.nan
        out["CA_PREV"] = np.nan
        out["CA_VAR_PCT"] = np.nan

    out["ECART_BRUT_NET_HT"] = out["CA_BRUT_HT"] - out["CA_NET_HT"]

    # Ligne TOTAL
    total_row = pd.DataFrame([{
        "Commercial": "TOTAL",
        "CA_NET_HT": out["CA_NET_HT"].sum(),
        "CA_BRUT_HT": out["CA_BRUT_HT"].sum(),
        "abandon_EUR": out["abandon_EUR"].sum(),
        "QTE": out["QTE"].sum(),
        "PHARMACIES": out["PHARMACIES"].sum(),
        "FACTURES": out["FACTURES"].sum(),
        "CA_CUR": out["CA_CUR"].sum(skipna=True) if "CA_CUR" in out.columns else np.nan,
        "CA_PREV": out["CA_PREV"].sum(skipna=True) if "CA_PREV" in out.columns else np.nan,
        "CA_VAR_PCT": safe_variation_pct(
            out["CA_CUR"].sum(skipna=True) if "CA_CUR" in out.columns else np.nan,
            out["CA_PREV"].sum(skipna=True) if "CA_PREV" in out.columns else np.nan
        ),
        "ECART_BRUT_NET_HT": out["ECART_BRUT_NET_HT"].sum(),
        "taux_abandon_pct": (
            (out["abandon_EUR"].sum() / out["CA_BRUT_HT"].sum()) * 100
            if out["CA_BRUT_HT"].sum() != 0 else np.nan
        )
    }])

    out = pd.concat([out.sort_values("CA_NET_HT", ascending=False), total_row], ignore_index=True)

    return out


@st.cache_data(show_spinner=False)
def compute_opportunity_scoring(fdf: pd.DataFrame, selected_client, top_n=20) -> pd.DataFrame:
    opp = compute_opportunities(fdf, selected_client, top_n=top_n)
    if opp is None or opp.empty:
        return pd.DataFrame()

    opp = opp.copy()
    portfolio = agg_products_for_charts(agg_products(fdf))
    total_portfolio_ca = float(portfolio["CA_HT"].sum()) if not portfolio.empty else 0.0

    opp["PART_PORTEFEUILLE_PCT"] = np.where(total_portfolio_ca > 0, (opp["CA_HT"] / total_portfolio_ca) * 100, np.nan)
    opp["SCORE_OPPORTUNITE"] = (
        opp["POTENTIEL_INDICE"].fillna(0) * 0.55
        + opp["QTE"].rank(ascending=False, pct=True).fillna(0) * 100 * 0.20
        + opp["CA_HT"].rank(ascending=False, pct=True).fillna(0) * 100 * 0.25
    ).round(1)

    def _priority(v):
        if pd.isna(v):
            return "À analyser"
        if v >= 80:
            return "Immédiate"
        if v >= 60:
            return "À travailler"
        return "Secondaire"

    opp["PRIORITE_ACTION"] = opp["SCORE_OPPORTUNITE"].apply(_priority)
    return opp.sort_values(["SCORE_OPPORTUNITE", "CA_HT"], ascending=[False, False]).head(top_n)


@st.cache_data(show_spinner=False)
def build_client_action_plan(fdf: pd.DataFrame, selected_client):
    if selected_client is None or fdf is None or fdf.empty:
        return [], pd.DataFrame()

    client_df = fdf[fdf["TIRCODE"] == selected_client].copy()
    if client_df.empty:
        return [], pd.DataFrame()

    actions = []
    portfolio = fdf.copy()

    ca_client = float(client_df["CA_HT"].sum())
    brut_client = float(client_df["MONTANT_BRUT"].sum())
    abandon_client = float(client_df["abandon_EUR"].sum())
    tx_ab_client = (abandon_client / brut_client * 100) if brut_client > 0 else np.nan

    portfolio_bio_share = 0.0
    portfolio_froid_share = 0.0
    client_bio_share = 0.0
    client_froid_share = 0.0

    if float(portfolio["CA_HT"].sum()) > 0:
        portfolio_bio_share = float(portfolio.loc[portfolio["ARTNATURE_N"] == "biosimilaire", "CA_HT"].sum()) / float(portfolio["CA_HT"].sum()) * 100
        portfolio_froid_share = float(portfolio.loc[portfolio["ARTSOUSFAMILLE_N"] == "froid", "CA_HT"].sum()) / float(portfolio["CA_HT"].sum()) * 100

    if ca_client > 0:
        client_bio_share = float(client_df.loc[client_df["ARTNATURE_N"] == "biosimilaire", "CA_HT"].sum()) / ca_client * 100
        client_froid_share = float(client_df.loc[client_df["ARTSOUSFAMILLE_N"] == "froid", "CA_HT"].sum()) / ca_client * 100

    if pd.notna(tx_ab_client) and tx_ab_client < 3:
        actions.append(f"Taux d'abandon faible ({tx_ab_client:.1f} %) : la marge de ce client est limitée, levier à activer.")
    if client_bio_share + 0.01 < portfolio_bio_share:
        actions.append(f"Développer les biosimilaires : {client_bio_share:.1f} % du CA client vs {portfolio_bio_share:.1f} % portefeuille.")
    if client_froid_share + 0.01 < portfolio_froid_share:
        actions.append(f"Renforcer le froid : {client_froid_share:.1f} % du CA client vs {portfolio_froid_share:.1f} % portefeuille.")

    opp = compute_opportunity_scoring(fdf, selected_client, top_n=10)
    if not opp.empty:
        top_opp = opp.head(3)
        for _, row in top_opp.iterrows():
            actions.append(f"Travailler en priorité le produit '{row['PLVDESIGNATION']}' (score {row['SCORE_OPPORTUNITE']:.1f} — {row['PRIORITE_ACTION']}).")

    months = sorted(client_df["MOIS"].dropna().unique())
    if len(months) >= 2:
        last_m = months[-1]
        prev_m = months[-2]
        ca_cur = float(client_df.loc[client_df["MOIS"] == last_m, "CA_HT"].sum())
        ca_prev = float(client_df.loc[client_df["MOIS"] == prev_m, "CA_HT"].sum())
        var = safe_variation_pct(ca_cur, ca_prev)
        if pd.notna(var) and var <= -10:
            actions.append(f"CA en baisse de {var:.1f} % vs {pd.Timestamp(prev_m).strftime('%b %Y')} : visite recommandée.")

    if not actions:
        actions.append("Client stable : maintenir le suivi et travailler les opportunités produit.")

    plan_df = pd.DataFrame({"Plan d'action recommandé": actions})
    return actions, plan_df


# =========================================================
# SIDEBAR
# =========================================================
with st.sidebar:
    if LOGO_B64:
        st.markdown(
            f'<div style="text-align:center;padding:16px 0 8px 0;">'
            f'<img src="data:image/png;base64,{LOGO_B64}" style="width:72px;border-radius:8px;" /></div>',
            unsafe_allow_html=True,
        )
    st.markdown(
        '<div style="text-align:center;font-family:Barlow Condensed,sans-serif;font-size:1.3rem;'
        'font-weight:900;color:#fff;letter-spacing:0.08em;padding-bottom:4px;">INTÉGRAL ANALYTICS</div>',
        unsafe_allow_html=True,
    )
    st.markdown(
        '<div style="text-align:center;font-size:0.7rem;color:#90B4D8;padding-bottom:12px;'
        'text-transform:uppercase;letter-spacing:0.1em;">Tableau de bord commercial</div>',
        unsafe_allow_html=True,
    )
    st.divider()

    if st.button("🔄 Recharger"):
            st.cache_data.clear()
            st.session_state.pop("filters_applied", None)
            st.rerun()

    st.divider()
    st.markdown(
        '<div style="font-size:0.65rem;color:#90B4D8;text-transform:uppercase;'
        'letter-spacing:0.1em;font-weight:700;margin-bottom:6px;">🎛️ Filtres</div>',
        unsafe_allow_html=True,
    )


# =========================================================
# CHARGEMENT DONNÉES
# =========================================================
files = list_files_in_folder(DATA_DIR)
if not files:
    st.warning(f"⚠️ Aucun fichier trouvé dans : {DATA_DIR}")
    st.stop()

sig = folder_signature(DATA_DIR)
df = load_folder(sig, DATA_DIR)

if df.empty:
    st.warning(f"⚠️ Données introuvables dans : {DATA_DIR}")
    st.stop()


# =========================================================
# EXCLUSION DES SOCIÉTÉS INTERNES / NON COMMERCIALES
# =========================================================

# Sociétés exclues par correspondance EXACTE sur le nom normalisé
# (DIRECT et MSP retirés des contains — trop génériques, risque de faux positifs massifs)
societes_exclues_exact = {
    "INTERMED",
    "PHARMEL",
    "PHARMALAB",
    "MEDICOR",
    "DIRECT",
    "SUD OUEST PHARMA",
    "SANTE VAR SERVICES",
    "OUEST PHARMA SERVICES",
    "MISTRAL SANTE",
    "MSP",
    "HYERES PHARMA",
    "PHARM EXPORT FRANCE",
    "INTER INTERMED",
}

# Sociétés exclues par présence dans le nom — UNIQUEMENT les noms suffisamment
# spécifiques pour ne pas créer de faux positifs.
# ⚠️ "DIRECT" et "MSP" sont volontairement EXCLUS de cette liste : trop courts/génériques,
#    ils élimineraient des pharmacies légitimes dont le nom les contient.
societes_exclues_contains = [
    "INTERMED",
    "PHARMEL",
    "PHARMALAB",
    "MEDICOR",
    "SUD OUEST PHARMA",
    "SANTE VAR SERVICES",
    "OUEST PHARMA SERVICES",
    "MISTRAL SANTE",
    "HYERES PHARMA",
    "PHARM EXPORT FRANCE",
]

def normalize_societe_name(s):
    s = str(s)
    s = s.replace("\u00A0", " ")
    s = s.replace("\n", " ").replace("\r", " ").replace("\t", " ")
    s = " ".join(s.strip().upper().split())
    return s

df["TIRSOCIETE_N"] = df["TIRSOCIETE"].map(normalize_societe_name)

mask_exact = df["TIRSOCIETE_N"].isin(societes_exclues_exact)
mask_contains = df["TIRSOCIETE_N"].apply(
    lambda x: any(term in x for term in societes_exclues_contains)
)

mask_exclusion = mask_exact | mask_contains

df = df[~mask_exclusion].copy()


min_all = df["PCVDATEEFFET"].min()
max_all = df["PCVDATEEFFET"].max()

tvas = sorted([x for x in df["TVATAUX"].dropna().unique()])
collections = sorted([x for x in df["ARTCOLLECTION"].unique() if str(x).strip() not in ["", "#N/A", "nan", "None"]])
natures = sorted([x for x in df["ARTNATURE"].unique() if str(x).strip() not in ["", "#N/A", "nan", "None"]])
familles = sorted([x for x in df["ARTSOUSFAMILLE"].unique() if str(x).strip() not in ["", "#N/A", "nan", "None"]])
commerciaux = sorted([x for x in df["Commercial"].unique() if str(x).strip() not in ["", "#N/A", "nan", "None"]])


# =========================================================
# FORMULAIRE FILTRES (sidebar)
# =========================================================
with st.sidebar:
    default_range = (min_all.date(), max_all.date())
    ensure_date_range_state("flt_period", default_range)

    with st.form("filters_form"):
        try:
            st.date_input(
                "Période",
                min_value=min_all.date(), max_value=max_all.date(),
                format="DD/MM/YYYY", key="flt_period",
            )
        except TypeError:
            st.date_input(
                "Période",
                min_value=min_all.date(), max_value=max_all.date(),
                key="flt_period",
            )

        if len(commerciaux) > 1:
            st.selectbox("Commercial", ["Tous"] + commerciaux, key="flt_commercial_unique")
        elif len(commerciaux) == 1:
            st.selectbox("Commercial", commerciaux, key="flt_commercial_unique")
        else:
            st.selectbox("Commercial", ["Aucun commercial détecté"], key="flt_commercial_unique")
        st.multiselect("TVA", options=tvas, key="flt_tva")
        st.multiselect("Marque (ARTCOLLECTION)", options=collections, key="flt_collection")
        st.multiselect("Nature (ARTNATURE)", options=natures, key="flt_nature")
        st.multiselect("Sous-famille", options=familles, key="flt_famille")

        # --- BOUTON APPLIQUER (AU DESSUS DE PÉRIMÈTRE) ---
        st.divider()
        apply_btn = st.form_submit_button("✅ Appliquer les filtres", width="stretch")
        st.divider()

        # --- PÉRIMÈTRE ET SÉLECTION CLIENT ---
        mode = st.selectbox("Périmètre", ["Tous les clients (portefeuille)", "Un client"], key="flt_client_mode")
        
        if mode == "Un client":
            st.markdown('<div style="font-size:0.65rem;color:#90B4D8;text-transform:uppercase;letter-spacing:0.1em;font-weight:700;margin-top:10px;">🏥 Client (après filtres)</div>', unsafe_allow_html=True)
            c_list = build_client_list(df)
            st.selectbox("Choisir un client", c_list["client_label"].tolist(), key="selected_client_label")

        st.divider()

        st.markdown('<div style="font-size:0.65rem;color:#90B4D8;text-transform:uppercase;letter-spacing:0.1em;font-weight:700;margin-bottom:4px;">Blocs à afficher</div>', unsafe_allow_html=True)
        st.checkbox("🏆 Top produits", value=True, key="opt_top_produits")
        st.checkbox("🧬 Biosimilaires", value=True, key="opt_bio")
        st.checkbox("❄️ Froid", value=True, key="opt_froid")
        if AFFICHER_MODULE_ABANDON:
            st.checkbox("🏷️ Abandons par client", value=True, key="opt_abandons")
        else:
            st.session_state["opt_abandons"] = False
        st.checkbox("📉 Produits en baisse", value=True, key="opt_baisse")
        st.slider("Seuil de baisse (%)", 5, 100, 20, 5, key="opt_baisse_seuil")
        st.checkbox("🧭 Analyse N vs N-1", value=False, key="opt_yoy")
        st.checkbox("🏷️ Analyse laboratoires / marques", value=True, key="opt_marques")
        st.checkbox("🗺️ Priorités de visite", value=True, key="opt_priorites")
        if len(commerciaux) > 1:
            st.checkbox("👨‍💼 Vue commerciaux", value=True, key="opt_commerciaux")
        else:
            st.session_state["opt_commerciaux"] = False
        st.checkbox("📝 Plan d’action client", value=True, key="opt_actions_client")
        st.markdown("---")
        st.checkbox("ℹ️ Afficher les aides", value=False, key="opt_show_help")

    if apply_btn:
        st.session_state["filters_applied"] = True

    if "filters_applied" not in st.session_state:
        st.info("👆 Règle tes filtres puis clique sur Appliquer.")

    if st.session_state.get("opt_show_help", True):
        with st.expander("ℹ️ Aide rapide"):
            st.markdown("""
- **Prix brut** : prix théorique avant abandon de marge.
- **CA HT / prix net** : prix réellement facturé.
- **Abandon de marge** : ce qui a été concédé au client.
- **CA négatif** : présence d'avoirs ; les cellules concernées sont colorées en rouge clair.
- **Évolution %** : calculée sur la base `abs(N-1)` pour rester lisible même en présence d'avoirs.
""")


if "filters_applied" not in st.session_state:
    st.markdown(
        '<div class="dash-title-bar"><div>'
        '<h1>📊 Intégral Analytics</h1>'
        '<p class="dash-subtitle">Tableau de bord commercial — Applique les filtres pour commencer</p>'
        '</div></div>',
        unsafe_allow_html=True,
    )
    st.stop()


# =========================================================
# APPLICATION DES FILTRES
# =========================================================
date_from, date_to = read_date_range(st.session_state.get("flt_period", default_range), default_range)

fdf = df.copy()
fdf = fdf[(fdf["PCVDATEEFFET"].dt.date >= date_from) & (fdf["PCVDATEEFFET"].dt.date <= date_to)]

selected_commercial = st.session_state.get("flt_commercial_unique")
if selected_commercial and selected_commercial not in ["Tous", "Aucun commercial détecté"]:
    fdf = fdf[fdf["Commercial"] == selected_commercial]
if st.session_state.get("flt_tva"):
    fdf = fdf[fdf["TVATAUX"].isin(st.session_state["flt_tva"])]
if st.session_state.get("flt_collection"):
    fdf = fdf[fdf["ARTCOLLECTION"].isin(st.session_state["flt_collection"])]
if st.session_state.get("flt_nature"):
    fdf = fdf[fdf["ARTNATURE"].isin(st.session_state["flt_nature"])]
if st.session_state.get("flt_famille"):
    fdf = fdf[fdf["ARTSOUSFAMILLE"].isin(st.session_state["flt_famille"])]

if fdf.empty:
    st.warning("⚠️ Aucune ligne après filtres. Élargis la période ou enlève un filtre.")
    st.stop()

client_list = build_client_list(fdf)

selected_client = None
selected_client_name = None

# Logique de récupération du client sélectionné
if st.session_state.get("flt_client_mode") == "Un client" and "selected_client_label" in st.session_state:
    selected_label = st.session_state["selected_client_label"]
    c_list_full = build_client_list(fdf)
    cmap = c_list_full.set_index("client_label")[["TIRCODE", "TIRSOCIETE"]].to_dict("index")
    if selected_label in cmap:
        selected_client = cmap[selected_label]["TIRCODE"]
        selected_client_name = cmap[selected_label]["TIRSOCIETE"]

if selected_client is not None and selected_client not in set(fdf["TIRCODE"].astype(str)):
    selected_client = None
    selected_client_name = None

sdf, prod_scope, clients_scope, mois_scope = compute_scope(fdf, selected_client)
clients_enriched = enrich_clients(agg_clients(fdf)) if selected_client is None else pd.DataFrame()
prod_scope_chart = agg_products_for_charts(prod_scope)
period_compare = compute_period_compare(sdf)
yoy_compare = compute_yoy_compare(df, date_from, date_to, selected_client)
opportunities_df = compute_opportunities(fdf, selected_client, top_n=25)
opportunity_scored_df = compute_opportunity_scoring(fdf, selected_client, top_n=25)
brand_scope = agg_brands(sdf)
client_priority_df = compute_client_priority(fdf) if selected_client is None else pd.DataFrame()
commercial_summary_df = compute_commercial_summary(fdf) if selected_client is None else pd.DataFrame()
client_action_items, client_action_plan_df = build_client_action_plan(fdf, selected_client)

if selected_client is None:
    scope_label = "Portefeuille — Tous clients"
    header_txt = "Portefeuille — Tous clients"
else:
    scope_label = f"{selected_client} — {selected_client_name}"
    header_txt = f"{selected_client} — {selected_client_name}"

if selected_client is None and not clients_enriched.empty:
    clients_scope = clients_enriched

# En mode client unique : le tableau/graphique placé au-dessus du titre est supprimé
# pour alléger l'interface et éviter des calculs inutiles.


# =========================================================
# GESTION IMPRESSION (Toujours mode rapport)
# =========================================================
printed_at = datetime.now().strftime("%d/%m/%Y %H:%M")

def _list_or_all(key, label):
    v = st.session_state.get(key, [])
    if not v:
        return f"{label}: Tous"
    if len(v) <= 6:
        return f"{label}: " + ", ".join([str(x) for x in v])
    return f"{label}: {len(v)} valeurs"

filters_summary = " | ".join([
    f"Période: {date_from.strftime('%d/%m/%Y')} → {date_to.strftime('%d/%m/%Y')}",
    (f"Commercial: {st.session_state.get('flt_commercial_unique', 'Tous')}" if st.session_state.get("flt_commercial_unique") not in [None, ""] else "Commercial: Tous"),
    _list_or_all("flt_tva", "TVA"),
    _list_or_all("flt_collection", "Marque"),
    _list_or_all("flt_nature", "Nature"),
    _list_or_all("flt_famille", "Sous-famille"),
])

# Forcer le mode rapport pour l'impression
components.html("<script>parent.document.body.classList.add('report-mode');</script>", height=0)

logo_html = (
    f'<img class="report-logo" src="data:image/png;base64,{LOGO_B64}" />'
    if LOGO_B64
    else '<div style="width:56px;height:56px;border:2px solid #000;display:flex;align-items:center;justify-content:center;font-weight:900;">IP</div>'
)
st.markdown(
    f"""<div class="report-header">
  <div class="report-header__inner">
    <div class="report-left">{logo_html}
      <div><div class="report-title">Rapport CA & Abandons de marge</div>
      <div class="report-sub">{header_txt}</div></div>
    </div>
    <div class="report-right"><div>Édité : {printed_at}</div>
    <div>{date_from.strftime('%d/%m/%Y')} → {date_to.strftime('%d/%m/%Y')}</div></div>
  </div>
  <div class="report-filters">{filters_summary}</div>
</div>
<div class="report-footer">
  <span>Intégral Pharma — Intégral Analytics</span> — <span class="page-number"></span>
</div>""",
    unsafe_allow_html=True,
)


# =========================================================
# TITRE PAGE
# =========================================================
st.markdown(
    f'<div class="dash-title-bar no-print"><div>'
    f'<h1>📊 Intégral Analytics</h1>'
    f'<p class="dash-subtitle">{scope_label} &nbsp;·&nbsp; '
    f'{date_from.strftime("%d/%m/%Y")} → {date_to.strftime("%d/%m/%Y")} &nbsp;·&nbsp; '
    f'{len(fdf):,} lignes · {fdf["TIRCODE"].nunique():,} pharmacies'.replace(",", " ") +
    f'</p></div></div>',
    unsafe_allow_html=True,
)
st.markdown(f'<div class="print-header">{header_txt}</div>', unsafe_allow_html=True)

if st.session_state.get("opt_show_help", True):
    with st.expander("ℹ️ Aide à la lecture du rapport commercial"):
        st.markdown("""
**Prix brut** : prix théorique auquel le pharmacien aurait dû acheter le produit.  
**Prix net / CA HT** : prix réellement facturé après abandon de marge.  
**Abandon de marge** : différence entre le montant brut et le CA HT.  
**Taux d'abandon** : `abandon / montant brut`.

**Évolutions % (hausses / baisses)**  
Les variations sont calculées par la formule :  
`(période actuelle - période précédente) / période précédente × 100`  
Lorsque les deux périodes sont négatives (avoirs des deux côtés), le dénominateur utilisé est la valeur absolue de la période précédente.  
Lorsque la période précédente est négative et la période actuelle positive (reprise d'avoir), le pourcentage est affiché **N/A** car il ne serait pas interprétable.

**CA négatif**  
Un CA négatif signifie qu'il y a eu des **avoirs**. Dans les tableaux, les cellules de CA négatif sont colorées en **rouge clair**.

**Tranche de prix**  
Les tranches sont:
- `< 4,33 €`
- `4,33 – 468,97 €`
- `468,97 € – 1500 €`
- `> 1500 €`

Le tableau "Abandon par tranche de prix" est **hors génériques** et exclut les abandons non significatifs (< 0,03 €).
""")

# =========================================================
# COMPARATIF N VS N-1
# =========================================================
if st.session_state.get("opt_yoy", True) and yoy_compare:
    st.markdown('<div class="section-header print-block">🧭 Comparatif N vs N-1</div>', unsafe_allow_html=True)
    if st.session_state.get("opt_show_help", True):
        with st.expander("ℹ️ Aide – Comparatif N vs N-1"):
            st.markdown("""
**Principe** : compare exactement la même fenêtre temporelle entre l'année en cours (N) et l'année précédente (N-1).  
Par exemple, si tu filtres sur janvier–mars 2024, la comparaison se fera automatiquement avec janvier–mars 2023.

- **CA HT** : chiffre d'affaires net facturé sur la période N vs N-1.  
- **Abandon de marge** : montant total de marge accordé aux pharmaciens ; une hausse est un signal positif (flèche verte).  
- **Volume** : nombre d'unités vendues sur la période.  
- **Taux d'abandon** : exprimé en points de % ; une hausse signifie que la marge accordée aux pharmaciens augmente — c'est favorable.  

👉 Les flèches **vertes** indiquent une évolution favorable, les flèches **rouges** une dégradation.  
👉 **N/A** s'affiche si la période N-1 était nulle ou négative (cas d'avoirs) — la variation n'est pas interprétable.
""")
    yc1, yc2, yc3, yc4 = st.columns(4, gap="small")

    def _delta_html(val, suffix="%", invert=False):
        if pd.isna(val):
            return '<span style="color:#64748b;font-weight:700;">N/A</span>'
        good = val >= 0 if not invert else val <= 0
        color = "#27AE60" if good else "#E8440A"
        arrow = "▲" if good else "▼"
        return f'<span style="color:{color};font-weight:800;">{arrow} {val:.1f} {suffix}</span>'

    for col, title, value, delta, suffix, invert in [
        (yc1, "CA HT", format_eur(yoy_compare.get("ca_current")), yoy_compare.get("ca_var_pct"), "%", False),
        (yc2, "Abandon de marge", format_eur(yoy_compare.get("ab_current")), yoy_compare.get("ab_var_pct"), "%", False),
        (yc3, "Volume", format_int(yoy_compare.get("qte_current")), yoy_compare.get("qte_var_pct"), "%", False),
        (yc4, "Taux d'abandon", f"{(yoy_compare.get('tx_current') or 0):.1f} %", yoy_compare.get("tx_var_pts"), "pts", False),
    ]:
        with col:
            st.markdown(
                '<div class="chart-card">'
                f'<div class="chart-card-title">{title}</div>'
                f'<div style="font-family:Barlow Condensed,sans-serif;font-size:1.35rem;font-weight:900;color:{COLOR_SECONDARY};">{value}</div>'
                f'<div style="margin-top:4px;font-size:0.85rem;">{_delta_html(delta, suffix=suffix, invert=invert)}</div>'
                f'<div style="margin-top:6px;font-size:0.72rem;color:#64748b;">vs {yoy_compare["previous_start"].strftime("%d/%m/%Y")} → {yoy_compare["previous_end"].strftime("%d/%m/%Y")}</div>'
                '</div>',
                unsafe_allow_html=True,
            )


# =========================================================
# KPI CARDS
# =========================================================
ca_total        = float(sdf["CA_HT"].sum(skipna=True))
brut_total      = float(sdf["MONTANT_BRUT"].sum(skipna=True))
abandon_total   = float(sdf["abandon_EUR"].sum(skipna=True))
taux_abandon_g  = (abandon_total / brut_total) if brut_total > 0 else np.nan
nb_pharmacies   = int(sdf["TIRCODE"].nunique())
nb_factures     = int(sdf["PCVNUM"].nunique())
panier_moyen    = (ca_total / nb_factures) if nb_factures else np.nan
part_biosim     = (float(sdf.loc[sdf["EST_BIOSIM"], "CA_HT"].sum()) / ca_total) if ca_total else np.nan

kpi_data = [
    ("💰", "CA HT",              format_eur(ca_total),              COLOR_KPI[0]),
    ("📦", "Montant Brut",       format_eur(brut_total),            COLOR_KPI[1]),
    ("📉", "Abandon de marge",   format_eur(abandon_total),         COLOR_KPI[2]),
    ("📊", "Taux d'abandon",     format_pct_ratio(taux_abandon_g),  COLOR_KPI[3]),
    ("🧾", "Panier moyen",       format_eur(panier_moyen),          COLOR_KPI[4]),
    ("🧬", "Part biosim",        format_pct_ratio(part_biosim),     COLOR_KPI[5]),
]

kpi_html = '<div class="kpi-grid">'
for icon, label, value, color in kpi_data:
    kpi_html += f"""
    <div class="kpi-card" style="background: linear-gradient(135deg, {color} 0%, {color}CC 100%);">
        <span class="kpi-icon">{icon}</span>
        <div class="kpi-label">{label}</div>
        <div class="kpi-value">{value}</div>
    </div>"""
kpi_html += "</div>"
st.markdown(kpi_html, unsafe_allow_html=True)

# =========================================================
# ALERTES & SYNTHÈSE RAPIDE V2
# =========================================================
alerts = []
if pd.notna(taux_abandon_g) and taux_abandon_g * 100 < 3:
    alerts.append(("🔴 Alerte marge", f"Taux d'abandon global faible : {taux_abandon_g*100:.1f} % — la marge accordée aux pharmaciens est limitée."))
if period_compare:
    if pd.notna(period_compare.get("ca_var_pct")) and period_compare["ca_var_pct"] <= -10:
        alerts.append(("🟠 Alerte CA", f"CA en baisse de {period_compare['ca_var_pct']:.1f} % vs {period_compare['prev_month'].strftime('%b %Y')}"))
    if pd.notna(period_compare.get("tx_var_pts")) and period_compare["tx_var_pts"] <= -2:
        alerts.append(("🟠 Alerte marge en recul", f"Le taux d'abandon recule de {abs(period_compare['tx_var_pts']):.1f} points — la marge accordée aux pharmaciens diminue."))

# =========================================================
# TAUX D'ABANDON PAR TRANCHE DE PRIX (calcul)
# =========================================================
bins   = [-np.inf, 4.63, 501.47, 1532.5, np.inf]
labels = ["< 4,33 €", "4,33 – 468,97 €", "468,97 € – 1500 €", "> 1500 €"]

tmp_tab = sdf.copy()
nature_exclues = {"generique", "generique partenaire"}
tmp_nat = tmp_tab["ARTNATURE"].astype(str).str.strip().str.lower()
tmp_tab = tmp_tab[~tmp_nat.isin(nature_exclues)].copy()
tmp_tab = tmp_tab[tmp_tab["abandon_EUR"] >= 0.03].copy()
tmp_tab["TRANCHE_PRIX"] = pd.cut(tmp_tab["PLVPUBRUT"], bins=bins, labels=labels, right=True, include_lowest=True)

tr_table = (
    tmp_tab.groupby("TRANCHE_PRIX", as_index=False, observed=True)
    .agg(BRUT=("MONTANT_BRUT", "sum"), NET=("CA_HT", "sum"), abandon_EUR=("abandon_EUR", "sum"))
)
tr_table["taux_abandon_ratio"] = np.where(tr_table["BRUT"] != 0, tr_table["abandon_EUR"] / tr_table["BRUT"], np.nan)
tr_table["TRANCHE_PRIX"] = pd.Categorical(tr_table["TRANCHE_PRIX"], categories=labels, ordered=True)
tr_table = tr_table.sort_values("TRANCHE_PRIX").reset_index(drop=True)

if alerts or period_compare:
    st.markdown('<div class="section-header">🔍 Répartition & Analyse</div>', unsafe_allow_html=True)
    if st.session_state.get("opt_show_help", True):
        with st.expander("ℹ️ Aide – Synthèse rapide & alertes"):
            st.markdown("""
Cette section signale automatiquement les anomalies détectées sur le périmètre filtré.

- 🔴 **Alerte marge** : déclenchée si le taux d'abandon global est **inférieur à 3 %** — la marge accordée aux pharmaciens est trop faible, c'est un levier commercial à activer.  
- 🟠 **Alerte CA** : déclenchée si le CA net est en baisse de plus de **10 %** par rapport au mois précédent.  
- 🟠 **Alerte marge en recul** : déclenchée si le taux d'abandon recule de plus de **2 points** d'un mois sur l'autre — la marge accordée aux pharmaciens diminue.

👉 En l'absence d'alerte, un message vert confirme que le périmètre est dans les normes.
""")
    c_syn2, c_syn3 = st.columns([1, 1.1], gap="medium")
    with c_syn2:
        st.markdown('<div class="section-header">📉 Abandon par tranche de prix (hors générique)</div>', unsafe_allow_html=True)
        if st.session_state.get("opt_show_help", True):
            with st.expander("ℹ️ Aide – Abandon par tranche de prix"):
                st.markdown("""
Ce tableau ventile l'abandon de marge selon 4 tranches de prix d'achat grossiste :

- **< 4,63 €** : petits prix.  
- **4,63 – 501,47 €** : prix médians.  
- **501,47 € – 1500 €** : prix élevés.  
- **> 1500 €** : très hauts prix (spécialités, biologiques…).

**Colonnes :**  
- **CA HT (€)** : chiffre d'affaires net facturé sur la tranche.  
- **Abandon (€)** : marge accordée sur la tranche.  
- **Taux** : abandon / brut. 🟢 > 6 % · 🔴 < 3 %.
""")
        st.markdown('<div class="chart-card">', unsafe_allow_html=True)
        if not tr_table.empty:
            rows_html = ""
            for _, row in tr_table.iterrows():
                pct_val = row["taux_abandon_ratio"]
                pct_str = format_pct_ratio(pct_val)
                pct_color = "#C0392B" if pct_val < 0.03 else ("#1E8449" if pct_val > 0.06 else "#64748b")
                rows_html += f"""
                <tr>
                    <td style="padding:4px 8px;font-weight:600;color:#1E3A5F;font-size:1.5rem;">{row['TRANCHE_PRIX']}</td>
                    <td style="padding:4px 8px;text-align:right;font-size:1.5rem;">{row['NET']:,.0f} €</td>
                    <td style="padding:4px 8px;text-align:right;font-size:1.5rem;">{row['abandon_EUR']:,.0f} €</td>
                    <td style="padding:4px 8px;text-align:right;font-weight:700;color:{pct_color};font-size:1.6rem;">{pct_str}</td>
                </tr>"""
            st.markdown(f"""
            <table style="width:100%;border-collapse:collapse;font-family:'Barlow',sans-serif;font-size:1.5rem;">
              <thead>
                <tr style="background:#1E3A5F;color:#fff;">
                  <th style="padding:4px 8px;text-align:left;">Tranche</th>
                  <th style="padding:4px 8px;text-align:right;">CA HT</th>
                  <th style="padding:4px 8px;text-align:right;">Abandon</th>
                  <th style="padding:4px 8px;text-align:right;">Taux</th>
                </tr>
              </thead>
              <tbody style="background:#fff;">{rows_html}</tbody>
            </table>
            """, unsafe_allow_html=True)
        st.markdown("</div>", unsafe_allow_html=True)

    with c_syn3:
        st.markdown('<div style="margin-top:5.5rem;"></div>', unsafe_allow_html=True)
        # --- Tableau répartition CA ---
        # Calcul pour le périmètre actuel (client seul si sélectionné, sinon portefeuille)
        ca_total_syn = float(sdf["CA_HT"].sum(skipna=True)) if not sdf.empty else 0.0

        _froid_mask   = sdf["EST_FROID"] if not sdf.empty else pd.Series(dtype=bool)
        _biosim_mask  = sdf["EST_BIOSIM"] if not sdf.empty else pd.Series(dtype=bool)
        _genpart_mask = norm_text(sdf["ARTNATURE"]).str.lower().eq("generique partenaire") if not sdf.empty else pd.Series(dtype=bool)

        ca_froid   = float(sdf.loc[_froid_mask,   "CA_HT"].sum()) if not sdf.empty else 0.0
        ca_biosim  = float(sdf.loc[_biosim_mask,  "CA_HT"].sum()) if not sdf.empty else 0.0
        ca_genpart = float(sdf.loc[_genpart_mask, "CA_HT"].sum()) if not sdf.empty else 0.0
        ca_autres  = ca_total_syn - ca_froid - ca_biosim - ca_genpart

        # Calcul pour le portefeuille du commercial (fdf = déjà filtré par commercial)
        # On affiche la comparaison dès qu'un client est sélectionné ET que fdf contient
        # plus de lignes que sdf (le portefeuille est plus large que le client seul)
        _show_portfolio_compare = (
            selected_client is not None
            and not fdf.empty
            and len(fdf) > len(sdf)
        )

        if _show_portfolio_compare:
            ca_total_port = float(fdf["CA_HT"].sum(skipna=True)) if not fdf.empty else 0.0
            _froid_mask_p   = fdf["EST_FROID"] if not fdf.empty else pd.Series(dtype=bool)
            _biosim_mask_p  = fdf["EST_BIOSIM"] if not fdf.empty else pd.Series(dtype=bool)
            _genpart_mask_p = norm_text(fdf["ARTNATURE"]).str.lower().eq("generique partenaire") if not fdf.empty else pd.Series(dtype=bool)
            ca_froid_p   = float(fdf.loc[_froid_mask_p,   "CA_HT"].sum()) if not fdf.empty else 0.0
            ca_biosim_p  = float(fdf.loc[_biosim_mask_p,  "CA_HT"].sum()) if not fdf.empty else 0.0
            ca_genpart_p = float(fdf.loc[_genpart_mask_p, "CA_HT"].sum()) if not fdf.empty else 0.0
            ca_autres_p  = ca_total_port - ca_froid_p - ca_biosim_p - ca_genpart_p

        def _pct_bar(val, total, color):
            pct = (val / total * 100) if total else 0.0
            bar_w = max(0, min(100, pct))
            return (
                f'<td style="padding:4px 8px;text-align:right;font-weight:700;color:{COLOR_SECONDARY};">{format_eur(val)}</td>'
                f'<td style="padding:4px 8px;text-align:right;color:#64748b;font-size:0.75rem;">{pct:.1f} %</td>'
                f'<td style="padding:4px 8px;width:70px;">'
                f'<div style="background:#E8EEF5;border-radius:3px;height:8px;width:70px;">'
                f'<div style="background:{color};border-radius:3px;height:8px;width:{bar_w:.0f}%;"></div>'
                f'</div></td>'
            )

        def _pct_only(val, total):
            pct = (val / total * 100) if total else 0.0
            return f'<td style="padding:4px 8px;text-align:right;color:#64748b;font-size:0.75rem;">{pct:.1f} %</td>'

        # Segments complémentaires SANOFI / UPSA à partir du fichier SANO-UPSA 26.xlsx
        artcode_series = sdf["ARTCODE"].astype(str).str.replace(r"\.0$", "", regex=True).str.strip() if not sdf.empty else pd.Series(dtype=str)
        ca_sanofi = float(sdf.loc[artcode_series.isin(LISTE_SANOFI), "CA_HT"].sum()) if not sdf.empty and LISTE_SANOFI else 0.0
        ca_upsa = float(sdf.loc[artcode_series.isin(LISTE_UPSA), "CA_HT"].sum()) if not sdf.empty and LISTE_UPSA else 0.0

        if _show_portfolio_compare:
            artcode_series_p = fdf["ARTCODE"].astype(str).str.replace(r"\.0$", "", regex=True).str.strip() if not fdf.empty else pd.Series(dtype=str)
            ca_sanofi_p = float(fdf.loc[artcode_series_p.isin(LISTE_SANOFI), "CA_HT"].sum()) if not fdf.empty and LISTE_SANOFI else 0.0
            ca_upsa_p = float(fdf.loc[artcode_series_p.isin(LISTE_UPSA), "CA_HT"].sum()) if not fdf.empty and LISTE_UPSA else 0.0

        # Parts nationales de référence (source : tableau national)
        NATIONAL_PARTS = {
            "❄️ Froid":                  39.6,
            "🤝 Génériques partenaires": 3.6,
            "🧬 Biosimilaires":          3.6,
            "📦 Autres Total":           53.2,
            "🟠 Autres SANOFI":          4.0,
            "🔵 Autres  UPSA":           0.3,
        }

        segments_data = [
            ("❄️ Froid",                  ca_froid,   "#2980B9", ca_froid_p   if _show_portfolio_compare else None),
            ("🤝 Génériques partenaires", ca_genpart, "#27AE60", ca_genpart_p if _show_portfolio_compare else None),
            ("🧬 Biosimilaires",          ca_biosim,  "#8E44AD", ca_biosim_p  if _show_portfolio_compare else None),
            ("📦 Autres Total",           ca_autres,  "#95A5A6", ca_autres_p  if _show_portfolio_compare else None),
            ("🟠 Autres SANOFI",          ca_sanofi,  "#D35400", ca_sanofi_p  if _show_portfolio_compare else None),
            ("🔵 Autres  UPSA",           ca_upsa,    "#3498DB", ca_upsa_p    if _show_portfolio_compare else None),
        ]

        def _ecart_national(pct_local, label):
            nat = NATIONAL_PARTS.get(label, None)
            if nat is None:
                return "<td></td>"
            delta = pct_local - nat
            if abs(delta) < 0.1:
                color, sign = "#64748b", "="
            elif delta > 0:
                color, sign = "#1E8449", f"+{delta:.1f} pts"
            else:
                color, sign = "#C0392B", f"{delta:.1f} pts"
            return (
                f'<td style="padding:4px 8px;text-align:right;font-size:0.72rem;font-weight:700;color:{color};">'
                f'{nat:.1f} %&nbsp;<span style="font-size:0.68rem;">({sign})</span></td>'
            )

        if _show_portfolio_compare:
            # Tableau avec colonne client + colonne portefeuille commercial
            header_extra = (
                f"<th style='padding:4px 8px;text-align:right;color:#E8440A;font-size:0.7rem;text-transform:uppercase;letter-spacing:0.05em;' colspan='3'>"
                f"Client</th>"
                f"<th style='padding:4px 8px;text-align:right;color:#1E3A5F;font-size:0.7rem;text-transform:uppercase;letter-spacing:0.05em;' colspan='2'>"
                f"Portefeuille {selected_commercial if selected_commercial and selected_commercial not in ['Tous', 'Aucun commercial détecté'] else 'complet'}</th>"
                f"<th style='padding:4px 8px;text-align:right;color:#7D3C98;font-size:0.7rem;text-transform:uppercase;letter-spacing:0.05em;'>"
                f"National (écart)</th>"
            )
            rows_syn = ""
            for label, val, color, val_p in segments_data:
                pct_local = (val / ca_total_syn * 100) if ca_total_syn else 0.0
                rows_syn += (
                    f'<tr style="border-bottom:1px solid #F0F4FA;">'
                    f'<td style="padding:4px 8px;font-weight:600;color:#1E3A5F;white-space:nowrap;">{label}</td>'
                    + _pct_bar(val, ca_total_syn, color)
                    + _pct_only(val_p, ca_total_port)
                    + f'<td style="padding:4px 8px;text-align:right;font-weight:600;color:#1E3A5F;font-size:0.75rem;">{format_eur(val_p)}</td>'
                    + _ecart_national(pct_local, label)
                    + f'</tr>'
                )
            footer_html = (
                f"<div style='margin-top:6px;font-size:0.7rem;color:#64748b;display:flex;justify-content:space-between;'>"
                f"<span>Client : <b>{format_eur(ca_total_syn)}</b></span>"
                f"<span>Portefeuille : <b>{format_eur(ca_total_port)}</b></span>"
                f"</div>"
            )
            st.markdown(
                f"<div class='chart-card'>"
                f"<div class='chart-card-title'>Répartition du CA HT — Client vs Portefeuille</div>"
                f"<table style='width:100%;border-collapse:collapse;font-family:Barlow,sans-serif;font-size:0.78rem;'>"
                f"<thead><tr style='background:#F7F9FC;'>"
                f"<th style='padding:4px 8px;text-align:left;color:#64748b;font-size:0.7rem;text-transform:uppercase;letter-spacing:0.05em;'>Segment</th>"
                f"{header_extra}"
                f"</tr></thead>"
                f"<tbody>{rows_syn}</tbody>"
                f"</table>"
                f"{footer_html}"
                f"</div>",
                unsafe_allow_html=True,
            )
        else:
            # Tableau simple (pas de commercial sélectionné ou pas de client sélectionné)
            rows_syn = ""
            for label, val, color, _ in segments_data:
                pct_local = (val / ca_total_syn * 100) if ca_total_syn else 0.0
                rows_syn += (
                    f'<tr style="border-bottom:1px solid #F0F4FA;">'
                    f'<td style="padding:4px 8px;font-weight:600;color:#1E3A5F;white-space:nowrap;">{label}</td>'
                    + _pct_bar(val, ca_total_syn, color)
                    + _ecart_national(pct_local, label)
                    + f'</tr>'
                )
            st.markdown(
                f"<div class='chart-card'>"
                f"<div class='chart-card-title'>Répartition du CA HT</div>"
                f"<table style='width:100%;border-collapse:collapse;font-family:Barlow,sans-serif;font-size:0.8rem;'>"
                f"<thead><tr style='background:#F7F9FC;'>"
                f"<th style='padding:4px 8px;text-align:left;color:#64748b;font-size:0.7rem;text-transform:uppercase;letter-spacing:0.05em;'>Segment</th>"
                f"<th style='padding:4px 8px;text-align:right;color:#64748b;font-size:0.7rem;text-transform:uppercase;letter-spacing:0.05em;'>CA HT</th>"
                f"<th style='padding:4px 8px;text-align:right;color:#64748b;font-size:0.7rem;text-transform:uppercase;letter-spacing:0.05em;'>Part</th>"
                f"<th style='padding:4px 8px;color:#64748b;font-size:0.7rem;'></th>"
                f"<th style='padding:4px 8px;text-align:right;color:#7D3C98;font-size:0.7rem;text-transform:uppercase;letter-spacing:0.05em;'>National (écart)</th>"
                f"</tr></thead>"
                f"<tbody>{rows_syn}</tbody>"
                f"</table>"
                f"<div style='margin-top:6px;font-size:0.7rem;color:#64748b;text-align:right;'>Total : <b>{format_eur(ca_total_syn)}</b></div>"
                f"</div>",
                unsafe_allow_html=True,
            )


# =========================================================
# VENTILATION CROISÉE : Tranche de prix × Catégorie produit
# Croisement 2 axes : tranche_prix (bin PLVPUBRUT) × catégorie au choix.
# Toutes les métriques cellulaires sont dérivables (CA HT, abandon €, taux, qté, lignes).
# Respect des filtres globaux (sdf est déjà filtré période/commercial/TVA/marque/nature/sous-famille/client).
# =========================================================
st.markdown('<div class="section-header">🎯 Ventilation tranche × catégorie</div>', unsafe_allow_html=True)
if st.session_state.get("opt_show_help", True):
    with st.expander("ℹ️ Aide – Ventilation tranche × catégorie"):
        st.markdown("""
Affine l'analyse en croisant deux axes : **tranche de prix unitaire** × **catégorie produit**.

- **Tranche prix** : bins du PLVPUBRUT (prix unitaire brut). Tu peux passer en mode personnalisé pour ajuster le nombre de tranches ou les bornes.
- **Axe catégorie** : choisis parmi ARTNATURE (par défaut), ARTSOUSFAMILLE, ARTCOLLECTION (marque), ou le segment métier (Froid · Biosimilaires · Génériques partenaires · Autres).
- **Métrique** : CA HT, Abandon €, Taux abandon %, Qté, Nb lignes.
- **Heatmap** : colorisation conditionnelle pour repérer les poches de marge perdue.
- **Totaux** : ligne et colonne pour cross-check (somme cellules ⇄ tableau tranche global).
""")

# ─── Sélecteurs ──────────────────────────────────────────
c_vent1, c_vent2, c_vent3, c_vent4 = st.columns([1, 1, 1, 1], gap="small")

with c_vent1:
    axe_cat = st.selectbox(
        "Axe catégorie",
        options=["ARTNATURE", "ARTSOUSFAMILLE", "ARTCOLLECTION", "Segment métier"],
        index=0,
        key="vent_axe_cat",
    )

with c_vent2:
    metrique = st.selectbox(
        "Métrique",
        options=["CA HT", "Abandon €", "Taux abandon %", "Qté", "Nb lignes"],
        index=0,
        key="vent_metrique",
    )

with c_vent3:
    mode_tranches = st.selectbox(
        "Tranches de prix",
        options=["4 tranches (par défaut)", "3 tranches", "5 tranches", "6 tranches", "Personnalisé"],
        index=0,
        key="vent_mode_tranches",
    )

with c_vent4:
    afficher_heatmap = st.checkbox("Heatmap taux abandon", value=True, key="vent_heatmap")

# ─── Définition des tranches ─────────────────────────────
DEFAULT_BINS = [-np.inf, 4.63, 501.47, 1532.5, np.inf]
DEFAULT_LABELS = ["< 4,63 €", "4,63 – 501,47 €", "501,47 € – 1 500 €", "> 1 500 €"]

if mode_tranches == "4 tranches (par défaut)":
    vent_bins, vent_labels = DEFAULT_BINS, DEFAULT_LABELS
elif mode_tranches == "3 tranches":
    vent_bins = [-np.inf, 10, 500, np.inf]
    vent_labels = ["< 10 €", "10 – 500 €", "> 500 €"]
elif mode_tranches == "5 tranches":
    vent_bins = [-np.inf, 4.63, 50, 501.47, 1500, np.inf]
    vent_labels = ["< 4,63 €", "4,63 – 50 €", "50 – 501,47 €", "501,47 – 1 500 €", "> 1 500 €"]
elif mode_tranches == "6 tranches":
    vent_bins = [-np.inf, 4.63, 20, 100, 501.47, 1500, np.inf]
    vent_labels = ["< 4,63 €", "4,63 – 20 €", "20 – 100 €", "100 – 501,47 €", "501,47 – 1 500 €", "> 1 500 €"]
else:  # Personnalisé
    bornes_str = st.text_input(
        "Bornes (séparées par des virgules, en €) — ex : 5, 50, 500, 2000",
        value="5, 50, 500, 2000",
        key="vent_bornes_custom",
    )
    try:
        bornes_custom = sorted([float(b.strip()) for b in bornes_str.split(",") if b.strip()])
        vent_bins = [-np.inf] + bornes_custom + [np.inf]
        vent_labels = []
        for i in range(len(vent_bins) - 1):
            a, b = vent_bins[i], vent_bins[i + 1]
            if a == -np.inf:
                vent_labels.append(f"< {b:g} €")
            elif b == np.inf:
                vent_labels.append(f"> {a:g} €")
            else:
                vent_labels.append(f"{a:g} – {b:g} €")
    except (ValueError, AttributeError):
        st.warning("Bornes invalides — fallback sur 4 tranches par défaut.")
        vent_bins, vent_labels = DEFAULT_BINS, DEFAULT_LABELS

# ─── Construction du DataFrame ventilé ───────────────────
def _build_vent_df(base_df, axe, bins, labels):
    """Construit le DF avec colonnes TRANCHE_PRIX et CATEGORIE_AXE."""
    if base_df.empty:
        return pd.DataFrame(columns=["TRANCHE_PRIX", "CATEGORIE_AXE", "CA_HT", "MONTANT_BRUT", "abandon_EUR", "QTE", "LIGNES"])
    df = base_df.copy()
    df["TRANCHE_PRIX"] = pd.cut(df["PLVPUBRUT"], bins=bins, labels=labels, right=True, include_lowest=True)
    if axe == "Segment métier":
        # Priorité : Biosim > Froid > Gén. partenaire > Autres
        nat_lower = df["ARTNATURE"].astype(str).str.strip().str.lower()
        sf_lower = df["ARTSOUSFAMILLE"].astype(str).str.strip().str.lower()
        seg = np.where(nat_lower.eq("biosimilaire"), "Biosimilaires",
              np.where(sf_lower.eq("froid"), "Froid",
              np.where(nat_lower.eq("generique partenaire"), "Génériques partenaires", "Autres")))
        df["CATEGORIE_AXE"] = seg
    else:
        df["CATEGORIE_AXE"] = df[axe].astype(str).str.strip()
        df.loc[df["CATEGORIE_AXE"].isin(["", "nan", "None", "#N/A"]), "CATEGORIE_AXE"] = "(non renseigné)"
    return df

vent_df = _build_vent_df(sdf, axe_cat, vent_bins, vent_labels)

# Agrégats cellulaires (toutes métriques calculées une fois, on pivote ensuite)
if vent_df.empty:
    st.info("Aucune donnée sur le périmètre filtré.")
else:
    cell_agg = (
        vent_df.groupby(["TRANCHE_PRIX", "CATEGORIE_AXE"], observed=True, as_index=False)
        .agg(
            CA_HT=("CA_HT", "sum"),
            MONTANT_BRUT=("MONTANT_BRUT", "sum"),
            abandon_EUR=("abandon_EUR", "sum"),
            QTE=("PLVQTE", "sum"),
            LIGNES=("CA_HT", "count"),
        )
    )
    cell_agg["TAUX_ABANDON_PCT"] = np.where(
        cell_agg["MONTANT_BRUT"] != 0,
        (cell_agg["abandon_EUR"] / cell_agg["MONTANT_BRUT"]) * 100,
        np.nan,
    )

    # Mapping métrique → colonne
    metric_col_map = {
        "CA HT": ("CA_HT", lambda x: f"{x:,.0f} €" if pd.notna(x) else "—"),
        "Abandon €": ("abandon_EUR", lambda x: f"{x:,.0f} €" if pd.notna(x) else "—"),
        "Taux abandon %": ("TAUX_ABANDON_PCT", lambda x: f"{x:.1f} %" if pd.notna(x) else "—"),
        "Qté": ("QTE", lambda x: f"{x:,.0f}" if pd.notna(x) else "—"),
        "Nb lignes": ("LIGNES", lambda x: f"{x:,.0f}" if pd.notna(x) else "—"),
    }
    metric_col, metric_fmt = metric_col_map[metrique]

    # ─── Pivot table (cellules + totaux ligne/colonne) ───────
    pivot = cell_agg.pivot_table(
        index="TRANCHE_PRIX",
        columns="CATEGORIE_AXE",
        values=metric_col,
        aggfunc="sum" if metric_col != "TAUX_ABANDON_PCT" else "mean",
        observed=True,
    )
    # Réordonne tranches selon labels (ordre logique de prix)
    pivot = pivot.reindex(vent_labels).dropna(how="all")
    # Tri colonnes par CA total desc
    if metric_col == "TAUX_ABANDON_PCT":
        # Pour le taux on garde l'ordre par CA pour la lisibilité
        ca_pivot = cell_agg.pivot_table(index="TRANCHE_PRIX", columns="CATEGORIE_AXE", values="CA_HT", aggfunc="sum", observed=True).reindex(vent_labels).dropna(how="all")
        col_order = ca_pivot.sum(axis=0).sort_values(ascending=False).index.tolist()
    else:
        col_order = pivot.sum(axis=0).sort_values(ascending=False).index.tolist()
    pivot = pivot.reindex(columns=col_order)

    # Totaux
    if metric_col == "TAUX_ABANDON_PCT":
        # Taux pondéré par BRUT
        brut_pivot = cell_agg.pivot_table(index="TRANCHE_PRIX", columns="CATEGORIE_AXE", values="MONTANT_BRUT", aggfunc="sum", observed=True).reindex(vent_labels).reindex(columns=col_order)
        ab_pivot = cell_agg.pivot_table(index="TRANCHE_PRIX", columns="CATEGORIE_AXE", values="abandon_EUR", aggfunc="sum", observed=True).reindex(vent_labels).reindex(columns=col_order)
        total_col = np.where(brut_pivot.sum(axis=1) != 0, (ab_pivot.sum(axis=1) / brut_pivot.sum(axis=1)) * 100, np.nan)
        total_row = np.where(brut_pivot.sum(axis=0) != 0, (ab_pivot.sum(axis=0) / brut_pivot.sum(axis=0)) * 100, np.nan)
        grand_total = (ab_pivot.values.sum() / brut_pivot.values.sum() * 100) if brut_pivot.values.sum() != 0 else np.nan
    else:
        total_col = pivot.sum(axis=1)
        total_row = pivot.sum(axis=0)
        grand_total = pivot.values.sum() if pd.notna(pivot.values).any() else np.nan

    # ─── Rendu Streamlit ─────────────────────────────────────
    st.markdown(f"**Métrique affichée :** {metrique} · **Axe catégorie :** {axe_cat} · {len(vent_labels)} tranches")

    if afficher_heatmap and metric_col == "TAUX_ABANDON_PCT":
        # Heatmap dédié taux d'abandon — Plotly imshow
        z_vals = pivot.values
        # Échelle : <3% rouge, 3-6% gris, >6% vert
        fig_heat = go.Figure(data=go.Heatmap(
            z=z_vals,
            x=pivot.columns.tolist(),
            y=pivot.index.tolist(),
            colorscale=[[0, "#C0392B"], [0.3, "#F1948A"], [0.5, "#F4D03F"], [0.7, "#82E0AA"], [1, "#1E8449"]],
            zmin=0, zmax=15,
            colorbar=dict(title="Taux %", tickformat=".1f"),
            text=[[f"{v:.1f}%" if pd.notna(v) else "—" for v in row] for row in z_vals],
            texttemplate="%{text}",
            textfont={"size": 12, "color": "#1E3A5F"},
            hovertemplate="Tranche : %{y}<br>Catégorie : %{x}<br>Taux abandon : %{z:.2f} %<extra></extra>",
        ))
        fig_heat.update_layout(
            height=380,
            margin=dict(t=10, b=10, l=10, r=10),
            xaxis=dict(side="bottom", tickangle=-25),
            yaxis=dict(autorange="reversed"),
            font=dict(family="Barlow, sans-serif", size=12),
        )
        st.plotly_chart(fig_heat, width="stretch", config={"displayModeBar": False})

    # Tableau croisé formaté
    display_df = pivot.copy().astype(object)
    for c in display_df.columns:
        display_df[c] = display_df[c].apply(lambda v: metric_fmt(v) if pd.notna(v) else "—")
    # Ajoute colonne Total ligne
    display_df["Total ligne"] = [metric_fmt(v) if pd.notna(v) else "—" for v in total_col]
    # Ajoute ligne Total colonne
    total_row_formatted = [metric_fmt(v) if pd.notna(v) else "—" for v in total_row]
    total_row_formatted.append(metric_fmt(grand_total) if pd.notna(grand_total) else "—")
    display_df.loc["Total colonne"] = total_row_formatted

    st.dataframe(
        display_df,
        width="stretch",
        height=min(80 + 38 * len(display_df), 520),
    )

    # ─── Modules existants déclinés par catégorie (filtre additionnel) ────
    st.markdown('<div class="section-header" style="margin-top:1.5rem">🔎 Drill-down par catégorie</div>', unsafe_allow_html=True)

    cats_available = ["(toutes)"] + sorted([c for c in pivot.columns.tolist() if c not in ["(non renseigné)", "(toutes)"]])
    cat_filter = st.selectbox(
        "Filtrer les modules ci-dessous par catégorie",
        options=cats_available,
        index=0,
        key="vent_cat_filter_drill",
    )

    if cat_filter != "(toutes)":
        # Sous-périmètre filtré sur la catégorie sélectionnée
        if axe_cat == "Segment métier":
            sub_df = vent_df[vent_df["CATEGORIE_AXE"] == cat_filter]
        else:
            sub_df = vent_df[vent_df["CATEGORIE_AXE"] == cat_filter]
    else:
        sub_df = vent_df

    if sub_df.empty:
        st.info(f"Aucune ligne pour la catégorie **{cat_filter}**.")
    else:
        # KPI rapide sur le sous-périmètre
        sub_ca = float(sub_df["CA_HT"].sum())
        sub_brut = float(sub_df["MONTANT_BRUT"].sum())
        sub_abandon = float(sub_df["abandon_EUR"].sum())
        sub_taux = (sub_abandon / sub_brut * 100) if sub_brut > 0 else 0
        sub_qte = float(sub_df["PLVQTE"].sum())
        sub_lignes = len(sub_df)

        c_kpi1, c_kpi2, c_kpi3, c_kpi4, c_kpi5 = st.columns(5, gap="small")
        c_kpi1.metric("CA HT", f"{sub_ca:,.0f} €")
        c_kpi2.metric("Abandon", f"{sub_abandon:,.0f} €")
        c_kpi3.metric("Taux abandon", f"{sub_taux:.1f} %")
        c_kpi4.metric("Qté", f"{sub_qte:,.0f}")
        c_kpi5.metric("Lignes", f"{sub_lignes:,}")

        # Mini bar chart abandon par tranche sur le sous-périmètre
        sub_per_tranche = (
            sub_df.groupby("TRANCHE_PRIX", observed=True, as_index=False)
            .agg(CA_HT=("CA_HT", "sum"), MONTANT_BRUT=("MONTANT_BRUT", "sum"), abandon_EUR=("abandon_EUR", "sum"))
        )
        sub_per_tranche["TAUX"] = np.where(sub_per_tranche["MONTANT_BRUT"] != 0, (sub_per_tranche["abandon_EUR"] / sub_per_tranche["MONTANT_BRUT"]) * 100, np.nan)
        sub_per_tranche["TRANCHE_PRIX"] = pd.Categorical(sub_per_tranche["TRANCHE_PRIX"], categories=vent_labels, ordered=True)
        sub_per_tranche = sub_per_tranche.sort_values("TRANCHE_PRIX")

        fig_sub = go.Figure()
        fig_sub.add_trace(go.Bar(
            x=sub_per_tranche["TRANCHE_PRIX"].astype(str),
            y=sub_per_tranche["abandon_EUR"],
            name="Abandon €",
            marker=dict(color="#F1948A"),
            text=[f"{v:,.0f} €" for v in sub_per_tranche["abandon_EUR"]],
            textposition="outside",
            yaxis="y1",
        ))
        fig_sub.add_trace(go.Scatter(
            x=sub_per_tranche["TRANCHE_PRIX"].astype(str),
            y=sub_per_tranche["TAUX"],
            name="Taux abandon %",
            mode="lines+markers",
            marker=dict(color="#1E3A5F", size=10),
            line=dict(width=3),
            yaxis="y2",
        ))
        fig_sub.update_layout(
            height=320,
            title=f"Abandon × tranche · {cat_filter}",
            xaxis=dict(title="Tranche prix"),
            yaxis=dict(title="Abandon €", side="left"),
            yaxis2=dict(title="Taux abandon %", side="right", overlaying="y", showgrid=False),
            legend=dict(orientation="h", yanchor="bottom", y=1.05, xanchor="center", x=0.5),
            margin=dict(t=60, b=40, l=10, r=10),
            font=dict(family="Barlow, sans-serif", size=12),
        )
        st.plotly_chart(fig_sub, width="stretch", config={"displayModeBar": False})

        # Top 10 produits du sous-périmètre
        if not sub_df.empty:
            top_sub = (
                sub_df.groupby(["ARTCODE", "PLVDESIGNATION"], as_index=False)
                .agg(CA_HT=("CA_HT", "sum"), abandon_EUR=("abandon_EUR", "sum"), QTE=("PLVQTE", "sum"))
                .sort_values("CA_HT", ascending=False)
                .head(10)
            )
            top_sub["taux_abandon_pct"] = np.where(
                (top_sub["CA_HT"] + top_sub["abandon_EUR"]) != 0,
                (top_sub["abandon_EUR"] / (top_sub["CA_HT"] + top_sub["abandon_EUR"])) * 100,
                np.nan,
            )
            st.markdown(f"**Top 10 produits · {cat_filter}**")
            st.dataframe(
                top_sub.rename(columns={
                    "ARTCODE": "Code",
                    "PLVDESIGNATION": "Désignation",
                    "CA_HT": "CA HT",
                    "abandon_EUR": "Abandon €",
                    "QTE": "Qté",
                    "taux_abandon_pct": "Taux abandon %",
                }),
                width="stretch",
                column_config={
                    "CA HT": st.column_config.NumberColumn(format="%.0f €"),
                    "Abandon €": st.column_config.NumberColumn(format="%.0f €"),
                    "Qté": st.column_config.NumberColumn(format="%.0f"),
                    "Taux abandon %": st.column_config.NumberColumn(format="%.1f %%"),
                },
                hide_index=True,
                height=min(80 + 38 * len(top_sub), 460),
            )

# =========================================================
# LIGNE 2 : Alertes + CA HT par mois
# =========================================================
c_row2_a, c_row2_b = st.columns([1, 1.5], gap="medium")

with c_row2_a:
    if alerts or period_compare:
        st.markdown('<div class="section-header">🚨 Alertes</div>', unsafe_allow_html=True)
        if alerts:
            for title, msg in alerts:
                st.warning(f"**{title}** — {msg}")
        else:
            st.success("Aucune alerte majeure sur le périmètre sélectionné.")

with c_row2_b:
    st.markdown('<div class="section-header">📅 CA HT par mois</div>', unsafe_allow_html=True)
    if st.session_state.get("opt_show_help", True):
        with st.expander("ℹ️ Aide – CA HT par mois"):
            st.markdown("""
Ce graphique affiche l'évolution mensuelle du **CA net HT** (montant réellement facturé) sur la période filtrée.

- Chaque barre représente un mois.  
- Les mois avec un CA très faible ou négatif traduisent la présence d'**avoirs** importants sur la période.  
- Ce graphique reflète les filtres appliqués (commercial, marque, nature, sous-famille).  

👉 Survoler une barre affiche le détail du CA HT pour ce mois.
""")
    st.markdown('<div class="chart-card">', unsafe_allow_html=True)
    if not mois_scope.empty:
        fig_bar = go.Figure()
        fig_bar.add_trace(go.Bar(
            x=mois_scope["MOIS"].dt.strftime("%b %Y"),
            y=mois_scope["CA_HT"],
            marker_color=COLOR_PRIMARY,
            hovertemplate="%{x}<br>CA HT : %{y:,.2f} €<extra></extra>",
            name="CA HT",
        ))
        fig_bar.update_layout(
            height=210,
            margin=dict(l=0, r=0, t=8, b=30),
            paper_bgcolor="rgba(0,0,0,0)",
            plot_bgcolor="rgba(0,0,0,0)",
            font=dict(family="Barlow, sans-serif", size=10),
            showlegend=False,
            yaxis=dict(gridcolor="#E8EEF5", tickformat=",.2f", title="CA HT (€)", title_font_size=9, tickfont_size=9),
            xaxis=dict(tickangle=-30, tickfont_size=9),
            bargap=0.3,
        )
        st.plotly_chart(fig_bar, width="stretch")
    st.markdown("</div>", unsafe_allow_html=True)


# =========================================================
# PORTEFEUILLE : Top clients CA + Top abandons
# =========================================================
top_ca_clients = None
top_abandon_clients = None

if selected_client is None:
    col_t1, col_t2 = st.columns(2, gap="medium")

    with col_t1:
        st.markdown('<div class="section-header print-block">🏆 Top pharmacies — CA HT</div>', unsafe_allow_html=True)
        if st.session_state.get("opt_show_help", True):
            with st.expander("ℹ️ Aide – Top pharmacies CA HT"):
                st.markdown("""
Classement des pharmacies par **CA net HT décroissant** sur la période filtrée.

- Le graphique affiche le **top 10** visuel.  
- Le tableau détaillé (📋) remonte les **50 premières pharmacies**.  
- Un **taux d'abandon > 20 %** est mis en surbrillance rouge dans le tableau : c'est un signal d'effort commercial élevé sur ce client.  

👉 Cliquer sur "📋 Tableau complet" pour accéder au détail avec tous les indicateurs (CA brut, abandon €, taux, panier moyen, etc.).
""")
        top_ca_clients = clients_scope.sort_values("CA_HT", ascending=False).head(50).copy()

        top10 = top_ca_clients.head(10)
        fig_top = go.Figure(go.Bar(
            x=top10["CA_HT"],
            y=(top10["TIRCODE"] + " " + top10["TIRSOCIETE"].str[:20]),
            orientation="h",
            marker_color=COLOR_PRIMARY,
            hovertemplate="%{y}<br>CA HT : %{x:,.2f} €<extra></extra>",
            text=top10["CA_HT"].apply(lambda v: f"{v:,.2f} €"),
            textposition="outside",
        ))
        fig_top.update_layout(
            height=220, margin=dict(l=0, r=80, t=6, b=6),
            paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
            font=dict(family="Barlow, sans-serif", size=9),
            xaxis=dict(gridcolor="#E8EEF5", tickformat=",.2f", tickfont_size=8),
            yaxis=dict(autorange="reversed", tickfont_size=8),
            showlegend=False,
        )
        st.markdown('<div class="chart-card">', unsafe_allow_html=True)
        st.plotly_chart(fig_top, width="stretch")
        st.markdown("</div>", unsafe_allow_html=True)

        with st.expander("📋 Tableau complet (50 pharmacies)"):
            # Mise en évidence : taux d'abandon faible (< 5%) = marge limitée = rouge
            # taux élevé (> 15%) = marge importante accordée au pharmacien = vert
            def _highlight_abandon(val):
                if not isinstance(val, float):
                    return ""
                if val < 3:
                    return "background-color: #FDECEA; color: #C0392B; font-weight: bold"
                if val > 6:
                    return "background-color: #EAFAF1; color: #1E8449; font-weight: bold"
                return ""
            styled_top_ca = top_ca_clients.style.map(_highlight_abandon, subset=["taux_abandon_pct"])
            st.dataframe(
                style_negative_values(top_ca_clients, ["CA_HT", "BRUT", "abandon_EUR"]), width="stretch", height=380,
                column_config={"CA_HT": EUR, "BRUT": EUR, "abandon_EUR": EUR, "taux_abandon_pct": PCT, "QTE": INT, "LIGNES": INT, "FACTURES": INT},
            )

    with col_t2:
        st.markdown('<div class="section-header print-block">💶 Top pharmacies — Abandon de marge</div>', unsafe_allow_html=True)
        if st.session_state.get("opt_show_help", True):
            with st.expander("ℹ️ Aide – Top pharmacies abandon de marge"):
                st.markdown("""
Classement des pharmacies par **abandon de marge décroissant** (montant en €) sur la période filtrée.

Ce classement est différent du top CA : une pharmacie peut générer un CA modéré mais concentrer des abandons importants (remises élevées).

- **Abandon de marge** = montant brut − CA net HT.  
- Ce tableau aide à identifier les clients sur lesquels l'effort commercial est disproportionné par rapport au volume généré.  

👉 Croiser ce tableau avec le **Top CA** pour repérer les pharmacies à fort abandon **et** à fort CA — ce sont les clients à piloter en priorité.
""")
        top_abandon_clients = clients_scope.sort_values("abandon_EUR", ascending=False).head(50).copy()

        top10_ab = top_abandon_clients.head(10)
        fig_ab = go.Figure(go.Bar(
            x=top10_ab["abandon_EUR"],
            y=(top10_ab["TIRCODE"] + " " + top10_ab["TIRSOCIETE"].str[:20]),
            orientation="h",
            marker_color=COLOR_SECONDARY,
            hovertemplate="%{y}<br>Abandon : %{x:,.2f} €<extra></extra>",
            text=top10_ab["abandon_EUR"].apply(lambda v: f"{v:,.2f} €"),
            textposition="outside",
        ))
        fig_ab.update_layout(
            height=220, margin=dict(l=0, r=80, t=6, b=6),
            paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
            font=dict(family="Barlow, sans-serif", size=9),
            xaxis=dict(gridcolor="#E8EEF5", tickformat=",.2f", tickfont_size=8),
            yaxis=dict(autorange="reversed", tickfont_size=8),
            showlegend=False,
        )
        st.markdown('<div class="chart-card">', unsafe_allow_html=True)
        st.plotly_chart(fig_ab, width="stretch")
        st.markdown("</div>", unsafe_allow_html=True)

        with st.expander("📋 Tableau complet (50 pharmacies)"):
            st.dataframe(
                style_negative_values(top_abandon_clients, ["CA_HT", "BRUT", "abandon_EUR"]), width="stretch", height=380,
                column_config={"CA_HT": EUR, "BRUT": EUR, "abandon_EUR": EUR, "taux_abandon_pct": PCT, "QTE": INT, "LIGNES": INT, "FACTURES": INT},
            )


# =========================================================
# SCORING CLIENTS V2 (portefeuille)
# =========================================================
if selected_client is None and not clients_scope.empty:
    st.markdown('<div class="section-header print-block">🎯 Scoring clients</div>', unsafe_allow_html=True)
    if st.session_state.get("opt_show_help", True):
        with st.expander("ℹ️ Aide – Scoring clients"):
            st.markdown("""
Le **score client** est un indicateur composite calculé automatiquement pour chaque pharmacie.  
Il combine trois dimensions (pondérées) :

- **CA HT** (50 %) : plus le CA est élevé, plus le score est fort.  
- **Taux de marge** (30 %) : un taux d'abandon élevé signifie une marge importante accordée au pharmacien — c'est favorable pour lui et pour nous.  
- **Panier moyen** (20 %) : un panier élevé indique une commande de valeur supérieure à la moyenne.

**Segment CA** : les clients sont répartis en 3 groupes par tercile de CA — *Standard*, *Développement*, *Premium*.

👉 Un score élevé = client stratégique à fort CA, marge importante partagée, grosses commandes.  
👉 Un score faible = client à potentiel limité ou avec une marge partagée insuffisante.
""")
    score_view = clients_scope.sort_values(["SCORE_CLIENT", "CA_HT"], ascending=[False, False]).head(25).copy()
    c_sc1, c_sc2 = st.columns(2, gap="medium")
    with c_sc1:
        fig_score = go.Figure(go.Bar(
            x=score_view["SCORE_CLIENT"].head(10),
            y=(score_view["TIRCODE"] + " " + score_view["TIRSOCIETE"].str[:24]).head(10),
            orientation="h",
            marker_color=COLOR_PRIMARY,
            text=score_view["SCORE_CLIENT"].head(10).apply(lambda v: f"{v:.1f}"),
            textposition="outside",
        ))
        fig_score.update_layout(height=230, margin=dict(l=0, r=60, t=8, b=8), paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)", yaxis=dict(autorange="reversed", tickfont_size=8), xaxis=dict(gridcolor="#E8EEF5", tickfont_size=8), showlegend=False)
        st.markdown('<div class="chart-card"><div class="chart-card-title">Top score client</div>', unsafe_allow_html=True)
        st.plotly_chart(fig_score, width="stretch")
        st.markdown('</div>', unsafe_allow_html=True)
    with c_sc2:
        st.dataframe(
            score_view[["TIRCODE", "TIRSOCIETE", "SEGMENT_CA", "CA_HT", "PANIER_MOYEN", "taux_abandon_pct", "SCORE_CLIENT"]],
            width="stretch", height=320,
            column_config={"CA_HT": EUR, "PANIER_MOYEN": EUR, "taux_abandon_pct": PCT},
        )


# =========================================================
# TOP PRODUITS
# =========================================================
top20_pct = pd.DataFrame()
top20_eur = pd.DataFrame()

if st.session_state.get("opt_top_produits", True):
    st.markdown('<div class="section-header print-block">🏆 Top produits — Marge</div>', unsafe_allow_html=True)
    if st.session_state.get("opt_show_help", True):
        with st.expander("ℹ️ Aide – Top produits marge"):
            st.markdown("""
Deux classements complémentaires des produits sur lesquels la marge accordée aux pharmaciens est la plus importante, **hors génériques** :

**📈 Top 20 — Taux de marge (%)** : produits sur lesquels le **pourcentage de marge partagée** est le plus fort.  
Un produit à taux élevé mais CA faible représente peu d'enjeu financier absolu.

**💶 Top 20 — Marge accordée (€)** : produits sur lesquels le **montant en euros de marge partagée** est le plus important.  
Ce sont les produits qui contribuent le plus à la valeur accordée aux pharmaciens.

- Les **génériques** et **génériques partenaires** sont exclus (leur logique de remise est structurellement différente).  
- Les abandons inférieurs à **0,03 €** sont filtrés.  

👉 Cliquer sur "📋 Tableau" pour accéder à la liste complète des 20 produits avec tous les indicateurs.
""")
    col_p1, col_p2 = st.columns(2, gap="medium")

    _gen_exclues = {"generique", "generique partenaire"}
    prod_scope_hors_gen = prod_scope_chart[~prod_scope_chart["ARTNATURE_N"].isin(_gen_exclues)].copy()

    with col_p1:
        st.markdown('<div class="chart-card-title">📈 Top 20 — Taux de marge (%) · hors génériques</div>', unsafe_allow_html=True)
        top20_pct = (
            prod_scope_hors_gen.dropna(subset=["taux_abandon_pct"])
            .loc[lambda d: d["abandon_EUR"] >= 0.03]
            .sort_values("taux_abandon_pct", ascending=False)
            .head(20).copy()
        )

        fig_p1 = go.Figure(go.Bar(
            x=top20_pct["taux_abandon_pct"].head(10),
            y=top20_pct["PLVDESIGNATION"].str[:30].head(10),
            orientation="h",
            marker=dict(
                color=top20_pct["taux_abandon_pct"].head(10),
                colorscale=[[0, COLOR_SECONDARY], [1, COLOR_PRIMARY]],
                showscale=False,
            ),
            text=[f"{v:.1f} %" for v in top20_pct["taux_abandon_pct"].head(10)],
            textposition="outside",
            hovertemplate="%{y}<br>Taux : %{x:.1f} %<extra></extra>",
        ))
        fig_p1.update_layout(
            height=220, margin=dict(l=0, r=60, t=6, b=6),
            paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
            font=dict(family="Barlow, sans-serif", size=9),
            xaxis=dict(gridcolor="#E8EEF5", tickfont_size=8), yaxis=dict(autorange="reversed", tickfont_size=8),
            showlegend=False,
        )
        st.markdown('<div class="chart-card">', unsafe_allow_html=True)
        st.plotly_chart(fig_p1, width="stretch")
        st.markdown("</div>", unsafe_allow_html=True)
        with st.expander("📋 Tableau Top 20 (%)"):
            st.dataframe(
                style_negative_values(top20_pct[["ARTCODE", "PLVDESIGNATION", "QTE", "CA_HT", "BRUT", "abandon_EUR", "taux_abandon_pct", "LIGNES"]], ["CA_HT", "BRUT", "abandon_EUR"]), width="stretch", height=420,
                column_config={"QTE": INT, "CA_HT": EUR, "BRUT": EUR, "abandon_EUR": EUR, "taux_abandon_pct": PCT, "LIGNES": INT},
            )

    with col_p2:
        st.markdown('<div class="chart-card-title">💶 Top 20 — Abandon de marge (€) · hors génériques</div>', unsafe_allow_html=True)
        top20_eur = prod_scope_hors_gen.loc[prod_scope_hors_gen["abandon_EUR"] >= 0.03].sort_values("abandon_EUR", ascending=False).head(20).copy()

        fig_p2 = go.Figure(go.Bar(
            x=top20_eur["abandon_EUR"].head(10),
            y=top20_eur["PLVDESIGNATION"].str[:30].head(10),
            orientation="h",
            marker=dict(
                color=top20_eur["abandon_EUR"].head(10),
                colorscale=[[0, "#2980B9"], [1, COLOR_SECONDARY]],
                showscale=False,
            ),
            text=top20_eur["abandon_EUR"].head(10).apply(lambda v: f"{v:,.2f} €"),
            textposition="outside",
            hovertemplate="%{y}<br>Abandon : %{x:,.2f} €<extra></extra>",
        ))
        fig_p2.update_layout(
            height=220, margin=dict(l=0, r=80, t=6, b=6),
            paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
            font=dict(family="Barlow, sans-serif", size=9),
            xaxis=dict(gridcolor="#E8EEF5", tickformat=",.2f", tickfont_size=8), yaxis=dict(autorange="reversed", tickfont_size=8),
            showlegend=False,
        )
        st.markdown('<div class="chart-card">', unsafe_allow_html=True)
        st.plotly_chart(fig_p2, width="stretch")
        st.markdown("</div>", unsafe_allow_html=True)
        with st.expander("📋 Tableau Top 20 (€)"):
            st.dataframe(
                style_negative_values(top20_eur[["ARTCODE", "PLVDESIGNATION", "QTE", "CA_HT", "BRUT", "abandon_EUR", "taux_abandon_pct", "LIGNES"]], ["CA_HT", "BRUT", "abandon_EUR"]), width="stretch", height=420,
                column_config={"QTE": INT, "CA_HT": EUR, "BRUT": EUR, "abandon_EUR": EUR, "taux_abandon_pct": PCT, "LIGNES": INT},
            )


# =========================================================
# BIOSIMILAIRES
# =========================================================
bio_ca = pd.DataFrame()
bio_marge = pd.DataFrame()

if st.session_state.get("opt_bio", True):
    bio_scope = prod_scope_chart[prod_scope_chart["ARTNATURE_N"] == "biosimilaire"].copy()
    st.markdown('<div class="section-header print-block">🧬 Biosimilaires</div>', unsafe_allow_html=True)
    if st.session_state.get("opt_show_help", True):
        with st.expander("ℹ️ Aide – Biosimilaires"):
            st.markdown("""
Cette section isole les produits dont la **nature** (colonne `ARTNATURE`) est identifiée comme **Biosimilaire**.

- **Top 10 — CA HT** : biosimilaires générant le plus de chiffre d'affaires net sur le périmètre.  
- **Top 10 — Abandon de marge** : biosimilaires sur lesquels les remises sont les plus importantes.  

Les biosimilaires sont des médicaments biologiques similaires à un médicament de référence. Leur suivi spécifique permet de mesurer la pénétration de cette gamme et l'effort commercial associé.

👉 Si cette section est vide, aucune ligne n'est taguée *Biosimilaire* dans les données sources sur le périmètre filtré.
""")

    if bio_scope.empty:
        st.info("Aucun Biosimilaire sur le périmètre choisi.")
    else:
        col_b1, col_b2 = st.columns(2, gap="medium")
        with col_b1:
            bio_ca = bio_scope.sort_values("CA_HT", ascending=False).head(10).copy()
            fig_bio1 = px.bar(
                bio_ca, x="CA_HT", y="PLVDESIGNATION", orientation="h",
                color_discrete_sequence=[COLOR_PRIMARY],
                text=bio_ca["CA_HT"].apply(lambda v: f"{v:,.2f} €"),
                title="Top 10 — CA HT (€)",
            )
            fig_bio1.update_traces(textposition="outside")
            fig_bio1.update_layout(
                height=220, margin=dict(l=0, r=80, t=28, b=6),
                paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
                font=dict(family="Barlow, sans-serif", size=9),
                xaxis=dict(gridcolor="#E8EEF5", tickformat=",.2f", tickfont_size=8), yaxis=dict(autorange="reversed", title="", tickfont_size=8),
                showlegend=False, title_font_size=10,
            )
            st.markdown('<div class="chart-card">', unsafe_allow_html=True)
            st.plotly_chart(fig_bio1, width="stretch")
            st.markdown("</div>", unsafe_allow_html=True)

        with col_b2:
            bio_marge = bio_scope.loc[bio_scope["abandon_EUR"] >= 0.03].sort_values("abandon_EUR", ascending=False).head(10).copy()
            fig_bio2 = px.bar(
                bio_marge, x="abandon_EUR", y="PLVDESIGNATION", orientation="h",
                color_discrete_sequence=[COLOR_SECONDARY],
                text=bio_marge["abandon_EUR"].apply(lambda v: f"{v:,.2f} €"),
                title="Top 10 — Abandon de marge (€)",
            )
            fig_bio2.update_traces(textposition="outside")
            fig_bio2.update_layout(
                height=220, margin=dict(l=0, r=80, t=28, b=6),
                paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
                font=dict(family="Barlow, sans-serif", size=9),
                xaxis=dict(gridcolor="#E8EEF5", tickformat=",.2f", tickfont_size=8), yaxis=dict(autorange="reversed", title="", tickfont_size=8),
                showlegend=False, title_font_size=10,
            )
            st.markdown('<div class="chart-card">', unsafe_allow_html=True)
            st.plotly_chart(fig_bio2, width="stretch")
            st.markdown("</div>", unsafe_allow_html=True)


# =========================================================
# FROID
# =========================================================
froid_ca = pd.DataFrame()
froid_marge = pd.DataFrame()

if st.session_state.get("opt_froid", True):
    froid_scope = prod_scope_chart[prod_scope_chart["ARTSOUSFAMILLE_N"] == "froid"].copy()
    st.markdown('<div class="section-header print-block">❄️ Produits Froid</div>', unsafe_allow_html=True)
    if st.session_state.get("opt_show_help", True):
        with st.expander("ℹ️ Aide – Produits Froid"):
            st.markdown("""
Cette section isole les produits dont la **sous-famille** (colonne `ARTSOUSFAMILLE`) est identifiée comme **Froid** (produits nécessitant une chaîne du froid).

- **Tableau gauche** : top 20 produits froid par **CA HT**, du plus fort au plus faible.  
- **Tableau droit** : top 20 par **abandon de marge**, pour identifier les produits froid les plus remisés.  

Le suivi séparé des produits froid est pertinent car ils représentent souvent une marge unitaire plus élevée et des conditions logistiques spécifiques.

👉 Si cette section est vide, aucun produit n'est taguée *Froid* dans les données sources sur le périmètre filtré.
""")

    if froid_scope.empty:
        st.info("Aucun produit Froid sur le périmètre choisi.")
    else:
        col_f1, col_f2 = st.columns(2, gap="medium")
        with col_f1:
            froid_ca = froid_scope.sort_values("CA_HT", ascending=False).head(20).copy()
            st.dataframe(
                style_negative_values(froid_ca[["ARTCODE","PLVDESIGNATION","QTE","CA_HT","BRUT","abandon_EUR","taux_abandon_pct","LIGNES"]], ["CA_HT","BRUT","abandon_EUR"]), width="stretch", height=300,
                column_config={"QTE":INT,"CA_HT":EUR,"BRUT":EUR,"abandon_EUR":EUR,"taux_abandon_pct":PCT,"LIGNES":INT},
            )

        with col_f2:
            froid_marge = froid_scope.loc[froid_scope["abandon_EUR"] >= 0.03].sort_values("abandon_EUR", ascending=False).head(20).copy()
            st.dataframe(
                style_negative_values(froid_marge[["ARTCODE","PLVDESIGNATION","QTE","CA_HT","BRUT","abandon_EUR","taux_abandon_pct","LIGNES"]], ["CA_HT","BRUT","abandon_EUR"]), width="stretch", height=300,
                column_config={"QTE":INT,"CA_HT":EUR,"BRUT":EUR,"abandon_EUR":EUR,"taux_abandon_pct":PCT,"LIGNES":INT},
            )


# =========================================================
# ABANDONS PAR CLIENT (portefeuille) — DÉSACTIVÉ
# =========================================================
aband_view = None
#
# if st.session_state.get("opt_abandons", True) and selected_client is None:
#     st.markdown('<div class="section-header print-block">🏷️ Abandons de marge par client</div>', unsafe_allow_html=True)
#     if st.session_state.get("opt_show_help", True):
#         with st.expander("ℹ️ Aide – Abandons de marge par client"):
#         st.markdown("""
# Ce graphique en **nuage de points** positionne chaque pharmacie selon deux axes :
#
# - **Axe X (horizontal)** : CA HT — le chiffre d'affaires net généré par la pharmacie.  
# - **Axe Y (vertical)** : Taux d'abandon (%) — la part de marge concédée.  
# - **Couleur** : représente le montant d'abandon en euros (vert = faible, bleu = moyen, rouge = élevé).
#
# **Lecture** :  
# - En haut à gauche : petits clients très remisés → peu rentables.  
# - En bas à droite : gros clients peu remisés → clients idéaux.  
# - En haut à droite : gros clients très remisés → à surveiller en priorité.  
#
# Le nombre de pharmacies affichées est configurable via le curseur **"Top clients (abandons)"** dans la barre latérale.
# """)
#     topn = int(st.session_state.get("opt_top_n_clients", 200))
#     aband_view = clients_scope.sort_values("taux_abandon_pct", ascending=False).head(topn).copy()
#
#     if len(aband_view) >= 3:
#         fig_sc = px.scatter(
#             aband_view,
#             x="CA_HT", y="taux_abandon_pct",
#             hover_data=["TIRCODE", "TIRSOCIETE", "abandon_EUR"],
#             color="abandon_EUR",
#             color_continuous_scale=[[0, "#27AE60"], [0.5, COLOR_SECONDARY], [1, COLOR_PRIMARY]],
#             labels={"CA_HT": "CA HT (€)", "taux_abandon_pct": "Taux d'abandon (%)", "abandon_EUR": "Abandon €"},
#             title=f"CA HT vs Taux d'abandon — {topn} pharmacies",
#         )
#         fig_sc.update_layout(height=240, margin=dict(l=0, r=0, t=28, b=8), font=dict(family="Barlow, sans-serif", size=9))
#         st.markdown('<div class="chart-card">', unsafe_allow_html=True)
#         st.plotly_chart(fig_sc, width="stretch")
#         st.markdown("</div>", unsafe_allow_html=True)
#
# =========================================================
# PRODUITS EN BAISSE
# =========================================================
baisse_view = pd.DataFrame()
if st.session_state.get("opt_baisse", True):
    seuil_baisse = int(st.session_state.get("opt_baisse_seuil", 20))
    st.markdown(f'<div class="section-header print-block">📉 Produits en baisse (≥ {seuil_baisse} %)</div>', unsafe_allow_html=True)
    if st.session_state.get("opt_show_help", True):
        with st.expander("ℹ️ Aide – Produits en baisse"):
            st.markdown(f"""
Liste des produits dont le **CA net HT a baissé d'au moins {seuil_baisse} %** entre le mois précédent et le dernier mois disponible.

**Mode de comparaison** :  
- Si le mois M-1 est disponible dans les données : comparaison **M vs M-1**.  
- Sinon : comparaison entre les **deux derniers mois disponibles**.  

**Colonnes affichées** :  
- **CA net HT M-1** : CA du mois de référence (base de comparaison).  
- **CA net HT M** : CA du mois le plus récent.  
- **Baisse %** : variation calculée entre les deux mois.  

Un CA négatif indique la présence d'**avoirs** (remboursements ou annulations) sur la période.  
Le seuil de déclenchement est configurable via le curseur **"Seuil de baisse (%)"** dans la barre latérale.

👉 Maximum 50 produits affichés, triés par baisse décroissante.
""")

    baisse_df = sdf[["MOIS", "ARTCODE", "ARTCODEBARRE", "PLVDESIGNATION", "ARTNATURE_N",
                      "CA_HT", "PLVQTE", "abandon_EUR", "MONTANT_BRUT"]].copy()

    if baisse_df.empty or baisse_df["MOIS"].dropna().nunique() < 2:
        st.info("Pas assez de données mensuelles pour comparer.")
    else:
        mois_dispo = sorted(pd.to_datetime(baisse_df["MOIS"].dropna()).unique())
        mois_max = pd.Timestamp(mois_dispo[-1]).to_period("M").to_timestamp()
        mois_prev_attendu = (mois_max - pd.DateOffset(months=1)).to_period("M").to_timestamp()

        mois_dispo_ts = [pd.Timestamp(x).to_period("M").to_timestamp() for x in mois_dispo]
        if mois_prev_attendu in mois_dispo_ts:
            mois_prev = mois_prev_attendu
            mode_compare = "M vs M-1"
        else:
            mois_prev = pd.Timestamp(mois_dispo[-2]).to_period("M").to_timestamp()
            mode_compare = "Deux derniers mois disponibles"

        label_n = pd.Timestamp(mois_max).strftime("%b %Y")
        label_n1 = pd.Timestamp(mois_prev).strftime("%b %Y")

        baisse_df["_product_key"] = baisse_df["ARTCODEBARRE"].astype(str).str.strip()
        baisse_df["_product_key"] = baisse_df["_product_key"].replace({"": np.nan, "nan": np.nan, "None": np.nan, "#N/A": np.nan})
        baisse_df["_product_key"] = baisse_df["_product_key"].fillna(baisse_df["ARTCODE"].astype(str).str.strip())

        agg_baisse = (
            baisse_df.groupby(["_product_key", "PLVDESIGNATION", "MOIS"], as_index=False)
            .agg(
                ARTCODE=("ARTCODE", "first"),
                ARTCODEBARRE=("ARTCODEBARRE", "first"),
                CA_HT=("CA_HT", "sum"),
                CABRUT_HT=("MONTANT_BRUT", "sum"),
                QTE=("PLVQTE", "sum"),
            )
        )

        pivot_net = (
            agg_baisse.pivot_table(
                index=["_product_key", "ARTCODE", "ARTCODEBARRE", "PLVDESIGNATION"],
                columns="MOIS",
                values="CA_HT",
                aggfunc="sum",
                fill_value=0.0,
            )
            .reset_index()
        )

        pivot_brut = (
            agg_baisse.pivot_table(
                index=["_product_key", "ARTCODE", "ARTCODEBARRE", "PLVDESIGNATION"],
                columns="MOIS",
                values="CABRUT_HT",
                aggfunc="sum",
                fill_value=0.0,
            )
            .reset_index()
        )

        for mois_col in [mois_prev, mois_max]:
            if mois_col not in pivot_net.columns:
                pivot_net[mois_col] = 0.0
            if mois_col not in pivot_brut.columns:
                pivot_brut[mois_col] = 0.0

        pivot_net = pivot_net.rename(columns={mois_prev: f"CA_HT_{label_n1}", mois_max: f"CA_HT_{label_n}"})
        pivot_brut = pivot_brut.rename(columns={mois_prev: f"CABRUT_HT_{label_n1}", mois_max: f"CABRUT_HT_{label_n}"})

        baisse_view = pivot_net.merge(
            pivot_brut[["_product_key", f"CABRUT_HT_{label_n1}", f"CABRUT_HT_{label_n}"]],
            on="_product_key",
            how="left"
        )

        baisse_view["variation_pct"] = [
            safe_variation_pct(cur_v, prev_v)
            for cur_v, prev_v in zip(baisse_view[f"CA_HT_{label_n}"], baisse_view[f"CA_HT_{label_n1}"])
        ]
        baisse_view["variation_eur"] = baisse_view[f"CA_HT_{label_n}"] - baisse_view[f"CA_HT_{label_n1}"]

        baisse_view = baisse_view[
            baisse_view["variation_pct"].notna() & (baisse_view["variation_pct"] <= -seuil_baisse)
        ].sort_values("variation_pct").copy()

        if baisse_view.empty:
            st.info(f"Aucun produit en baisse d'au moins {seuil_baisse:.2f} % entre {label_n1} et {label_n}.")
        else:
            st.caption(
                f"Comparaison utilisée : {mode_compare} — {label_n1} → {label_n}. "
                f"Les valeurs négatives correspondent aux avoirs et sont affichées en rouge clair."
            )
            # N'afficher que : désignation, CA net M-1, CA net M, % de baisse
            cols_affichage = ["PLVDESIGNATION", f"CA_HT_{label_n1}", f"CA_HT_{label_n}", "variation_pct"]
            st.dataframe(
                style_negative_values(
                    baisse_view[cols_affichage].head(50),
                    [f"CA_HT_{label_n1}", f"CA_HT_{label_n}", "variation_pct"]
                ),
                width="stretch",
                column_config={
                    "PLVDESIGNATION": st.column_config.TextColumn("Produit"),
                    f"CA_HT_{label_n1}": st.column_config.NumberColumn(f"CA net HT {label_n1}", format="%.2f €"),
                    f"CA_HT_{label_n}": st.column_config.NumberColumn(f"CA net HT {label_n}", format="%.2f €"),
                    "variation_pct": st.column_config.NumberColumn("Baisse %", format="%.2f %%"),
                },
                hide_index=True,
            )

# =========================================================
# OPPORTUNITÉS COMMERCIALES V2
# =========================================================
if selected_client is not None:
    st.markdown('<div class="section-header print-block">🚀 Opportunités commerciales</div>', unsafe_allow_html=True)
    if st.session_state.get("opt_show_help", True):
        with st.expander("ℹ️ Aide – Opportunités commerciales"):
            st.markdown("""
### 🎯 Comprendre le score d’opportunité

Un produit aura un score élevé s’il coche plusieurs cases :

- il est très fort dans le portefeuille  
- il se vend en bonne quantité  
- il pèse en CA  
- et il n’est pas encore vendu chez le client sélectionné  

---

### 📊 Interprétation du score

Après calcul, le script classe l’opportunité dans 3 niveaux :

- **≥ 80 → Immédiate**  
- **≥ 60 → À travailler**  
- **< 60 → Secondaire**

👉 Plus le score est élevé, plus l’opportunité est prioritaire.
""")
    if opportunity_scored_df.empty:
        st.info("Aucune opportunité détectée sur la base du portefeuille filtré.")
    else:
        st.dataframe(
            opportunity_scored_df[["ARTCODE", "PLVDESIGNATION", "CA_HT", "QTE", "ARTNATURE_N", "ARTSOUSFAMILLE_N", "POTENTIEL_INDICE", "SCORE_OPPORTUNITE", "PRIORITE_ACTION"]],
            width="stretch", height=320,
            column_config={"CA_HT": EUR, "QTE": INT},
        )



# =========================================================
# 📊 ANALYSE GENERIQUE / PARTENAIRE (VERSION SPLIT GAUCHE/DROITE)
# =========================================================

st.markdown('<div class="section-header print-block">📊 Analyse Générique / Générique partenaire (vs portefeuille commercial)</div>', unsafe_allow_html=True)
if st.session_state.get("opt_show_help", True):
    with st.expander("ℹ️ Aide – Analyse générique / générique partenaire"):
        st.markdown("""
Cette section compare la **part de CA** réalisée sur les génériques et les génériques partenaires pour le client sélectionné,
par rapport à la **moyenne du portefeuille global** de son commercial (tous ses clients cumulés sur la même période).

- **Gauche** : Générique partenaire — produits génériques sous marque partenaire.
- **Droite** : Générique hors partenaire — autres génériques du catalogue.

**Lecture des jauges** :
- La barre **bleue** représente la part du client.
- La ligne **orange** (référence) représente la moyenne du portefeuille commercial.
- Un delta **positif** (vert) signifie que le client est **au-dessus** de la moyenne — c'est favorable.
- Un delta **négatif** (rouge) signifie qu'il y a un **potentiel de développement** chez ce client.

Le **Score d'opportunité** cumule les écarts négatifs : plus il est élevé, plus le potentiel générique à développer est important.

👉 Le tableau **Top clients à potentiel** classe tous les clients du portefeuille commercial par score décroissant.
""")

if selected_client is not None:

    # Données du client sur la période filtrée
    df_client_gen = fdf[fdf["TIRCODE"] == selected_client].copy()

    if df_client_gen.empty:
        st.info("Pas de données pour ce client sur la période filtrée.")
    else:
        # Commercial du client
        commercial_gen = df_client_gen["Commercial"].iloc[0]

        # Portefeuille = TOUS les clients du commercial sur la même période
        # fdf = données filtrées par période/filtres sidebar, mais PAS par client
        df_commercial_gen = fdf[fdf["Commercial"] == commercial_gen].copy()

        # --- CLIENT ---
        ca_client_gen = df_client_gen["CA_HT"].sum()
        gen_client_v = df_client_gen[norm_text(df_client_gen["ARTNATURE"]).str.lower() == "generique"]["CA_HT"].sum()
        gen_part_client_v = df_client_gen[norm_text(df_client_gen["ARTNATURE"]).str.lower() == "generique partenaire"]["CA_HT"].sum()
        part_gen_client_v = (gen_client_v / ca_client_gen * 100) if ca_client_gen != 0 else 0.0
        part_gen_part_client_v = (gen_part_client_v / ca_client_gen * 100) if ca_client_gen != 0 else 0.0

        # --- PORTEFEUILLE COMMERCIAL ---
        ca_portef_gen = df_commercial_gen["CA_HT"].sum()
        gen_portef_v = df_commercial_gen[norm_text(df_commercial_gen["ARTNATURE"]).str.lower() == "generique"]["CA_HT"].sum()
        gen_part_portef_v = df_commercial_gen[norm_text(df_commercial_gen["ARTNATURE"]).str.lower() == "generique partenaire"]["CA_HT"].sum()
        part_gen_portef_v = (gen_portef_v / ca_portef_gen * 100) if ca_portef_gen != 0 else 0.0
        part_gen_part_portef_v = (gen_part_portef_v / ca_portef_gen * 100) if ca_portef_gen != 0 else 0.0

        # --- SCORE OPPORTUNITÉ ---
        score_opp_gen = max(0, part_gen_portef_v - part_gen_client_v) + max(0, part_gen_part_portef_v - part_gen_part_client_v)

        nom_client_gen = df_client_gen["TIRSOCIETE"].iloc[0] if "TIRSOCIETE" in df_client_gen.columns else selected_client

        # ================================================================
        # LAYOUT SPLIT : GAUCHE = Générique partenaire | DROITE = Générique
        # ================================================================
        col_gp, col_g = st.columns(2, gap="large")

        def _gauge_fig(val_client, val_portef, label_type, color_client, color_portef):
            """Génère un graphique en barres horizontales client vs portefeuille."""
            fig = go.Figure()
            # Barre portefeuille (fond)
            fig.add_trace(go.Bar(
                x=[val_portef],
                y=[f"Portefeuille {commercial_gen}"],
                orientation="h",
                marker_color=color_portef,
                opacity=0.75,
                text=[f"{val_portef:.2f} %"],
                textposition="outside",
                name="Portefeuille",
                hovertemplate=f"Portefeuille : {val_portef:.2f} %<extra></extra>",
            ))
            # Barre client
            fig.add_trace(go.Bar(
                x=[val_client],
                y=[nom_client_gen[:30]],
                orientation="h",
                marker_color=color_client,
                text=[f"{val_client:.2f} %"],
                textposition="outside",
                name="Client",
                hovertemplate=f"Client : {val_client:.2f} %<extra></extra>",
            ))
            max_x = max(val_client, val_portef) * 1.35 + 0.5
            fig.update_layout(
                height=180,
                margin=dict(l=0, r=60, t=10, b=10),
                paper_bgcolor="rgba(0,0,0,0)",
                plot_bgcolor="rgba(0,0,0,0)",
                font=dict(family="Barlow, sans-serif", size=10),
                xaxis=dict(range=[0, max_x], ticksuffix=" %", gridcolor="#E8EEF5", tickfont_size=9),
                yaxis=dict(tickfont_size=10),
                showlegend=False,
                barmode="group",
            )
            return fig

        # ========================
        # GAUCHE — Générique partenaire
        # ========================
        with col_gp:
            st.markdown('<div class="chart-card">', unsafe_allow_html=True)
            st.markdown('<div class="chart-card-title">🏭 Générique partenaire — % du CA total</div>', unsafe_allow_html=True)

            delta_gp = part_gen_part_client_v - part_gen_part_portef_v
            delta_color_gp = "normal" if delta_gp >= 0 else "inverse"

            m1, m2, m3 = st.columns(3)
            m1.metric("Client", f"{part_gen_part_client_v:.2f} %")
            m2.metric("Portefeuille", f"{part_gen_part_portef_v:.2f} %")
            m3.metric("Écart", f"{delta_gp:+.2f} pts",
                      delta=f"{delta_gp:+.2f} pts",
                      delta_color=delta_color_gp)

            fig_gp = _gauge_fig(
                part_gen_part_client_v, part_gen_part_portef_v,
                "Générique partenaire", "#27AE60", "#95A5A6"
            )
            st.plotly_chart(fig_gp, use_container_width=True, key="fig_gen_part")

            ca_gp_client = gen_part_client_v
            ca_gp_portef = gen_part_portef_v
            st.caption(
                f"CA générique partenaire client : **{ca_gp_client:,.2f} €** | "
                f"Portefeuille total : **{ca_gp_portef:,.2f} €** (CA total client : {ca_client_gen:,.2f} €)"
            )

            if delta_gp < 0:
                st.warning(f"⚠️ Sous la moyenne portefeuille de {abs(delta_gp):.2f} pts — potentiel de développement.")
            else:
                st.success(f"✅ Au-dessus de la moyenne portefeuille de +{delta_gp:.2f} pts — bonne performance.")
            st.markdown("</div>", unsafe_allow_html=True)

        # ========================
        # DROITE — Générique hors partenaire
        # ========================
        with col_g:
            st.markdown('<div class="chart-card">', unsafe_allow_html=True)
            st.markdown('<div class="chart-card-title">🧪 Générique hors partenaire — % du CA total</div>', unsafe_allow_html=True)

            delta_g = part_gen_client_v - part_gen_portef_v
            delta_color_g = "normal" if delta_g >= 0 else "inverse"

            m4, m5, m6 = st.columns(3)
            m4.metric("Client", f"{part_gen_client_v:.2f} %")
            m5.metric("Portefeuille", f"{part_gen_portef_v:.2f} %")
            m6.metric("Écart", f"{delta_g:+.2f} pts",
                      delta=f"{delta_g:+.2f} pts",
                      delta_color=delta_color_g)

            fig_g = _gauge_fig(
                part_gen_client_v, part_gen_portef_v,
                "Générique", "#1E3A5F", "#95A5A6"
            )
            st.plotly_chart(fig_g, use_container_width=True, key="fig_gen")

            ca_g_client = gen_client_v
            ca_g_portef = gen_portef_v
            st.caption(
                f"CA générique client : **{ca_g_client:,.2f} €** | "
                f"Portefeuille total : **{ca_g_portef:,.2f} €** (CA total client : {ca_client_gen:,.2f} €)"
            )

            if delta_g < 0:
                st.warning(f"⚠️ Sous la moyenne portefeuille de {abs(delta_g):.2f} pts — potentiel de développement.")
            else:
                st.success(f"✅ Au-dessus de la moyenne portefeuille de +{delta_g:.2f} pts — bonne performance.")
            st.markdown("</div>", unsafe_allow_html=True)

        # ========================
        # SCORE GLOBAL + RECOMMANDATIONS
        # ========================
        st.markdown('<div class="chart-card" style="margin-top:8px;">', unsafe_allow_html=True)
        sc1, sc2 = st.columns([1, 3], gap="medium")
        with sc1:
            score_color = "#E8440A" if score_opp_gen > 5 else ("#F39C12" if score_opp_gen > 1 else "#27AE60")
            st.markdown(
                f'<div style="text-align:center;padding:12px 0;">'
                f'<div class="chart-card-title">🎯 Score d\'opportunité générique global</div>'
                f'<div style="font-family:Barlow Condensed,sans-serif;font-size:2.2rem;font-weight:900;color:{score_color};">{score_opp_gen:.2f}</div>'
                f'<div style="font-size:0.7rem;color:#64748b;">Somme des écarts négatifs vs portefeuille</div>'
                f'</div>',
                unsafe_allow_html=True,
            )
        with sc2:
            st.markdown('<div class="chart-card-title">🧠 Recommandations commerciales</div>', unsafe_allow_html=True)
            if delta_g < 0:
                st.warning(f"📌 **Génériques hors partenaire** : le client est à {abs(delta_g):.2f} pts sous la moyenne. Proposer des alternatives génériques du catalogue.")
            if delta_gp < 0:
                st.warning(f"📌 **Génériques partenaires** : le client est à {abs(delta_gp):.2f} pts sous la moyenne. Valoriser les gammes partenaires lors de la prochaine visite.")
            if delta_g >= 0 and delta_gp >= 0:
                st.success("✅ Ce client est **performant sur les deux catégories** de génériques. Maintenir le suivi.")
        st.markdown("</div>", unsafe_allow_html=True)

        # ========================
        # TOP CLIENTS À POTENTIEL
        # ========================
        st.markdown('<div class="chart-card-title" style="margin-top:10px;">📊 Top clients à potentiel — portefeuille de ' + commercial_gen + '</div>', unsafe_allow_html=True)
        data_potentiel = []
        for c_code in df_commercial_gen["TIRCODE"].dropna().unique():
            df_c = df_commercial_gen[df_commercial_gen["TIRCODE"] == c_code]
            ca_c = df_c["CA_HT"].sum()
            if ca_c == 0:
                continue
            gen_c = df_c[norm_text(df_c["ARTNATURE"]).str.lower() == "generique"]["CA_HT"].sum()
            gen_p_c = df_c[norm_text(df_c["ARTNATURE"]).str.lower() == "generique partenaire"]["CA_HT"].sum()
            part_g_c = gen_c / ca_c * 100
            part_gp_c = gen_p_c / ca_c * 100
            ecart_g = part_gen_portef_v - part_g_c
            ecart_gp = part_gen_part_portef_v - part_gp_c
            score_c = max(0, ecart_g) + max(0, ecart_gp)
            soc = df_c["TIRSOCIETE"].iloc[0] if "TIRSOCIETE" in df_c.columns else c_code
            data_potentiel.append({
                "Code client": c_code,
                "Société": soc,
                "CA HT (€)": round(ca_c, 2),
                "% Générique client": round(part_g_c, 2),
                "% Gén. portefeuille": round(part_gen_portef_v, 2),
                "Écart générique (pts)": round(ecart_g, 2),
                "% Gén. part. client": round(part_gp_c, 2),
                "% Gén. part. portef.": round(part_gen_part_portef_v, 2),
                "Écart gén. part. (pts)": round(ecart_gp, 2),
                "Score opportunité": round(score_c, 2),
            })

        df_potentiel = (
            pd.DataFrame(data_potentiel)
            .sort_values("Score opportunité", ascending=False)
            .reset_index(drop=True)
        )
        if not df_potentiel.empty:
            st.dataframe(
                df_potentiel,
                width="stretch",
                height=320,
                column_config={
                    "CA HT (€)": st.column_config.NumberColumn(format="%.2f €"),
                    "% Générique client": st.column_config.NumberColumn(format="%.2f %%"),
                    "% Gén. portefeuille": st.column_config.NumberColumn(format="%.2f %%"),
                    "Écart générique (pts)": st.column_config.NumberColumn(format="%.2f"),
                    "% Gén. part. client": st.column_config.NumberColumn(format="%.2f %%"),
                    "% Gén. part. portef.": st.column_config.NumberColumn(format="%.2f %%"),
                    "Écart gén. part. (pts)": st.column_config.NumberColumn(format="%.2f"),
                    "Score opportunité": st.column_config.NumberColumn(format="%.2f"),
                },
                hide_index=True,
            )
        else:
            st.info("Aucun client dans le portefeuille sur cette période.")

else:
    st.info("👉 Sélectionne un client dans la barre latérale pour afficher l'analyse générique personnalisée.")
# =========================================================
# PRIORITÉS DE VISITE (V4)
# =========================================================
if st.session_state.get("opt_priorites", True) and selected_client is None:
    st.markdown('<div class="section-header print-block">🗺️ Priorités de visite</div>', unsafe_allow_html=True)
    if st.session_state.get("opt_show_help", True):
        with st.expander("ℹ️ Aide – Priorités de visite"):
            st.markdown("""
Cette section calcule un **score de priorité de visite** pour chaque pharmacie, afin d'aider le commercial à concentrer ses efforts là où l'impact sera le plus fort.

**Calcul du score (sur 100)** :  
- **CA HT** (40 %) : les clients qui génèrent le plus de CA sont prioritaires.  
- **Taux d'abandon** (30 %) : un taux élevé indique une marge importante accordée au pharmacien — client à fort potentiel à entretenir.  
- **Risque de baisse CA** (30 %) : les clients dont le CA baisse sont à visiter en urgence pour enrayer la tendance.  

**Niveaux de priorité** :  
- 🔴 **Priorité haute** : score ≥ 75  
- 🟠 **Priorité moyenne** : score entre 50 et 75  
- 🟢 **Suivi normal** : score < 50  

👉 Le tableau affiche les 25 premières pharmacies ; le graphique visualise le top 10 par score.
""")
    if client_priority_df.empty:
        st.info("Aucune priorité calculable sur le périmètre choisi.")
    else:
        col_v1, col_v2 = st.columns([1.2, 1], gap="medium")
        with col_v1:
            st.dataframe(
                style_negative_values(client_priority_df[["TIRCODE", "TIRSOCIETE", "CA_HT", "taux_abandon_pct", "VAR_CA_PCT", "SCORE_PRIORITE_VISITE", "PRIORITE_VISITE"]].head(25), ["CA_HT", "VAR_CA_PCT"]),
                width="stretch", height=360,
                column_config={"CA_HT": EUR, "taux_abandon_pct": PCT, "VAR_CA_PCT": PCT, "SCORE_PRIORITE_VISITE": st.column_config.NumberColumn(format="%.1f")},
            )
        with col_v2:
            top_visit = client_priority_df.head(10).copy()
            fig_visit = go.Figure(go.Bar(
                x=top_visit["SCORE_PRIORITE_VISITE"],
                y=(top_visit["TIRCODE"] + " " + top_visit["TIRSOCIETE"].astype(str).str[:24]),
                orientation="h",
                marker_color=COLOR_PRIMARY,
                text=top_visit["SCORE_PRIORITE_VISITE"].apply(lambda v: f"{v:.1f}"),
                textposition="outside",
            ))
            fig_visit.update_layout(
                height=360, margin=dict(l=0, r=60, t=6, b=6),
                paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
                font=dict(family="Barlow, sans-serif", size=9),
                xaxis=dict(gridcolor="#E8EEF5", tickfont_size=8),
                yaxis=dict(autorange="reversed", tickfont_size=8),
                showlegend=False,
            )
            st.markdown('<div class="chart-card">', unsafe_allow_html=True)
            st.plotly_chart(fig_visit, width="stretch")
            st.markdown("</div>", unsafe_allow_html=True)


# =========================================================
# VUE COMMERCIAUX (V4)
# =========================================================
if st.session_state.get("opt_commerciaux", True) and selected_client is None and len(commerciaux) > 1:
    st.markdown('<div class="section-header print-block">👨‍💼 Vue commerciaux</div>', unsafe_allow_html=True)
    if st.session_state.get("opt_show_help", True):
        with st.expander("ℹ️ Aide – comprendre le tableau commercial"):
            st.markdown("""
**CA brut HT** : chiffre d'affaires théorique avant abandon de marge.  
**CA net HT** : chiffre d'affaires réellement facturé au pharmacien.  
**Écart brut / net** : différence entre le CA brut et le CA net sur la période.  
**Abandon de marge** : montant accordé au pharmacien — plus il est élevé, plus la marge partagée est importante.  
**Taux d'abandon** : abandon de marge / CA brut HT — un taux élevé est favorable pour le pharmacien.  
**Évolution CA net** : variation du CA net entre le dernier mois disponible et le mois précédent.

👉 Une valeur négative en **CA brut HT** ou **CA net HT** signifie la présence d'avoirs ; la cellule est colorée en rouge clair.  
👉 Un **taux d'abandon élevé** traduit une marge importante accordée aux pharmaciens du portefeuille.
""")
    if commercial_summary_df.empty:
        st.info("Aucune donnée commercial exploitable.")
    else:
        commercial_table = commercial_summary_df[[
            "Commercial", "CA_BRUT_HT", "CA_NET_HT", "ECART_BRUT_NET_HT",
            "abandon_EUR", "taux_abandon_pct", "PHARMACIES", "FACTURES", "CA_VAR_PCT"
        ]].copy()

        c1, c2 = st.columns([1.25, 1], gap="medium")
        with c1:
            st.dataframe(
                style_negative_values(
                    commercial_table,
                    ["CA_BRUT_HT", "CA_NET_HT", "ECART_BRUT_NET_HT", "abandon_EUR", "CA_VAR_PCT"]
                ),
                width="stretch", height=340,
                column_config={
                    "CA_BRUT_HT": st.column_config.NumberColumn("CA brut HT", format="%.2f €", help="Chiffre d'affaires théorique avant abandon de marge."),
                    "CA_NET_HT": st.column_config.NumberColumn("CA net HT", format="%.2f €", help="Chiffre d'affaires réellement facturé au pharmacien."),
                    "ECART_BRUT_NET_HT": st.column_config.NumberColumn("Écart brut / net", format="%.2f €", help="Différence entre le CA brut HT et le CA net HT."),
                    "abandon_EUR": st.column_config.NumberColumn("Abandon de marge", format="%.2f €", help="Montant de marge accordé au pharmacien."),
                    "taux_abandon_pct": st.column_config.NumberColumn("Taux d'abandon", format="%.2f %%", help="Abandon de marge rapporté au CA brut HT — un taux élevé est favorable."),
                    "PHARMACIES": st.column_config.NumberColumn("Pharmacies", format="%d", help="Nombre de pharmacies distinctes suivies."),
                    "FACTURES": st.column_config.NumberColumn("Factures", format="%d", help="Nombre de factures distinctes sur la période."),
                    "CA_VAR_PCT": st.column_config.NumberColumn("Évolution CA net", format="%.2f %%", help="Variation du CA net entre le dernier mois disponible et le mois précédent."),
                },
                hide_index=True,
            )
        with c2:
            # Graphique double : CA net HT + taux d'abandon par commercial
            top_com = commercial_summary_df.copy()
            fig_com = go.Figure()
            fig_com.add_trace(go.Bar(
                x=top_com["CA_NET_HT"],
                y=top_com["Commercial"],
                orientation="h",
                marker_color=COLOR_SECONDARY,
                name="CA net HT",
                text=top_com["CA_NET_HT"].apply(lambda v: f"{v:,.0f} €"),
                textposition="outside",
                hovertemplate="%{y}<br>CA net HT : %{x:,.2f} €<extra></extra>",
            ))
            fig_com.add_trace(go.Scatter(
                x=top_com["taux_abandon_pct"],
                y=top_com["Commercial"],
                mode="markers+text",
                marker=dict(color=COLOR_PRIMARY, size=10, symbol="diamond"),
                name="Taux d'abandon (%)",
                text=top_com["taux_abandon_pct"].apply(lambda v: f"{v:.1f} %" if pd.notna(v) else ""),
                textposition="middle right",
                xaxis="x2",
                hovertemplate="%{y}<br>Taux d'abandon : %{x:.2f} %<extra></extra>",
            ))
            fig_com.update_layout(
                height=340, margin=dict(l=0, r=80, t=6, b=6),
                paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
                font=dict(family="Barlow, sans-serif", size=9),
                xaxis=dict(gridcolor="#E8EEF5", tickformat=",.0f", tickfont_size=8, title="CA net HT (€)"),
                xaxis2=dict(overlaying="x", side="top", ticksuffix=" %", tickfont_size=8, title="Taux d'abandon (%)", showgrid=False),
                yaxis=dict(autorange="reversed", tickfont_size=8),
                legend=dict(orientation="h", yanchor="bottom", y=1.08, xanchor="right", x=1, font_size=8),
            )
            st.markdown('<div class="chart-card">', unsafe_allow_html=True)
            st.plotly_chart(fig_com, width="stretch")
            st.markdown("</div>", unsafe_allow_html=True)


# =========================================================
# PLAN D'ACTION CLIENT (V4)
# =========================================================
if st.session_state.get("opt_actions_client", True) and selected_client is not None:
    st.markdown('<div class="section-header print-block">📝 Plan d’action client</div>', unsafe_allow_html=True)
    if st.session_state.get("opt_show_help", True):
        with st.expander("ℹ️ Aide – Plan d’action client"):
            st.markdown("""
Cette section est disponible uniquement en **mode client unique** (sélectionner un client dans la barre latérale).

Elle génère automatiquement un **plan d’action personnalisé** basé sur l’analyse des données du client sélectionné :

- **Actions prioritaires** : jusqu’à 6 recommandations concrètes déduites du profil du client (CA, taux d’abandon, tendance, opportunités).  
- **Top opportunités à travailler** : produits présents dans le portefeuille global mais **pas encore vendus** chez ce client, classés par score d’opportunité.  

**Score d’opportunité** :  
- ≥ 80 → **Immédiate** : produit à proposer en priorité absolue.  
- ≥ 60 → **À travailler** : bon potentiel, à intégrer dans la prochaine visite.  
- < 60 → **Secondaire** : opportunité à moyen terme.

👉 Ce plan est exportable dans l’onglet Excel **Plan_Action_Client_V4**.
""")
    if client_action_plan_df.empty:
        st.info("Aucun plan d'action disponible.")
    else:
        for idx, action in enumerate(client_action_items[:6], start=1):
            st.markdown(
                f'<div class="chart-card" style="padding:10px 12px;margin-bottom:8px;">'
                f'<div class="chart-card-title">Action {idx}</div>'
                f'<div style="font-size:0.95rem;font-weight:700;color:{COLOR_SECONDARY};">{action}</div>'
                f'</div>',
                unsafe_allow_html=True,
            )
        if not opportunity_scored_df.empty:
            st.markdown('<div class="chart-card-title">Top opportunités à travailler</div>', unsafe_allow_html=True)
            st.dataframe(
                style_negative_values(opportunity_scored_df[["PLVDESIGNATION", "CA_HT", "QTE", "SCORE_OPPORTUNITE", "PRIORITE_ACTION"]].head(10), ["CA_HT"]),
                width="stretch", height=280,
                column_config={"CA_HT": EUR, "QTE": INT, "SCORE_OPPORTUNITE": st.column_config.NumberColumn(format="%.1f")},
            )



# =========================================================
# EXPORT EXCEL (désactivable)
# =========================================================
if ACTIVER_EXPORT:
    st.markdown('<div class="section-header no-print">⬇️ Export</div>', unsafe_allow_html=True)
    if st.session_state.get("opt_show_help", True):
        with st.expander("ℹ️ Aide – Export Excel"):
            st.markdown("""
Le bouton **Exporter en Excel (Complet)** génère un fichier `.xlsx` multi-onglets contenant toutes les données calculées sur le périmètre filtré.

**Onglets inclus selon le contexte :**

- **Résumé_KPI** : les 6 indicateurs clés affichés en haut du tableau de bord.
- **CA_par_mois** : évolution mensuelle du CA HT, montant brut et abandon.
- **Par_Tranche_Prix** : abandon de marge ventilé par tranche de prix (hors génériques).
- **Produits_Tous** : tous les produits agrégés sur le périmètre.
- **Comparatif_Mensuel_V2** : comparaison dernier mois vs mois précédent.
- **Comparatif_N_vs_N-1_V3** : comparaison N vs N-1 sur la période filtrée.
- **Priorites_Visite_V4** : scoring et classement des pharmacies à visiter (mode portefeuille).
- **Vue_Commerciaux_V4** : performance par commercial (mode portefeuille).
- **Performance_Pharmacies** / **Scoring_Clients_V2** : données clients enrichies (mode portefeuille).
- **Opportunites_V2** / **Opportunites_Scorees_V4** : opportunités commerciales (mode client unique).
- **Analyse_Generiques_Labos** : CA génériques / génériques partenaires par laboratoire.
- **Produits_en_Baisse** : produits en recul sur la période.

👉 Le nom du fichier inclut le périmètre (portefeuille ou client) et la date/heure d'export.
""")

    export_dict = {
        "Résumé_KPI": pd.DataFrame(kpi_data, columns=["Icône", "Indicateur", "Valeur", "Couleur_Hex"]),
        "CA_par_mois": mois_scope,
        "Par_Tranche_Prix": tr_table,
        "Produits_Tous": prod_scope,
        "Comparatif_Mensuel_V2": pd.DataFrame([period_compare]) if period_compare else pd.DataFrame(),
        "Comparatif_N_vs_N-1_V3": pd.DataFrame([yoy_compare]) if yoy_compare else pd.DataFrame(),
        "Priorites_Visite_V4": client_priority_df,
        "Vue_Commerciaux_V4": commercial_summary_df,
        "Plan_Action_Client_V4": client_action_plan_df,
    }

    if selected_client is None:
        if not clients_scope.empty:
            sort_col_perf = "CA_HT" if "CA_HT" in clients_scope.columns else clients_scope.columns[0]
            sort_col_score = "SCORE_CLIENT" if "SCORE_CLIENT" in clients_scope.columns else sort_col_perf
            export_dict["Performance_Pharmacies"] = clients_scope.sort_values(sort_col_perf, ascending=False)
            export_dict["Scoring_Clients_V2"] = clients_scope.sort_values(sort_col_score, ascending=False)
    else:
        if not opportunities_df.empty:
            export_dict["Opportunites_V2"] = opportunities_df
            export_dict["Opportunites_Scorees_V4"] = opportunity_scored_df

    if "analyse_lab" in locals() and analyse_lab is not None and not analyse_lab.empty:
        export_dict["Analyse_Generiques_Labos"] = analyse_lab

    if "brand_scope" in locals() and st.session_state.get("opt_marques", True) and brand_scope is not None and not brand_scope.empty:
        export_dict["Marques_V3"] = brand_scope

    if st.session_state.get("opt_top_produits", True):
        export_dict["Top20_Marge_Pct"] = top20_pct
        export_dict["Top20_Marge_EUR"] = top20_eur

    if st.session_state.get("opt_bio", True):
        export_dict["Bio_Top10_CA"] = bio_ca
        export_dict["Bio_Top10_Marge"] = bio_marge

    if st.session_state.get("opt_froid", True):
        export_dict["Froid_Top20_CA"] = froid_ca
        export_dict["Froid_Top20_Marge"] = froid_marge

    if not baisse_view.empty:
        export_dict["Produits_en_Baisse"] = baisse_view

    xbytes = to_excel_bytes(export_dict)

    col_exp1, col_exp2 = st.columns([2, 5])
    with col_exp1:
        st.download_button(
            "⬇️ Exporter en Excel (Complet)",
            data=xbytes,
            file_name=f"IntegralAnalytics_{'_'.join(selected_client_name.split()[:2]) if selected_client_name else 'Portefeuille'}_{datetime.now().strftime('%Y%m%d_%H%M')}.xlsx",
            mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )

# =========================
# EXPORT — DÉSACTIVÉ
# =========================
# Passe ACTIVER_EXPORT = True en haut du script pour le réactiver.
