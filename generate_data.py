"""
Synthetic Bank Customer Churn Dataset Generator
-------------------------------------------------
Produces a dataset that matches the schema specified in the project brief
(CustomerId, Surname, CreditScore, Geography, Gender, Age, Tenure, Balance,
NumOfProducts, HasCrCard, IsActiveMember, EstimatedSalary, Exited).

No real customer data is used anywhere in this project. Values are drawn from
distributions calibrated to resemble the well-known public "Bank Customer
Churn" benchmark dataset (~20% churn rate, Germany over-represented among
churners, inactive + single-product customers at higher risk, etc.), so that
downstream models learn genuine, explainable signal rather than noise.

Swap this file out for a real data-loading step (pd.read_csv on the bank's
actual export) without changing anything downstream — the column schema is
identical.
"""

import numpy as np
import pandas as pd

RNG = np.random.default_rng(42)
N = 10000

FIRST_SURNAMES = [
    "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller",
    "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez",
    "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin",
    "Lee", "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark",
    "Ramirez", "Lewis", "Robinson", "Walker", "Young", "Allen", "King",
    "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores", "Green",
    "Adams", "Nelson", "Baker", "Hall", "Rivera", "Campbell", "Mitchell",
    "Carter", "Roberts",
]

geographies = ["France", "Spain", "Germany"]
geo_probs = [0.50, 0.25, 0.25]

genders = ["Male", "Female"]

def generate():
    customer_id = np.arange(15600000, 15600000 + N)
    surname = RNG.choice(FIRST_SURNAMES, size=N)

    credit_score = np.clip(RNG.normal(650, 96, N), 350, 850).round().astype(int)
    geography = RNG.choice(geographies, size=N, p=geo_probs)
    gender = RNG.choice(genders, size=N, p=[0.545, 0.455])

    age = np.clip(RNG.gamma(shape=9, scale=4.2, size=N) + 18, 18, 92).round().astype(int)
    tenure = RNG.integers(0, 11, size=N)

    # Balance: ~36% of customers have zero balance (as in real dataset); rest lognormal
    has_balance = RNG.random(N) > 0.36
    balance = np.where(
        has_balance,
        np.clip(RNG.lognormal(mean=11.4, sigma=0.45, size=N), 1000, 260000),
        0.0,
    ).round(2)

    num_of_products = RNG.choice([1, 2, 3, 4], size=N, p=[0.51, 0.46, 0.02, 0.01])
    has_cr_card = RNG.choice([0, 1], size=N, p=[0.294, 0.706])
    is_active_member = RNG.choice([0, 1], size=N, p=[0.485, 0.515])
    estimated_salary = np.clip(RNG.uniform(11, 200000, N), 11, 200000).round(2)

    # ---- Churn probability model (ground truth signal for supervised learning) ----
    # Standardize helper
    def z(x):
        return (x - x.mean()) / x.std()

    logit = (
        -1.35
        + 0.021 * (age - 38)                                   # older -> more churn
        + 0.55 * (geography == "Germany")                      # Germany higher churn
        - 0.15 * (geography == "France")
        + 0.9 * (num_of_products == 3)
        + 2.6 * (num_of_products == 4)
        - 0.35 * (num_of_products == 2)
        - 0.85 * is_active_member                               # active members churn less
        + 0.30 * (gender == "Female")
        + 0.55 * z(balance) * (geography == "Germany")          # high balance + Germany = risk
        - 0.10 * z(credit_score)
        - 0.05 * tenure
        + 0.18 * z(balance / (estimated_salary + 1))            # balance-to-salary ratio effect
        - 0.12 * has_cr_card
    )
    prob = 1 / (1 + np.exp(-logit))
    prob = np.clip(prob, 0.01, 0.97)
    exited = (RNG.random(N) < prob).astype(int)

    df = pd.DataFrame({
        "CustomerId": customer_id,
        "Surname": surname,
        "CreditScore": credit_score,
        "Geography": geography,
        "Gender": gender,
        "Age": age,
        "Tenure": tenure,
        "Balance": balance,
        "NumOfProducts": num_of_products,
        "HasCrCard": has_cr_card,
        "IsActiveMember": is_active_member,
        "EstimatedSalary": estimated_salary,
        "Exited": exited,
    })

    # Inject a small, realistic amount of missingness to exercise the
    # preprocessing pipeline's missing-value handling
    for col, frac in [("CreditScore", 0.006), ("EstimatedSalary", 0.004), ("Tenure", 0.003)]:
        idx = RNG.choice(N, size=int(N * frac), replace=False)
        df.loc[idx, col] = np.nan

    return df


if __name__ == "__main__":
    df = generate()
    df.to_csv("/home/claude/churn_project/data/bank_churn.csv", index=False)
    print(df.shape)
    print(df["Exited"].value_counts(normalize=True))
    print(df.isna().sum())
