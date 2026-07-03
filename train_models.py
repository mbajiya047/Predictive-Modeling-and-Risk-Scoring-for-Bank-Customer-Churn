"""
Predictive Modeling and Risk Scoring for Bank Customer Churn
==============================================================
End-to-end pipeline: preprocessing -> feature engineering -> stratified
train/test split -> model development (Logistic Regression, Decision Tree,
Random Forest, Gradient Boosting) -> evaluation -> explainability
(feature importance, permutation importance, partial dependence).

Artifacts written to /home/claude/churn_project/:
  models/   -> trained pipeline (best model) + preprocessing objects
  figures/  -> all charts used in the research paper
  metrics.json, metrics_table.csv -> evaluation results
"""

import json
import warnings

import joblib
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.inspection import PartialDependenceDisplay, permutation_importance
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    RocCurveDisplay,
    accuracy_score,
    auc,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
    roc_curve,
)
from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.tree import DecisionTreeClassifier

warnings.filterwarnings("ignore")
plt.rcParams["figure.dpi"] = 130

BASE = "/home/claude/churn_project"
CB = "#2E5C8A"   # brand blue
CR = "#C9563E"   # brand rust (churn / risk color)
CG = "#3F8F6F"   # brand green (retained)


# ----------------------------------------------------------------------------
# 1. LOAD + PREPROCESS
# ----------------------------------------------------------------------------
df = pd.read_csv(f"{BASE}/data/bank_churn.csv")

# Drop non-informative identifiers
df = df.drop(columns=["CustomerId", "Surname"])

# Handle missing values (numeric -> median imputation, tracked via pipeline below;
# here we just report them)
missing_report = df.isna().sum()
missing_report = missing_report[missing_report > 0]

# ----------------------------------------------------------------------------
# 2. FEATURE ENGINEERING
# ----------------------------------------------------------------------------
df["BalanceSalaryRatio"] = df["Balance"] / (df["EstimatedSalary"] + 1)
df["ProductDensity"] = df["NumOfProducts"] / (df["Tenure"].fillna(df["Tenure"].median()) + 1)
df["EngagementProductInteraction"] = df["IsActiveMember"] * df["NumOfProducts"]
df["AgeTenureInteraction"] = df["Age"] * (df["Tenure"].fillna(df["Tenure"].median()) + 1)
df["IsZeroBalance"] = (df["Balance"] == 0).astype(int)
df["ProductsPerCreditCard"] = df["NumOfProducts"] / (df["HasCrCard"] + 1)

TARGET = "Exited"
CAT_COLS = ["Geography", "Gender"]
NUM_COLS = [c for c in df.columns if c not in CAT_COLS + [TARGET]]

X = df.drop(columns=[TARGET])
y = df[TARGET]

# ----------------------------------------------------------------------------
# 3. STRATIFIED TRAIN/TEST SPLIT
# ----------------------------------------------------------------------------
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.20, stratify=y, random_state=42
)

preprocessor = ColumnTransformer(
    transformers=[
        ("num", Pipeline([
            ("impute", SimpleImputer(strategy="median")),
            ("scale", StandardScaler()),
        ]), NUM_COLS),
        ("cat", Pipeline([
            ("impute", SimpleImputer(strategy="most_frequent")),
            ("onehot", OneHotEncoder(drop="first", handle_unknown="ignore")),
        ]), CAT_COLS),
    ]
)

# ----------------------------------------------------------------------------
# 4. MODEL DEVELOPMENT
# ----------------------------------------------------------------------------
models = {
    "Logistic Regression": LogisticRegression(max_iter=2000, class_weight="balanced", random_state=42),
    "Decision Tree": DecisionTreeClassifier(max_depth=6, min_samples_leaf=30, class_weight="balanced", random_state=42),
    "Random Forest": RandomForestClassifier(
        n_estimators=400, max_depth=8, min_samples_leaf=15,
        class_weight="balanced", random_state=42, n_jobs=-1
    ),
    "Gradient Boosting": GradientBoostingClassifier(
        n_estimators=300, max_depth=3, learning_rate=0.05, random_state=42
    ),
}

skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
results = {}
fitted_pipelines = {}
roc_data = {}

for name, clf in models.items():
    pipe = Pipeline([("prep", preprocessor), ("clf", clf)])

    cv_auc = cross_val_score(pipe, X_train, y_train, cv=skf, scoring="roc_auc", n_jobs=-1)

    pipe.fit(X_train, y_train)
    proba = pipe.predict_proba(X_test)[:, 1]
    pred = (proba >= 0.5).astype(int)

    fpr, tpr, _ = roc_curve(y_test, proba)
    roc_data[name] = (fpr, tpr, auc(fpr, tpr))

    results[name] = {
        "Accuracy": accuracy_score(y_test, pred),
        "Precision": precision_score(y_test, pred),
        "Recall": recall_score(y_test, pred),
        "F1-Score": f1_score(y_test, pred),
        "ROC-AUC": roc_auc_score(y_test, proba),
        "CV ROC-AUC (mean)": cv_auc.mean(),
        "CV ROC-AUC (std)": cv_auc.std(),
    }
    fitted_pipelines[name] = pipe
    print(f"{name:20s} | Test ROC-AUC={results[name]['ROC-AUC']:.3f} | "
          f"CV ROC-AUC={cv_auc.mean():.3f}±{cv_auc.std():.3f}")

metrics_df = pd.DataFrame(results).T.sort_values("ROC-AUC", ascending=False)
metrics_df.to_csv(f"{BASE}/metrics_table.csv")
print("\n", metrics_df.round(3))

best_name = metrics_df.index[0]
best_pipe = fitted_pipelines[best_name]
print(f"\nBest model selected: {best_name}")

with open(f"{BASE}/metrics.json", "w") as f:
    json.dump({
        "best_model": best_name,
        "results": {k: {kk: float(vv) for kk, vv in v.items()} for k, v in results.items()},
        "missing_values": {k: int(v) for k, v in missing_report.items()},
        "n_train": len(X_train),
        "n_test": len(X_test),
        "churn_rate_train": float(y_train.mean()),
        "churn_rate_test": float(y_test.mean()),
        "feature_columns": list(X.columns),
        "num_cols": NUM_COLS,
        "cat_cols": CAT_COLS,
    }, f, indent=2)

# ----------------------------------------------------------------------------
# 5. SAVE ARTIFACTS FOR STREAMLIT APP
# ----------------------------------------------------------------------------
joblib.dump(best_pipe, f"{BASE}/models/best_model.joblib")
joblib.dump(fitted_pipelines, f"{BASE}/models/all_models.joblib")
X_test.assign(Exited=y_test).to_csv(f"{BASE}/data/test_set.csv", index=False)
X_train.assign(Exited=y_train).to_csv(f"{BASE}/data/train_set.csv", index=False)

# ----------------------------------------------------------------------------
# 6. EXPLAINABILITY
# ----------------------------------------------------------------------------
# 6a. Feature importance (native, best tree-based model if available, else Random Forest)
importance_source = fitted_pipelines.get("Random Forest", best_pipe)
ohe = importance_source.named_steps["prep"].named_transformers_["cat"].named_steps["onehot"]
feat_names = NUM_COLS + list(ohe.get_feature_names_out(CAT_COLS))
importances = importance_source.named_steps["clf"].feature_importances_
imp_series = pd.Series(importances, index=feat_names).sort_values(ascending=False)
imp_series.to_csv(f"{BASE}/models/feature_importance.csv")

fig, ax = plt.subplots(figsize=(8, 6))
top = imp_series.head(12).sort_values()
ax.barh(top.index, top.values, color=CB)
ax.set_xlabel("Relative Importance (Random Forest)")
ax.set_title("Top Churn Drivers — Feature Importance")
plt.tight_layout()
plt.savefig(f"{BASE}/figures/feature_importance.png")
plt.close()

# 6b. Permutation importance (model-agnostic, on best model / test set)
perm = permutation_importance(best_pipe, X_test, y_test, n_repeats=15, random_state=42, n_jobs=-1, scoring="roc_auc")
perm_series = pd.Series(perm.importances_mean, index=X.columns).sort_values(ascending=False)
perm_series.to_csv(f"{BASE}/models/permutation_importance.csv")

fig, ax = plt.subplots(figsize=(8, 6))
top_p = perm_series.head(12).sort_values()
ax.barh(top_p.index, top_p.values, color=CR)
ax.set_xlabel("Mean ROC-AUC Decrease When Shuffled")
ax.set_title(f"Permutation Importance — {best_name}")
plt.tight_layout()
plt.savefig(f"{BASE}/figures/permutation_importance.png")
plt.close()

# 6c. Partial dependence plots for top numeric drivers
top_numeric = [f for f in perm_series.index if f in NUM_COLS][:4]
fig, ax = plt.subplots(figsize=(11, 8))
PartialDependenceDisplay.from_estimator(
    best_pipe, X_train, top_numeric, ax=ax, n_cols=2,
    line_kw={"color": CB, "linewidth": 2.4}
)
fig.suptitle(f"Partial Dependence — {best_name}", y=1.02)
plt.tight_layout()
plt.savefig(f"{BASE}/figures/partial_dependence.png", bbox_inches="tight")
plt.close()

# 6d. ROC curves — all models
fig, ax = plt.subplots(figsize=(7, 6))
colors = [CB, CR, CG, "#8B5FA8"]
for (name, (fpr, tpr, a)), c in zip(roc_data.items(), colors):
    ax.plot(fpr, tpr, label=f"{name} (AUC={a:.3f})", color=c, linewidth=2)
ax.plot([0, 1], [0, 1], "k--", linewidth=1, alpha=0.5)
ax.set_xlabel("False Positive Rate")
ax.set_ylabel("True Positive Rate")
ax.set_title("ROC Curves — Model Comparison")
ax.legend(loc="lower right", fontsize=9)
plt.tight_layout()
plt.savefig(f"{BASE}/figures/roc_curves.png")
plt.close()

# 6e. Confusion matrix — best model
cm = confusion_matrix(y_test, (best_pipe.predict_proba(X_test)[:, 1] >= 0.5).astype(int))
fig, ax = plt.subplots(figsize=(5.5, 5))
im = ax.imshow(cm, cmap="Blues")
for i in range(2):
    for j in range(2):
        ax.text(j, i, str(cm[i, j]), ha="center", va="center",
                color="white" if cm[i, j] > cm.max() / 2 else "black", fontsize=14)
ax.set_xticks([0, 1]); ax.set_xticklabels(["Retained", "Churned"])
ax.set_yticks([0, 1]); ax.set_yticklabels(["Retained", "Churned"])
ax.set_xlabel("Predicted"); ax.set_ylabel("Actual")
ax.set_title(f"Confusion Matrix — {best_name}")
plt.tight_layout()
plt.savefig(f"{BASE}/figures/confusion_matrix.png")
plt.close()

# 6f. Model comparison bar chart
fig, ax = plt.subplots(figsize=(9, 5.5))
metric_cols = ["Accuracy", "Precision", "Recall", "F1-Score", "ROC-AUC"]
plot_df = metrics_df[metric_cols]
x = np.arange(len(plot_df))
width = 0.16
for i, m in enumerate(metric_cols):
    ax.bar(x + i * width, plot_df[m], width, label=m)
ax.set_xticks(x + width * 2)
ax.set_xticklabels(plot_df.index, rotation=15)
ax.set_ylim(0, 1)
ax.set_title("Model Performance Comparison")
ax.legend(loc="lower right", fontsize=8, ncol=3)
plt.tight_layout()
plt.savefig(f"{BASE}/figures/model_comparison.png")
plt.close()

# ----------------------------------------------------------------------------
# 7. EDA FIGURES
# ----------------------------------------------------------------------------
fig, axes = plt.subplots(1, 2, figsize=(11, 4.5))
df["Exited"].map({0: "Retained", 1: "Churned"}).value_counts().plot(
    kind="bar", ax=axes[0], color=[CG, CR])
axes[0].set_title("Class Balance"); axes[0].set_xlabel(""); axes[0].tick_params(axis="x", rotation=0)

geo_churn = df.groupby("Geography")["Exited"].mean().sort_values(ascending=False)
geo_churn.plot(kind="bar", ax=axes[1], color=CB)
axes[1].set_title("Churn Rate by Geography"); axes[1].set_ylabel("Churn Rate")
axes[1].tick_params(axis="x", rotation=0)
plt.tight_layout()
plt.savefig(f"{BASE}/figures/eda_overview.png")
plt.close()

fig, axes = plt.subplots(1, 3, figsize=(13, 4))
for ax, col, title in zip(
    axes,
    ["IsActiveMember", "NumOfProducts", "Gender"],
    ["Activity Status", "Number of Products", "Gender"],
):
    rate = df.groupby(col)["Exited"].mean()
    rate.plot(kind="bar", ax=ax, color=CR)
    ax.set_title(f"Churn Rate by {title}")
    ax.set_ylabel("Churn Rate")
    ax.tick_params(axis="x", rotation=0)
plt.tight_layout()
plt.savefig(f"{BASE}/figures/eda_drivers.png")
plt.close()

fig, axes = plt.subplots(1, 2, figsize=(11, 4.5))
for ax, col in zip(axes, ["Age", "CreditScore"]):
    df[df.Exited == 0][col].plot(kind="kde", ax=ax, color=CG, label="Retained")
    df[df.Exited == 1][col].plot(kind="kde", ax=ax, color=CR, label="Churned")
    ax.set_title(f"{col} Distribution by Churn")
    ax.legend()
plt.tight_layout()
plt.savefig(f"{BASE}/figures/eda_distributions.png")
plt.close()

corr = df[NUM_COLS + ["Exited"]].corr()
fig, ax = plt.subplots(figsize=(10, 8))
im = ax.imshow(corr, cmap="RdBu_r", vmin=-1, vmax=1)
ax.set_xticks(range(len(corr.columns))); ax.set_xticklabels(corr.columns, rotation=90, fontsize=8)
ax.set_yticks(range(len(corr.columns))); ax.set_yticklabels(corr.columns, fontsize=8)
fig.colorbar(im, ax=ax, fraction=0.046)
ax.set_title("Feature Correlation Matrix")
plt.tight_layout()
plt.savefig(f"{BASE}/figures/correlation_matrix.png")
plt.close()

print("\nAll figures and models saved.")
print("Missing value report:\n", missing_report)
