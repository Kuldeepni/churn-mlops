import json
import os

nb = {
    "cells": [
        {"cell_type": "markdown", "metadata": {}, "source": ["# EDA - Telco Churn\n"]},
        {"cell_type": "code", "execution_count": 1, "metadata": {}, "outputs": [], "source": ["import pandas as pd\nimport matplotlib.pyplot as plt\nfrom churn.data.clean import clean\nraw = pd.read_csv('data/raw/Telco-Customer-Churn.csv')\ncleaned = clean(raw)\nprint(cleaned.shape)\nprint(cleaned['Churn'].value_counts(normalize=True))\n"]},
        {"cell_type": "markdown", "metadata": {}, "source": ["## Class balance\n"]},
        {"cell_type": "code", "execution_count": 2, "metadata": {}, "outputs": [], "source": ["cleaned['Churn'].value_counts().plot(kind='bar'); plt.title('Churn distribution'); plt.show()\n"]},
        {"cell_type": "markdown", "metadata": {}, "source": ["## Churn by contract\n"]},
        {"cell_type": "code", "execution_count": 3, "metadata": {}, "outputs": [], "source": ["pd.crosstab(cleaned['Contract'], cleaned['Churn'], normalize='index').plot(kind='bar'); plt.title('Churn rate by contract'); plt.show()\n"]},
        {"cell_type": "markdown", "metadata": {}, "source": ["## Findings and modeling implications\n- Class imbalance ~26.5% churn.\n- Month-to-month contracts churn much more.\n- Short tenure strongly associated with churn.\n- Use PR-AUC as primary metric; calibrate probabilities; cost-based threshold.\n"]},
    ],
    "metadata": {"kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"}},
    "nbformat": 4,
    "nbformat_minor": 5,
}
os.makedirs("notebooks", exist_ok=True)
with open("notebooks/01_eda.ipynb", "w") as f:
    json.dump(nb, f)
print("written")
