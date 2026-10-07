import os
import re
import sqlite3
from datetime import datetime
from collections import defaultdict
from typing import List, Dict, Any, Optional

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from pdfminer.high_level import extract_pages
from pdfminer.layout import LTTextContainer, LTTextLineHorizontal, LTChar


# ============================================================
# PATHS
# ============================================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

UPLOAD_DIR = "/tmp/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

DB_PATH = "/tmp/finance.db"


# ============================================================
# FASTAPI
# ============================================================

app = FastAPI(
    title="Where Is My Money Going?"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# DATABASE
# ============================================================

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT,
            description TEXT,
            merchant TEXT,
            amount REAL,
            type TEXT,
            category TEXT,
            created_at TEXT
        )
        """
    )

    conn.commit()
    conn.close()


init_db()


# ============================================================
# BASIC TEXT HELPERS
# ============================================================

def clean_text(text: str) -> str:
    if not text:
        return ""

    text = text.replace(
        "\xa0",
        " "
    )

    text = re.sub(
        r"\s+",
        " ",
        text
    )

    return text.strip()


def clean_description(description: str) -> str:
    description = clean_text(description)

    description = re.sub(
        r"^\s*[-:]+\s*",
        "",
        description
    )

    return description[:500]


# ============================================================
# DATE PARSING
# ============================================================

MONTHS = {
    "jan": 1,
    "feb": 2,
    "mar": 3,
    "apr": 4,
    "may": 5,
    "jun": 6,
    "jul": 7,
    "aug": 8,
    "sep": 9,
    "oct": 10,
    "nov": 11,
    "dec": 12,
}


DATE_REGEX = re.compile(
    r"^\s*(\d{1,2})\s*"
    r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)"
    r"\s*(\d{2,4})\s*$",
    re.IGNORECASE
)


def parse_date_text(text: str) -> Optional[str]:
    if not text:
        return None

    text = clean_text(text)

    match = DATE_REGEX.match(text)

    if not match:
        return None

    day = int(match.group(1))

    month_name = match.group(2).lower()

    year = int(match.group(3))

    if year < 100:
        year += 2000

    month = MONTHS.get(month_name)

    if not month:
        return None

    try:
        date_obj = datetime(
            year,
            month,
            day
        )

        return date_obj.strftime(
            "%Y-%m-%d"
        )

    except ValueError:
        return None


def is_date(text: str) -> bool:
    return parse_date_text(text) is not None


# ============================================================
# AMOUNT PARSING
# ============================================================

def parse_amount(text: str) -> Optional[float]:
    if not text:
        return None

    text = clean_text(text)

    text = (
        text
        .replace("₹", "")
        .replace(",", "")
        .replace(" ", "")
    )

    text = text.strip(":")

    # Supports:
    # 100
    # 100.50
    # -100
    # -100.50
    if not re.fullmatch(
        r"-?\d+(?:\.\d{1,2})?",
        text
    ):
        return None

    try:
        return float(text)

    except ValueError:
        return None


# ============================================================
# COLUMN POSITIONS
# ============================================================

def classify_amount_column(
    center_x: float
) -> Optional[str]:

    # Standard Chartered statement
    #
    # Deposit    ≈ 408
    # Withdrawal ≈ 480
    # Balance    ≈ 546

    if 382 <= center_x <= 435:
        return "deposit"

    if 450 <= center_x <= 510:
        return "withdrawal"

    if 520 <= center_x <= 575:
        return "balance"

    return None


# ============================================================
# PDF EXTRACTION
# ============================================================

def extract_pdf_words(
    pdf_path: str
) -> List[Dict[str, Any]]:

    all_words = []

    for page_number, page_layout in enumerate(
        extract_pages(pdf_path),
        start=1
    ):

        for element in page_layout:

            if not isinstance(
                element,
                LTTextContainer
            ):
                continue

            for line in element:

                if not isinstance(
                    line,
                    LTTextLineHorizontal
                ):
                    continue

                chars = []

                for child in line:

                    if isinstance(
                        child,
                        LTChar
                    ):
                        chars.append(child)

                if not chars:
                    continue

                # ------------------------------------------------
                # Build text from characters
                # ------------------------------------------------

                current_text = ""

                word_x0 = None
                word_x1 = None
                word_y0 = None
                word_y1 = None

                previous_x1 = None

                def flush_word():

                    nonlocal current_text
                    nonlocal word_x0
                    nonlocal word_x1
                    nonlocal word_y0
                    nonlocal word_y1

                    if not current_text.strip():

                        current_text = ""
                        word_x0 = None
                        word_x1 = None
                        word_y0 = None
                        word_y1 = None

                        return

                    all_words.append(
                        {
                            "page": page_number,

                            "text": clean_text(
                                current_text
                            ),

                            "x0": word_x0,
                            "x1": word_x1,

                            "y0": word_y0,
                            "y1": word_y1,

                            "yc": (
                                word_y0 +
                                word_y1
                            ) / 2,
                        }
                    )

                    current_text = ""
                    word_x0 = None
                    word_x1 = None
                    word_y0 = None
                    word_y1 = None

                for char in chars:

                    text = char.get_text()

                    if not text:
                        continue

                    x0 = float(char.x0)
                    x1 = float(char.x1)
                    y0 = float(char.y0)
                    y1 = float(char.y1)

                    # ------------------------------------------------
                    # Space detection
                    # ------------------------------------------------

                    gap = 0

                    if previous_x1 is not None:
                        gap = x0 - previous_x1

                    is_space = (
                        text.isspace()
                        or gap > 3.0
                    )

                    if is_space:

                        flush_word()

                        previous_x1 = x1

                        continue

                    if word_x0 is None:
                        word_x0 = x0

                    word_x1 = x1

                    if word_y0 is None:
                        word_y0 = y0

                    word_y1 = y1

                    current_text += text

                    previous_x1 = x1

                flush_word()

    return all_words


# ============================================================
# GROUP WORDS INTO ROWS
# ============================================================

def group_words_into_rows(
    words: List[Dict[str, Any]]
) -> Dict[int, List[List[Dict[str, Any]]]]:

    pages = defaultdict(list)

    for word in words:

        pages[
            word["page"]
        ].append(word)

    result = {}

    for page_number, page_words in pages.items():

        page_words = sorted(
            page_words,
            key=lambda x: -x["yc"]
        )

        rows = []

        for word in page_words:

            placed = False

            for row in rows:

                row_y = sum(
                    item["yc"]
                    for item in row
                ) / len(row)

                if abs(
                    word["yc"] - row_y
                ) <= 3.5:

                    row.append(word)

                    placed = True

                    break

            if not placed:
                rows.append([word])

        for row in rows:

            row.sort(
                key=lambda x: x["x0"]
            )

        result[
            page_number
        ] = rows

    return result


# ============================================================
# FIND DATE IN ROW
# ============================================================

def find_date_in_row(
    row: List[Dict[str, Any]]
) -> Optional[str]:

    # First try complete extracted words

    for word in row:

        date = parse_date_text(
            word["text"]
        )

        if date:
            return date

    # --------------------------------------------------------
    # Sometimes pdfminer splits:
    #
    # 17
    # Jun
    # 19
    #
    # so join the left side of the row.
    # --------------------------------------------------------

    left_words = [
        word
        for word in row
        if word["x0"] < 100
    ]

    left_words.sort(
        key=lambda x: x["x0"]
    )

    text = " ".join(
        word["text"]
        for word in left_words
    )

    match = re.search(
        r"(\d{1,2})\s*"
        r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)"
        r"\s*(\d{2,4})",
        text,
        re.IGNORECASE
    )

    if match:

        return parse_date_text(
            match.group(0)
        )

    return None


# ============================================================
# IGNORE NON-TRANSACTION ROWS
# ============================================================

def should_ignore_row(
    text: str
) -> bool:

    lower = text.lower().strip()

    # ----------------------------------------------------
    # HEADER / ACCOUNT INFORMATION
    # ----------------------------------------------------

    header_phrases = [
        "account statement",
        "account number",
        "customer id",
        "branch address",
        "micr",
        "ifsc",
        "transaction details",
        "statement period",
        "generated on",
        "this is a computer generated",
        "reward points",
        "reward plus",
        "opening points",
        "closing points",
    ]

    for phrase in header_phrases:

        if phrase in lower:
            return True

    # ----------------------------------------------------
    # TABLE HEADER ONLY
    # ----------------------------------------------------

    if lower in {
        "withdrawal",
        "deposit",
        "balance",
        "value date",
        "date",
        "description",
        "cheque",
        "date description cheque deposit withdrawal balance",
    }:
        return True

    # ----------------------------------------------------
    # FOOTER TOTALS
    # ----------------------------------------------------

    if re.match(
        r"^total\b",
        lower
    ):
        return True

    return False


# ============================================================
# PARSE ONE PAGE
# ============================================================

def parse_page(
    rows: List[List[Dict[str, Any]]],
    page_number: int
) -> List[Dict[str, Any]]:

    transactions = []

    current_date = None

    for row_index, row in enumerate(rows):

        row_text = clean_text(
            " ".join(
                word["text"]
                for word in row
            )
        )

        if not row_text:
            continue

        # ----------------------------------------------------
        # DATE
        # ----------------------------------------------------

        row_date = find_date_in_row(
            row
        )

        if row_date:
            current_date = row_date


        # ----------------------------------------------------
        # Ignore headers
        # ----------------------------------------------------

        if should_ignore_row(
            row_text
        ):
            continue

        # A transaction needs a date

        if current_date is None:
            continue

        # ----------------------------------------------------
        # FIND AMOUNTS
        # ----------------------------------------------------

        deposits = []
        withdrawals = []

        for word in row:

            amount = parse_amount(
                word["text"]
            )

            if amount is None:
                continue

            center_x = (
                word["x0"] +
                word["x1"]
            ) / 2

            column = classify_amount_column(
                center_x
            )

            if column == "deposit":

                deposits.append(
                    amount
                )

            elif column == "withdrawal":

                withdrawals.append(
                    amount
                )

        if not deposits and not withdrawals:
            continue

        # ----------------------------------------------------
        # DESCRIPTION
        # ----------------------------------------------------

        description_words = []

        for word in row:

            text = word["text"]

            if not text:
                continue

            if word["x0"] < 80:
                continue

            center_x = (
                word["x0"] +
                word["x1"]
            ) / 2

            # Skip amount columns

            if center_x >= 380:
                continue

            # Skip dates

            if is_date(text):
                continue

            # Skip pure numeric fragments

            if parse_amount(text) is not None:
                continue

            description_words.append(
                text
            )

        description = clean_description(
            " ".join(
                description_words
            )
        )

        if not description:
            description = "Bank transaction"

        # ----------------------------------------------------
        # CREDIT
        # ----------------------------------------------------

        for amount in deposits:

            if amount <= 0:
                continue

            transactions.append(
                {
                    "date": current_date,

                    "description": description,

                    "amount": round(
                        amount,
                        2
                    ),

                    "type": "credit",
                }
            )

        # ----------------------------------------------------
        # DEBIT
        # ----------------------------------------------------

        for amount in withdrawals:

            if amount <= 0:
                continue

            transactions.append(
                {
                    "date": current_date,

                    "description": description,

                    "amount": round(
                        amount,
                        2
                    ),

                    "type": "debit",
                }
            )

    return transactions


# ============================================================
# PARSE COMPLETE PDF
# ============================================================

def parse_transactions_from_pdf(
    pdf_path: str
) -> List[Dict[str, Any]]:

    words = extract_pdf_words(
        pdf_path
    )

    if not words:
        print(
            "ERROR: pdfminer extracted ZERO words."
        )
        return []

    grouped_pages = group_words_into_rows(
        words
    )

    all_transactions = []

    for page_number in sorted(
        grouped_pages.keys()
    ):
        rows = grouped_pages[
            page_number
        ]

        page_transactions = parse_page(
            rows,
            page_number
        )

        all_transactions.extend(
            page_transactions
        )

    return all_transactions


# ============================================================
# CLEAN TRANSACTIONS
# ============================================================

def clean_transactions(
    transactions: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:

    cleaned = []

    for transaction in transactions:

        if not transaction.get("date"):
            continue

        try:

            amount = float(
                transaction.get(
                    "amount",
                    0
                )
            )

        except (
            TypeError,
            ValueError
        ):

            continue

        if amount <= 0:
            continue

        if transaction.get("type") not in [
            "credit",
            "debit"
        ]:
            continue

        cleaned.append(
            {
                "date": transaction["date"],

                "description": clean_description(
                    transaction.get(
                        "description",
                        ""
                    )
                ),

                "amount": round(
                    amount,
                    2
                ),

                "type": transaction["type"],
            }
        )

    return cleaned


# ============================================================
# MERCHANT DETECTION
# ============================================================

def detect_merchant(
    description: str
) -> str:

    text = description.upper()

    rules = [
        ("AMAZONPAY", "Amazon Pay"),
        ("AMAZON", "Amazon"),
        ("IXIGO", "ixigo"),
        ("TRAVENUES", "ixigo"),
        ("PAYTM", "Paytm"),
        ("AIRTEL", "Airtel"),
        ("TNEB", "TNEB"),
        ("BILLDESK", "BillDesk"),
        ("LIC", "LIC"),
        ("LIFE STYLE", "Lifestyle"),
        ("LIFESTYLE", "Lifestyle"),
        ("THANGAMALIGAI", "G R Thangamaligai"),
        ("ANANDA VILAS", "Ananda Vilas Hotel"),
        ("ATM WITHDRAWAL", "ATM"),
        ("ATM", "ATM"),
        ("FUND TRANSFER", "Bank Transfer"),
        ("TRANSFER", "Bank Transfer"),
        ("IMPS P2A CHARGES", "Bank Charges"),
        ("CHARGES", "Bank Charges"),
        ("CGST", "Bank Charges"),
        ("SGST", "Bank Charges"),
    ]

    for keyword, merchant in rules:

        if keyword in text:
            return merchant

    if "UPI" in text:

        parts = [
            part.strip()
            for part in re.split(
                r"/+",
                description
            )
            if part.strip()
        ]

        for part in parts:

            if (
                len(part) >= 3
                and not part.isdigit()
                and part.upper() != "UPI"
            ):
                return part[:80]

    if "IMPS" in text:
        return "IMPS Transfer"

    if "NEFT" in text:
        return "NEFT Transfer"

    return description[:80]


# ============================================================
# CATEGORY CLASSIFICATION
# ============================================================

def classify_category(
    description: str,
    merchant: str,
    transaction_type: str
) -> str:

    if str(
        transaction_type
    ).lower() == "credit":

        return "Income"

    description_text = str(
        description or ""
    ).strip().upper()

    merchant_text = str(
        merchant or ""
    ).strip().upper()

    text = (
        f"{description_text} "
        f"{merchant_text}"
    )

    if (
        "CHARGE" in text
        or "CGST" in text
        or "SGST" in text
    ):
        return "Fees"

    if "ATM" in text:
        return "Cash"

    if "LIC" in text:
        return "Insurance"

    if (
        "AMAZON" in text
        or "LIFESTYLE" in text
        or "THANGAMALIGAI" in text
        or "PURCHASE" in text
    ):
        return "Shopping"

    if (
        "IXIGO" in text
        or "TRAVENUES" in text
        or "HOTEL" in text
        or "TRAVEL" in text
    ):
        return "Travel"

    if (
        "AIRTEL" in text
        or "TNEB" in text
        or "BILLDESK" in text
        or "ELECTRICITY" in text
        or "UTILITY" in text
        or "RECHARGE" in text
    ):
        return "Bills & Utilities"

    if "UPI" in text:
        return "UPI"

    if (
        "IMPS" in text
        or "NEFT" in text
        or "TRANSFER" in text
        or "FUND TRANSFER" in text
    ):
        return "Transfer"

    return "Other"


# ============================================================
# NORMALIZE TRANSACTIONS
# ============================================================

def normalize_transactions(
    transactions: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:

    result = []

    for transaction in transactions:

        original_description = str(
            transaction.get("description", "")
        ).strip()

        description = clean_description(
            original_description
        )

        transaction_type = str(
            transaction.get("type", "")
        ).strip().lower()

        merchant = detect_merchant(description)

        text = " ".join([
            original_description,
            description,
            str(merchant or "")
        ]).upper()

        normalized = re.sub(
            r"[^A-Z0-9]",
            "",
            text
        )

        # ====================================================
        # 1. CREDIT / INCOME
        # ====================================================

        if transaction_type == "credit":
            category = "Income"

        # ====================================================
        # 2. BANK CHARGES
        # ====================================================

        elif (
            "CHARGE" in normalized
            or "CGST" in normalized
            or "SGST" in normalized
            or "FEE" in normalized
        ):
            category = "Fees"

        # ====================================================
        # 3. ATM / CASH
        # ====================================================

        elif (
            "ATMWITHDRAWAL" in normalized
            or "CASHWITHDRAWAL" in normalized
            or "TMWITHDRAWAL" in normalized
            or normalized.startswith("ATM")
        ):
            category = "Cash"

        # ====================================================
        # 4. INSURANCE
        # ====================================================

        elif "LIC" in normalized:
            category = "Insurance"

        # ====================================================
        # 5. TRAVEL
        # ====================================================

        elif (
            "ANANDAVILAS" in normalized
            or "IXIGO" in normalized
            or "TRAVENUES" in normalized
            or "HOTEL" in normalized
            or "TRAVEL" in normalized
        ):
            category = "Travel"

        # ====================================================
        # 6. SHOPPING
        # ====================================================

        elif (
            "AMAZON" in normalized
            or "LIFESTYLE" in normalized
            or "THANGAMALIGAI" in normalized
            or "PURCHASE" in normalized
            or "SHOPPING" in normalized
        ):
            category = "Shopping"

        # ====================================================
        # 7. UPI
        # ====================================================

        elif (
            "UPI" in normalized
            or "PI/" in text
            or "/PI/" in text
        ):
            category = "UPI"

        # ====================================================
        # 8. BANK TRANSFER
        # ====================================================

        elif (
            "FUNDTRANSFER" in normalized
            or "TRANSFER" in normalized
            or "IMPS" in normalized
            or "NEFT" in normalized
            or "MPSP2A" in normalized
        ):
            category = "Transfer"

        # ====================================================
        # 9. BILLS & UTILITIES
        # ====================================================

        elif (
            "AIRTEL" in normalized
            or "TNEB" in normalized
            or "BILLDESK" in normalized
            or "ELECTRICITY" in normalized
            or "UTILITY" in normalized
            or "RECHARGE" in normalized
        ):
            category = "Bills & Utilities"

        else:
            category = "Other"

        result.append({
            "date": transaction.get("date", ""),
            "description": description,
            "merchant": merchant,
            "amount": transaction.get("amount", 0),
            "type": transaction_type,
            "category": category,
        })

    return result
    # ============================================================
# ANALYTICS
# ============================================================

def calculate_analytics(
    transactions: List[Dict[str, Any]]
) -> Dict[str, Any]:

    total_income = 0.0
    total_spending = 0.0

    category_totals = defaultdict(float)
    merchant_totals = defaultdict(float)
    daily_totals = defaultdict(float)

    for transaction in transactions:
        amount = float(
            transaction.get("amount", 0) or 0
        )

        transaction_type = str(
            transaction.get("type", "")
        ).lower()

        if transaction_type == "credit":
            total_income += amount
            continue

        if transaction_type != "debit":
            continue

        total_spending += amount

        category = (
            transaction.get("category")
            or "Other"
        )

        merchant = (
            transaction.get("merchant")
            or "Unknown"
        )

        date = (
            transaction.get("date")
            or ""
        )

        category_totals[category] += amount
        merchant_totals[merchant] += amount

        if date:
            daily_totals[date] += amount

    savings = total_income - total_spending

    savings_rate = (
        (savings / total_income) * 100
        if total_income > 0
        else 0
    )

    category_spending = [
        {
            "category": category,
            "amount": round(amount, 2)
        }
        for category, amount in category_totals.items()
    ]

    category_spending.sort(
        key=lambda x: x["amount"],
        reverse=True
    )

    top_merchants = [
        {
            "merchant": merchant,
            "amount": round(amount, 2)
        }
        for merchant, amount in merchant_totals.items()
    ]

    top_merchants.sort(
        key=lambda x: x["amount"],
        reverse=True
    )

    daily_spending = [
        {
            "date": date,
            "amount": round(amount, 2)
        }
        for date, amount in daily_totals.items()
    ]

    daily_spending.sort(
        key=lambda x: x["date"]
    )

    anomalies = detect_anomalies(
        transactions
    )

    return {
        "total_income": round(
            total_income,
            2
        ),
        "total_spending": round(
            total_spending,
            2
        ),
        "savings": round(
            savings,
            2
        ),
        "savings_rate": round(
            savings_rate,
            2
        ),
        "category_spending": category_spending,
        "daily_spending": daily_spending,
        "top_merchants": top_merchants[:10],
        "anomalies": anomalies,
    }


# ============================================================
# ANOMALY DETECTION
# ============================================================

def detect_anomalies(
    transactions: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:

    debit_transactions = [
        transaction
        for transaction in transactions
        if str(
            transaction.get("type", "")
        ).lower() == "debit"
    ]

    if len(debit_transactions) < 3:
        return []

    amounts = sorted(
        float(
            transaction.get("amount", 0) or 0
        )
        for transaction in debit_transactions
    )

    n = len(amounts)

    def percentile(values, percentile):
        if not values:
            return 0

        index = (
            (len(values) - 1)
            * percentile
        )

        lower = int(index)
        upper = min(
            lower + 1,
            len(values) - 1
        )

        weight = index - lower

        return (
            values[lower]
            + (
                values[upper]
                - values[lower]
            ) * weight
        )

    q1 = percentile(
        amounts,
        0.25
    )

    q3 = percentile(
        amounts,
        0.75
    )

    iqr = q3 - q1

    iqr_threshold = (
        q3 + 1.5 * iqr
    )

    median = percentile(
        amounts,
        0.50
    )

    median_threshold = (
        median * 3
    )

    threshold = max(
        iqr_threshold,
        median_threshold
    )

    anomalies = []

    for transaction in debit_transactions:

        amount = float(
            transaction.get(
                "amount",
                0
            ) or 0
        )

        if amount > threshold:

            anomalies.append(
                {
                    "date": transaction.get(
                        "date",
                        ""
                    ),
                    "merchant": transaction.get(
                        "merchant",
                        "Unknown"
                    ),
                    "category": transaction.get(
                        "category",
                        "Other"
                    ),
                    "amount": round(
                        amount,
                        2
                    ),
                    "description": transaction.get(
                        "description",
                        ""
                    ),
                    "reason": (
                        "This transaction is "
                        "significantly higher than "
                        "your usual spending."
                    ),
                }
            )

    anomalies.sort(
        key=lambda x: x["amount"],
        reverse=True
    )

    return anomalies[:10]


# ============================================================
# SAVE TRANSACTIONS
# ============================================================

def save_transactions(
    transactions: List[Dict[str, Any]]
):

    conn = get_db()

    conn.execute(
        "DELETE FROM transactions"
    )

    created_at = datetime.now().isoformat()

    for transaction in transactions:

        conn.execute(
            """
            INSERT INTO transactions (
                date,
                description,
                merchant,
                amount,
                type,
                category,
                created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                transaction["date"],
                transaction["description"],
                transaction["merchant"],
                transaction["amount"],
                transaction["type"],
                transaction["category"],
                created_at,
            )
        )

    conn.commit()
    conn.close()


# ============================================================
# FINANCIAL INSIGHTS
# ============================================================

def generate_ai_insights(
    analytics: Dict[str, Any]
) -> List[str]:

    insights = []

    income = analytics.get(
        "total_income",
        0
    )

    spending = analytics.get(
        "total_spending",
        0
    )

    savings = analytics.get(
        "savings",
        0
    )

    savings_rate = analytics.get(
        "savings_rate",
        0
    )

    categories = analytics.get(
        "category_spending",
        []
    )

    insights.append(
        f"Your total income is ₹{income:,.2f} "
        f"and total spending is ₹{spending:,.2f}."
    )

    if categories:

        highest_category = categories[0]

        insights.append(
            f"Your highest spending category is "
            f"{highest_category['category']} "
            f"at ₹{highest_category['amount']:,.2f}."
        )

    if savings >= 0:

        insights.append(
            f"You saved ₹{savings:,.2f}, "
            f"which is a savings rate of "
            f"{savings_rate:.2f}%."
        )

    else:

        insights.append(
            f"Your spending exceeded your income "
            f"by ₹{abs(savings):,.2f}."
        )

    return insights


# ============================================================
# ROOT
# ============================================================

@app.get("/")
def root():

    return {
        "message": (
            "Where Is My Money Going? "
            "API is running."
        ),
        "docs": "/docs"
    }


# ============================================================
# HEALTH
# ============================================================

@app.get("/health")
def health():

    return {
        "status": "healthy"
    }


# ============================================================
# UPLOAD STATEMENT
# ============================================================

@app.post("/upload-statement")
async def upload_statement(
    file: UploadFile = File(...)
):

    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="Please select a PDF file."
        )

    filename = os.path.basename(
        file.filename
    )

    if not filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are supported."
        )

    safe_filename = re.sub(
        r"[^A-Za-z0-9._-]",
        "_",
        filename
    )

    file_path = os.path.join(
        UPLOAD_DIR,
        safe_filename
    )

    try:

        contents = await file.read()

        # 25 MB maximum
        if len(contents) > 25 * 1024 * 1024:
            raise HTTPException(
                status_code=413,
                detail="PDF file is too large. Maximum size is 25 MB."
            )

        with open(
            file_path,
            "wb"
        ) as output_file:

            output_file.write(
                contents
            )

        raw_transactions = (
            parse_transactions_from_pdf(
                file_path
            )
        )

        transactions = clean_transactions(
            raw_transactions
        )

        transactions = normalize_transactions(
            transactions
        )

        if not transactions:

            raise HTTPException(
                status_code=422,
                detail={
                    "message": (
                        "No transactions could be "
                        "extracted from this PDF."
                    ),
                    "raw_transaction_count": len(
                        raw_transactions
                    ),
                    "final_transaction_count": 0
                }
            )

        analytics = calculate_analytics(
            transactions
        )

        save_transactions(
            transactions
        )

        insights = generate_ai_insights(
            analytics
        )

        return {
            "message": (
                "Statement processed successfully"
            ),
            "filename": file.filename,
            "transaction_count": len(
                transactions
            ),
            "transactions": transactions,
            "analytics": analytics,
            "ai_insights": insights,
            "debug": {
                "raw_transaction_count": len(
                    raw_transactions
                ),
                "final_transaction_count": len(
                    transactions
                )
            }
        }

    except HTTPException:
        raise

    except Exception as error:

        print(
            "UPLOAD ERROR:",
            repr(error)
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Could not process the PDF. "
                f"Error: {str(error)}"
            )
        )


# ============================================================
# GET TRANSACTIONS
# ============================================================

@app.get("/transactions")
def get_transactions():

    conn = get_db()

    rows = conn.execute(
        """
        SELECT
            id,
            date,
            description,
            merchant,
            amount,
            type,
            category,
            created_at
        FROM transactions
        ORDER BY date ASC, id ASC
        """
    ).fetchall()

    conn.close()

    return {
        "transactions": [
            dict(row)
            for row in rows
        ]
    }


# ============================================================
# GET ANALYTICS
# ============================================================

@app.get("/analytics")
def get_analytics():

    conn = get_db()

    rows = conn.execute(
        """
        SELECT
            date,
            description,
            merchant,
            amount,
            type,
            category
        FROM transactions
        ORDER BY date ASC, id ASC
        """
    ).fetchall()

    conn.close()

    transactions = [
        dict(row)
        for row in rows
    ]

    return calculate_analytics(
        transactions
    )


# ============================================================
# RUN SERVER
# ============================================================

if __name__ == "__main__":

    import uvicorn

    uvicorn.run(
        app,
        host="127.0.0.1",
        port=8000,
        reload=True
    )