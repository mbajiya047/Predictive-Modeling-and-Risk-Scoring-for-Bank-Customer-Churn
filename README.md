# Predictive Modeling and Risk Scoring for Bank Customer Churn

End-to-end churn intelligence system: data pipeline, model training and
evaluation, explainability, and a Streamlit risk-scoring dashboard.

## Project structure

```
churn_project/
├── data/
│   ├── generate_data.py      # synthetic dataset generator (schema-matched)
│   ├── bank_churn.csv        # generated dataset (10,000 customers)
│   ├── train_set.csv         # stratified 80% split (post feature-engineering)
│   └── test_set.csv          # stratified 20% split (post feature-engineering)
├── models/
│   ├── best_model.joblib     # deployed model (full sklearn Pipeline)
│   ├── all_models.joblib     # all 4 trained pipelines, for comparison
│   ├── feature_importance.csv
│   └── permutation_importance.csv
├── figures/                  # all charts used in the research paper
├── app/
│   └── churn_app.py          # Streamlit dashboard (4 modules)
├── train_models.py           # preprocessing → FE → training → eval → explainability
├── requirements.txt
└── README.md
```

## Using your own data

Replace `data/bank_churn.csv` with your real customer export — same 13
columns (`CustomerId, Surname, CreditScore, Geography, Gender, Age, Tenure,
Balance, NumOfProducts, HasCrCard, IsActiveMember, EstimatedSalary, Exited`)
— then re-run `python train_models.py`. Nothing else needs to change; the
Streamlit app reads whatever model `train_models.py` produces.

## Setup

```bash
python -m venv venv
source venv/bin/activate         # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

## Run the pipeline

```bash
python data/generate_data.py     # (skip if you're supplying your own CSV)
python train_models.py           # trains 4 models, saves best one + all figures
```

## Launch the dashboard

```bash
streamlit run app/churn_app.py
```

Then open the local URL Streamlit prints (typically http://localhost:8501).

## Models trained

| Model | Role |
|---|---|
| Logistic Regression | Interpretability benchmark |
| Decision Tree | Simple non-linear baseline |
| Random Forest | **Deployed model** (best ROC-AUC / F1 balance) |
| Gradient Boosting | Advanced ensemble comparison |

XGBoost and full SHAP value plots are noted as optional extensions in the
methodology; `train_models.py` uses scikit-learn's Gradient Boosting and
permutation/partial-dependence explainability so the pipeline runs with no
extra native dependencies. Swap in `xgboost`/`shap` (see commented lines in
`requirements.txt`) for drop-in upgrades if available in your environment.

## Notes on the dataset

No dataset was supplied with the brief, so `data/generate_data.py` produces
a synthetic-but-realistic dataset calibrated to resemble the public "Bank
Customer Churn" benchmark: ~18% churn rate, elevated churn in Germany,
inactive members, and customers holding 3–4 products, consistent with the
"Analytical Methodology" and "Predictive Target Definition" sections of the
brief. Swap in the bank's real export at any time (see above).
