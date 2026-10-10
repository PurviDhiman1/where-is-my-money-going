# Where Is My Money Going?

> A privacy-focused personal finance analyzer that turns bank statement PDFs into clear, actionable spending insights.

**Where Is My Money Going?** is a full-stack financial analysis application that extracts transactions from bank statement PDFs, categorizes spending, identifies unusual transactions, and presents financial patterns through an interactive dashboard.

The application is designed around **local financial analysis**, keeping uploaded statements and generated transaction data on the user's machine rather than relying on a third-party financial data platform.

---

LIVE:   where-is-my-money-going-sable.vercel.app

---

## ✨ Features

* 📄 **Bank Statement PDF Parsing**

  * Extracts transaction data directly from uploaded PDF statements.
  * Supports dates, descriptions, transaction amounts, and transaction types.

* 📊 **Financial Overview**

  * Total income
  * Total spending
  * Net amount saved
  * Savings rate

* 🧾 **Transaction Categorization**

  * Income
  * Transfer
  * Shopping
  * Cash
  * UPI
  * Travel
  * Fees
  * Bills & Utilities
  * Insurance
  * Other

* 📈 **Interactive Analytics**

  * Spending breakdown
  * Top merchants
  * Spending over time
  * Savings vs. spending

* 🚨 **Anomaly Detection**

  * Identifies transactions that are significantly larger than typical spending activity.

* 💡 **Financial Insights**

  * Generates observations from the analyzed transaction data.
  * Highlights spending patterns and savings performance.

* 🔒 **Privacy-Focused Architecture**

  * Bank statements are processed locally by the application.
  * Sensitive files and local financial databases are excluded from version control.

---

## 🖥️ Dashboard

The dashboard provides a consolidated view of the analyzed statement:

* Statement overview
* Spending categories
* Top merchants
* Spending trends
* Savings distribution
* Financial insights
* Anomaly detection
* Complete transaction history

---

## 🛠️ Tech Stack

### Frontend

* React
* Vite
* Tailwind CSS
* Recharts
* Lucide React

### Backend

* Python
* FastAPI
* pdfminer
* SQLite

### Data Processing

* PDF coordinate-based text extraction
* Transaction normalization
* Rule-based transaction categorization
* Statistical anomaly detection
* Financial analytics

---

## 🏗️ Architecture

```text
                    ┌──────────────────────┐
                    │   Bank Statement     │
                    │         PDF          │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │   PDF Extraction     │
                    │      pdfminer        │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │ Transaction Parsing  │
                    │ & Normalization      │
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │     SQLite DB        │
                    │   Local Storage      │
                    └──────────┬───────────┘
                               │
                 ┌─────────────┴─────────────┐
                 ▼                           ▼
        ┌─────────────────┐        ┌──────────────────┐
        │ Financial       │        │ Anomaly &        │
        │ Analytics       │        │ Insight Engine   │
        └────────┬────────┘        └────────┬─────────┘
                 │                          │
                 └────────────┬─────────────┘
                              ▼
                    ┌──────────────────────┐
                    │   React Dashboard    │
                    └──────────────────────┘
```

---

## 📊 Example Analysis

For a sample statement containing **51 transactions**, the application can generate:

| Metric           |     Result |
| ---------------- | ---------: |
| Total Income     | ₹70,986.83 |
| Total Spending   | ₹69,291.02 |
| Net Amount Saved |  ₹1,695.81 |
| Savings Rate     |      2.39% |

Example spending distribution:

| Category | Share |
| -------- | ----: |
| Transfer | 28.9% |
| Shopping | 25.8% |
| Cash     | 25.0% |
| UPI      | 18.7% |
| Travel   |  1.4% |
| Fees     |  0.2% |

---

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/PurviDhiman1/where-is-my-money-going.git
cd where-is-my-money-going
```

### 2. Backend Setup

```bash
cd backend
```

Create a virtual environment:

```bash
python3 -m venv venv
```

Activate it:

```bash
source venv/bin/activate
```

Install dependencies:

```bash
pip install fastapi uvicorn pdfminer.six python-multipart
```

Start the backend:

```bash
uvicorn main:app --reload
```

The API will be available at:

```text
http://127.0.0.1:8000
```

API documentation:

```text
http://127.0.0.1:8000/docs
```

### 3. Frontend Setup

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

Then open:

```text
http://localhost:5173
```

### 4. Analyze a Statement

1. Open the web application.
2. Upload a bank statement PDF.
3. Wait for transaction extraction and analysis.
4. Explore the generated financial dashboard.

---

## 🔌 API Endpoints

| Endpoint            | Method | Purpose                         |
| ------------------- | ------ | ------------------------------- |
| `/`                 | GET    | API status                      |
| `/health`           | GET    | Health check                    |
| `/upload-statement` | POST   | Upload and analyze a statement  |
| `/transactions`     | GET    | Retrieve extracted transactions |
| `/analytics`        | GET    | Retrieve financial analytics    |

Interactive API documentation is available through FastAPI Swagger at:

```text
/docs
```

---

## 🔐 Privacy & Security

Financial statements contain highly sensitive information, so the project follows a privacy-first approach.

* Uploaded statements are processed by the local application.
* Financial transaction data is stored in a local SQLite database.
* `.env` files are excluded from Git.
* Local databases are excluded from Git.
* Uploaded statement PDFs are excluded from Git.
* `node_modules` and Python cache files are excluded from Git.

**Never commit real bank statements, API keys, passwords, or other financial credentials to the repository.**

---

## 🎯 Project Goals

This project was built to explore the intersection of:

* Full-stack development
* Financial data processing
* PDF parsing
* Data visualization
* Transaction classification
* Statistical analysis
* Privacy-focused application design

The goal is to turn an otherwise difficult-to-read bank statement into a simple financial story that users can understand at a glance.

---

## 🔮 Future Improvements

Potential extensions include:

* Support for additional bank statement formats
* Automatic recurring-expense detection
* Monthly budget tracking
* Custom spending categories
* Subscription detection
* More advanced anomaly detection
* Exportable financial reports
* Multi-statement comparison
* Improved merchant normalization
* Personalized budgeting recommendations

---

## 📁 Project Structure

```text
where-is-my-money-going/
│
├── backend/
│   ├── main.py
│   └── .gitignore
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── assets/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   ├── index.css
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
│
├── .gitignore
└── README.md
```

---

## 👩‍💻 Author

**Purvi Dhiman**

B.Tech Computer Science & Engineering — AI/ML

GitHub: [@PurviDhiman1](https://github.com/PurviDhiman1)

---

## 📜 License

This project is intended for educational and portfolio purposes.
