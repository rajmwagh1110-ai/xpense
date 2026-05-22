#!/usr/bin/env python3
"""
XPense Analyzer — Python companion for the XPense Tracker
Usage:
  python expense_analyzer.py expenses.csv          # analyze exported CSV
  python expense_analyzer.py expenses.csv --month 2025-05   # filter by month
  python expense_analyzer.py expenses.csv --report  # full report
  python expense_analyzer.py expenses.csv --chart   # show matplotlib chart
"""

import csv
import json
import sys
import argparse
from datetime import datetime
from collections import defaultdict
from pathlib import Path

# ─── Category metadata ────────────────────────────────────────────────────────
CATEGORIES = {
    "Food": "🍜", "Transport": "🚌", "Housing": "🏠",
    "Entertainment": "🎬", "Health": "💊", "Shopping": "🛍️",
    "Education": "📚", "Other": "📦"
}

COLORS = {
    "Food": "\033[92m", "Transport": "\033[94m", "Housing": "\033[33m",
    "Entertainment": "\033[95m", "Health": "\033[91m", "Shopping": "\033[93m",
    "Education": "\033[96m", "Other": "\033[37m"
}
RESET = "\033[0m"
BOLD = "\033[1m"
DIM = "\033[2m"

# ─── Load CSV ─────────────────────────────────────────────────────────────────
def load_csv(filepath: str) -> list[dict]:
    path = Path(filepath)
    if not path.exists():
        print(f"Error: File not found — {filepath}")
        sys.exit(1)

    expenses = []
    with open(path, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                expenses.append({
                    "date": row.get("Date", "").strip(),
                    "category": row.get("Category", "Other").strip(),
                    "description": row.get("Description", "").strip(),
                    "amount": float(row.get("Amount", 0))
                })
            except ValueError:
                continue  # skip malformed rows
    return expenses

# ─── Filter helpers ───────────────────────────────────────────────────────────
def filter_month(expenses: list, month: str) -> list:
    """Filter expenses to a specific month (YYYY-MM)."""
    return [e for e in expenses if e["date"].startswith(month)]

def get_months(expenses: list) -> list:
    return sorted(set(e["date"][:7] for e in expenses))

# ─── Analysis ─────────────────────────────────────────────────────────────────
def summarize(expenses: list) -> dict:
    total = sum(e["amount"] for e in expenses)
    by_category = defaultdict(float)
    for e in expenses:
        by_category[e["category"]] += e["amount"]
    return {"total": total, "by_category": dict(by_category), "count": len(expenses)}

def fmt(amount: float) -> str:
    return f"₹{amount:,.2f}"

def bar(value: float, max_val: float, width: int = 30, color: str = "") -> str:
    filled = int((value / max_val) * width) if max_val > 0 else 0
    return color + "█" * filled + DIM + "░" * (width - filled) + RESET

# ─── Reports ─────────────────────────────────────────────────────────────────
def print_summary(expenses: list, label: str = "All Time"):
    s = summarize(expenses)
    print(f"\n{BOLD}{'─'*50}{RESET}")
    print(f"{BOLD}  XPense Report — {label}{RESET}")
    print(f"{'─'*50}")
    print(f"  Transactions : {s['count']}")
    print(f"  Total Spent  : {BOLD}{fmt(s['total'])}{RESET}")
    print(f"{'─'*50}\n")

    if not s["by_category"]:
        print("  No data.\n")
        return

    max_val = max(s["by_category"].values(), default=1)
    print(f"  {'Category':<16} {'Amount':>12}   {'Share':>6}  Distribution")
    print(f"  {'─'*14}   {'─'*12}   {'─'*6}  {'─'*30}")

    for cat, amt in sorted(s["by_category"].items(), key=lambda x: -x[1]):
        icon = CATEGORIES.get(cat, "•")
        color = COLORS.get(cat, "")
        pct = (amt / s["total"] * 100) if s["total"] > 0 else 0
        b = bar(amt, max_val, 25, color)
        print(f"  {icon} {color}{cat:<14}{RESET} {fmt(amt):>12}   {pct:5.1f}%  {b}")
    print()

def print_monthly_report(expenses: list):
    months = get_months(expenses)
    if not months:
        print("No data found.")
        return

    print(f"\n{BOLD}{'─'*50}{RESET}")
    print(f"{BOLD}  Monthly Overview{RESET}")
    print(f"{'─'*50}")

    totals = []
    for m in months:
        month_exp = filter_month(expenses, m)
        t = sum(e["amount"] for e in month_exp)
        totals.append(t)
        label = datetime.strptime(m, "%Y-%m").strftime("%B %Y")
        print(f"  {label:<18} {fmt(t):>14}  ({len(month_exp)} transactions)")

    if len(totals) >= 2:
        avg = sum(totals) / len(totals)
        change = totals[-1] - totals[-2]
        pct = (change / totals[-2] * 100) if totals[-2] else 0
        print(f"\n  Average/month  : {fmt(avg)}")
        trend_color = "\033[91m" if change > 0 else "\033[92m"
        print(f"  Month-on-month : {trend_color}{'+' if change >= 0 else ''}{fmt(change)} ({pct:+.1f}%){RESET}")
    print()

def print_top_expenses(expenses: list, n: int = 10):
    sorted_exp = sorted(expenses, key=lambda e: -e["amount"])[:n]
    print(f"\n{BOLD}  Top {n} Expenses{RESET}")
    print(f"  {'─'*14}   {'─'*20}  {'─'*10}   {'─'*14}")
    print(f"  {'Date':<14}   {'Description':<20}  {'Category':<10}   {'Amount':>14}")
    print(f"  {'─'*14}   {'─'*20}  {'─'*10}   {'─'*14}")
    for e in sorted_exp:
        color = COLORS.get(e["category"], "")
        desc = (e["description"] or "—")[:20]
        print(f"  {e['date']:<14}   {desc:<20}  {color}{e['category']:<10}{RESET}   {fmt(e['amount']):>14}")
    print()

# ─── Matplotlib chart ────────────────────────────────────────────────────────
def show_chart(expenses: list):
    try:
        import matplotlib.pyplot as plt
        import matplotlib.patches as mpatches
        import numpy as np
    except ImportError:
        print("matplotlib not installed. Run: pip install matplotlib")
        return

    s = summarize(expenses)
    cats = list(s["by_category"].keys())
    amounts = [s["by_category"][c] for c in cats]

    # Pie / bar side by side
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 6))
    fig.patch.set_facecolor('#0a0a0f')
    for ax in (ax1, ax2):
        ax.set_facecolor('#12121a')

    cat_colors = ['#4ade80','#60a5fa','#f97316','#a78bfa','#f43f5e','#facc15','#22d3ee','#94a3b8']
    color_map = {c: cat_colors[i % len(cat_colors)] for i, c in enumerate(cats)}

    # Donut
    wedge_colors = [color_map.get(c, '#94a3b8') for c in cats]
    wedges, texts, autotexts = ax1.pie(
        amounts, labels=cats, autopct='%1.1f%%', colors=wedge_colors,
        wedgeprops={'width': 0.55, 'linewidth': 2, 'edgecolor': '#0a0a0f'},
        textprops={'color': '#f0f0ff', 'fontsize': 9}
    )
    for t in autotexts: t.set_color('#f0f0ff')
    ax1.set_title('Spending by Category', color='#f0f0ff', fontweight='bold', pad=16)

    # Bar by month
    months = get_months(expenses)
    month_totals = [sum(e["amount"] for e in filter_month(expenses, m)) for m in months]
    month_labels = [datetime.strptime(m, "%Y-%m").strftime("%b '%y") for m in months]

    x = np.arange(len(months))
    bars = ax2.bar(x, month_totals, color='#7c6df0aa', edgecolor='#7c6df0', linewidth=1, width=0.6)
    ax2.set_xticks(x)
    ax2.set_xticklabels(month_labels, color='#6b6b8a', fontsize=9, rotation=30)
    ax2.set_yticklabels([f"₹{v:,.0f}" for v in ax2.get_yticks()], color='#6b6b8a', fontsize=9)
    ax2.set_title('Monthly Spending Trend', color='#f0f0ff', fontweight='bold', pad=16)
    ax2.spines[:].set_color('#ffffff12')
    for bar_ in bars: bar_.set_linewidth(1)

    plt.suptitle('XPense Analytics', color='#f0f0ff', fontsize=14, fontweight='bold', y=1.01)
    plt.tight_layout()
    plt.show()

# ─── Main ─────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description='XPense CSV Analyzer')
    parser.add_argument('file', help='Path to exported expenses CSV')
    parser.add_argument('--month', help='Filter to specific month (YYYY-MM)')
    parser.add_argument('--report', action='store_true', help='Show full monthly report')
    parser.add_argument('--chart', action='store_true', help='Show matplotlib charts')
    parser.add_argument('--top', type=int, default=0, help='Show top N expenses')
    args = parser.parse_args()

    expenses = load_csv(args.file)
    print(f"\n{DIM}  Loaded {len(expenses)} expenses from {args.file}{RESET}")

    if args.month:
        expenses = filter_month(expenses, args.month)
        label = datetime.strptime(args.month, "%Y-%m").strftime("%B %Y")
        print_summary(expenses, label)
    else:
        print_summary(expenses)

    if args.report:
        print_monthly_report(expenses)

    if args.top:
        print_top_expenses(expenses, args.top)

    if args.chart:
        show_chart(DB.getExpenses() if False else expenses)

if __name__ == "__main__":
    # Demo mode: if no args, show help
    if len(sys.argv) == 1:
        print(f"""
{BOLD}XPense Analyzer{RESET} — Python companion script

Usage examples:
  python expense_analyzer.py expenses.csv
  python expense_analyzer.py expenses.csv --month 2025-05
  python expense_analyzer.py expenses.csv --report
  python expense_analyzer.py expenses.csv --top 10
  python expense_analyzer.py expenses.csv --chart

Export your data from the XPense web app using the 'Export CSV' button,
then run this script to get terminal-based analytics and charts.
        """)
    else:
        main()
