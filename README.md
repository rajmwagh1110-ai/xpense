# xpense
XPense Tracker — Personal expense manager with login, budgets, CSV export/import, and browser storage

      XPense Tracker
===============

Project Overview
----------------
XPense Tracker is a personal expense management web app built with HTML, CSS, JavaScript, and a Python companion script for CSV expense analysis.

Key Features
------------
- Dashboard with summary cards, spending charts, budget progress, and recent expenses
- Add and edit expenses using the add expense form
- Browse all expenses in a dedicated list view
- Configure monthly budgets by category
- Track goals and review reports
- Client-side persistence through browser localStorage
- Python `expense_analyzer.py` for offline CSV expense analysis and text reports

Main Files
----------
- `index.html`: Dashboard view with charts, summaries, and recent transactions
- `add.html`: Add or edit expense entries
- `expenses.html`: All expenses listing and management
- `budget.html`: Budget settings per category
- `reports.html`: Spending reports and analytics
- `goals.html`: Expense goal tracking
- `settings.html`: Theme, currency, and alert settings
- `style.css`: Application styling
- `app.js`: Main client-side JavaScript powering the web app
- `expense_analyzer.py`: Python script for analyzing exported expense CSV files

How to Use
----------
1. Open `login.html` in a browser or via Live Server.
2. Create an account or sign in with an existing user.
3. Use the sidebar to navigate between pages.
4. Add expense records in `add.html`.
5. View and edit expenses on `expenses.html`.
6. Configure budgets on `budget.html`.
7. Use the dashboard to see spending charts and progress.

Data Storage
------------
- Expenses, budgets, goals, settings, and streak data are namespaced per user and saved in browser `localStorage`.
- Each account stores its own data separately so different users can share the same browser safely.
- Data is stored locally in the browser and is not uploaded to a server.

Backup and Export
-----------------
- Export expenses to CSV from the `All Expenses` page.
- Export a full app backup as JSON from `settings.html`.
- Restore from a previously exported JSON backup in `settings.html`.

Python CSV Analyzer
-------------------
The project includes `expense_analyzer.py`, which can analyze exported expenses using a CSV file.

Example usage:
  python expense_analyzer.py expenses.csv
  python expense_analyzer.py expenses.csv --month 2025-05
  python expense_analyzer.py expenses.csv --report
  python expense_analyzer.py expenses.csv --chart

Requirements for Python usage:
- Python 3
- Optional: `matplotlib` for chart display (`pip install matplotlib`)

Notes
-----
- The web app is a static client-side project and does not require a backend server.
- Expenses are grouped by month and category, with budget insights and forecasted spending.
- The UI uses Chart.js for rendering charts in the browser.

Enjoy using XPense Tracker to manage your spending and budgets!
