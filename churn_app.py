"""
Bank Customer Churn — Predictive Risk Scoring Dashboard
=========================================================
Run with:  streamlit run churn_app.py

Modules:
  1. Customer Churn Risk Calculator  — score a single customer
  2. Probability Distribution        — portfolio-level risk view
  3. Feature Importance Dashboard    — global model explainability
  4. What-If Scenario Simulator      — interactively adjust engagement /
                                        product variables and watch risk change
"""

import os

import joblib
import numpy as np
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st

# ----------------------------------------------------------------------------
# CONFIG / PATHS
# ----------------------------------------------------------------------------
APP_DIR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(APP_DIR)

MODEL_PATH = os.path.join(BASE, "models", "best_model.joblib")
ALL_MODELS_PATH = os.path.join(BASE, "models", "all_models.joblib")
FEAT_IMP_PATH = os.path.join(BASE, "models", "feature_importance.csv")
PERM_IMP_PATH = os.path.join(BASE, "models", "permutation_importance.csv")
TEST_SET_PATH = os.path.join(BASE, "data", "test_set.csv")

st.set_page_config(
    page_title="Bank Churn Risk Intelligence",
    page_icon="\U0001F3E6",
    layout="wide",
)

PRIMARY = "#2E5C8A"
RISK = "#C9563E"
SAFE = "#3F8F6F"

st.markdown(
    """
    <style>
    .risk-badge {
        padding: 0.6rem 1rem; border-radius: 0.5rem; font-weight: 600;
        font-size: 1.1rem; text-align: center;
    }
    .metric-card {
        background: #F5F7FA; padding: 1rem; border-radius: 0.6rem;
        border: 1px solid #E2E6EB;
    }
    </style>
    """,
    unsafe_allow_html=True,
)


# ----------------------------------------------------------------------------
# CACHED LOADERS
# ----------------------------------------------------------------------------
@st.cache_resource
def load_model():
    return joblib.load(MODEL_PATH)


@st.cache_resource
def load_all_models():
    try:
        return joblib.load(ALL_MODELS_PATH)
    except FileNotFoundError:
        return None


@st.cache_data
def load_feature_importance():
    fi = pd.read_csv(FEAT_IMP_PATH, index_col=0).iloc[:, 0]
    fi.name = "importance"
    return fi.sort_values(ascending=False)


@st.cache_data
def load_permutation_importance():
    pi = pd.read_csv(PERM_IMP_PATH, index_col=0).iloc[:, 0]
    pi.name = "importance"
    return pi.sort_values(ascending=False)


@st.cache_data
def load_test_set():
    return pd.read_csv(TEST_SET_PATH)


def engineer_features(row: dict) -> pd.DataFrame:
    """Apply the same feature engineering used during training to a single
    customer record (or small batch) supplied as a dict of raw inputs."""
    df = pd.DataFrame([row])
    df["BalanceSalaryRatio"] = df["Balance"] / (df["EstimatedSalary"] + 1)
    df["ProductDensity"] = df["NumOfProducts"] / (df["Tenure"] + 1)
    df["EngagementProductInteraction"] = df["IsActiveMember"] * df["NumOfProducts"]
    df["AgeTenureInteraction"] = df["Age"] * (df["Tenure"] + 1)
    df["IsZeroBalance"] = (df["Balance"] == 0).astype(int)
    df["ProductsPerCreditCard"] = df["NumOfProducts"] / (df["HasCrCard"] + 1)
    return df


def risk_tier(p: float) -> tuple[str, str]:
    if p >= 0.60:
        return "HIGH RISK", RISK
    elif p >= 0.30:
        return "MEDIUM RISK", "#D8A03D"
    else:
        return "LOW RISK", SAFE


# ----------------------------------------------------------------------------
# LOAD ARTIFACTS
# ----------------------------------------------------------------------------
try:
    model = load_model()
except FileNotFoundError:
    st.error(
        "No trained model found at `models/best_model.joblib`. "
        "Run `python train_models.py` from the project root first."
    )
    st.stop()

all_models = load_all_models()
feat_importance = load_feature_importance()
perm_importance = load_permutation_importance()
test_set = load_test_set()

# ----------------------------------------------------------------------------
# HEADER
# ----------------------------------------------------------------------------
st.title("\U0001F3E6 Bank Customer Churn — Predictive Risk Scoring")
st.caption(
    "Predictive Modeling and Risk Scoring for Bank Customer Churn · "
    "Assigns churn probability before the customer leaves, enabling proactive retention."
)

tab1, tab2, tab3, tab4 = st.tabs([
    "\U0001F3AF Risk Calculator",
    "\U0001F4CA Probability Distribution",
    "\U0001F50D Feature Importance",
    "\U0001F52C What-If Simulator",
])

# ============================================================================
# TAB 1 — CUSTOMER CHURN RISK CALCULATOR
# ============================================================================
with tab1:
    st.subheader("Customer Churn Risk Calculator")
    st.write("Enter a customer's profile to generate a real-time churn probability and risk flag.")

    c1, c2, c3 = st.columns(3)
    with c1:
        credit_score = st.slider("Credit Score", 350, 850, 650)
        geography = st.selectbox("Geography", ["France", "Spain", "Germany"])
        gender = st.selectbox("Gender", ["Male", "Female"])
        age = st.slider("Age", 18, 92, 38)
    with c2:
        tenure = st.slider("Tenure (years with bank)", 0, 10, 5)
        balance = st.number_input("Account Balance ($)", 0.0, 260000.0, 75000.0, step=1000.0)
        num_products = st.selectbox("Number of Products", [1, 2, 3, 4], index=1)
    with c3:
        has_cr_card = st.radio("Has Credit Card?", ["Yes", "No"], horizontal=True)
        is_active = st.radio("Active Member?", ["Yes", "No"], horizontal=True)
        salary = st.number_input("Estimated Salary ($)", 11.0, 200000.0, 65000.0, step=1000.0)

    threshold = st.slider(
        "Decision threshold (probability ≥ this value → flagged as churn risk)",
        0.05, 0.95, 0.50, 0.01,
        help="Lower the threshold to catch more at-risk customers (higher recall, more false alarms). "
             "Raise it to reduce false positives (higher precision, may miss some churners).",
    )

    if st.button("Calculate Churn Risk", type="primary"):
        raw = {
            "CreditScore": credit_score,
            "Geography": geography,
            "Gender": gender,
            "Age": age,
            "Tenure": tenure,
            "Balance": balance,
            "NumOfProducts": num_products,
            "HasCrCard": 1 if has_cr_card == "Yes" else 0,
            "IsActiveMember": 1 if is_active == "Yes" else 0,
            "EstimatedSalary": salary,
        }
        X = engineer_features(raw)
        proba = float(model.predict_proba(X)[0, 1])
        tier, color = risk_tier(proba)
        flagged = proba >= threshold

        colA, colB = st.columns([1, 2])
        with colA:
            st.markdown(
                f"<div class='risk-badge' style='background:{color}20; color:{color}; border:2px solid {color};'>"
                f"{tier}</div>",
                unsafe_allow_html=True,
            )
            st.metric("Churn Probability", f"{proba:.1%}")
            st.metric("Flagged for Retention Action?", "YES" if flagged else "NO")

        with colB:
            fig = go.Figure(go.Indicator(
                mode="gauge+number",
                value=proba * 100,
                number={"suffix": "%"},
                gauge={
                    "axis": {"range": [0, 100]},
                    "bar": {"color": color},
                    "steps": [
                        {"range": [0, 30], "color": "#E8F5EE"},
                        {"range": [30, 60], "color": "#FBF1DD"},
                        {"range": [60, 100], "color": "#FAE6E1"},
                    ],
                    "threshold": {
                        "line": {"color": "black", "width": 3},
                        "value": threshold * 100,
                    },
                },
                title={"text": "Churn Risk Score"},
            ))
            fig.update_layout(height=280, margin=dict(t=40, b=10, l=20, r=20))
            st.plotly_chart(fig, use_container_width=True)

        st.info(
            "**Suggested action:** " + (
                "Immediate proactive outreach — personalized retention offer, relationship-manager call, "
                "and review of product fit within 48 hours."
                if tier == "HIGH RISK" else
                "Include in the next targeted engagement campaign (e.g. loyalty rewards, product cross-sell)."
                if tier == "MEDIUM RISK" else
                "No immediate action needed — monitor at standard review cadence."
            )
        )

# ============================================================================
# TAB 2 — PROBABILITY DISTRIBUTION VISUALIZATION
# ============================================================================
with tab2:
    st.subheader("Portfolio-Level Churn Probability Distribution")
    st.write(
        "Churn probabilities scored on the held-out test set (customers the model did not train on), "
        "segmented by actual outcome."
    )

    X_test = test_set.drop(columns=["Exited"])
    y_test = test_set["Exited"]
    probs = model.predict_proba(X_test)[:, 1]
    dist_df = pd.DataFrame({
        "Churn Probability": probs,
        "Actual Outcome": y_test.map({0: "Retained", 1: "Churned"}),
    })

    colL, colR = st.columns([2, 1])
    with colL:
        fig = px.histogram(
            dist_df, x="Churn Probability", color="Actual Outcome",
            nbins=40, barmode="overlay", opacity=0.65,
            color_discrete_map={"Retained": SAFE, "Churned": RISK},
        )
        fig.update_layout(height=420, legend_title_text="Actual Outcome")
        st.plotly_chart(fig, use_container_width=True)

    with colR:
        st.markdown("##### Portfolio Snapshot")
        n_total = len(dist_df)
        n_high = (dist_df["Churn Probability"] >= 0.60).sum()
        n_med = ((dist_df["Churn Probability"] >= 0.30) & (dist_df["Churn Probability"] < 0.60)).sum()
        n_low = (dist_df["Churn Probability"] < 0.30).sum()
        st.metric("Customers Scored", f"{n_total:,}")
        st.metric("\U0001F534 High Risk (≥60%)", f"{n_high:,} ({n_high/n_total:.1%})")
        st.metric("\U0001F7E1 Medium Risk (30–60%)", f"{n_med:,} ({n_med/n_total:.1%})")
        st.metric("\U0001F7E2 Low Risk (<30%)", f"{n_low:,} ({n_low/n_total:.1%})")

    st.markdown("##### Risk Tier Composition")
    tier_labels = pd.cut(
        dist_df["Churn Probability"], bins=[0, 0.3, 0.6, 1.0],
        labels=["Low Risk", "Medium Risk", "High Risk"]
    )
    tier_counts = tier_labels.value_counts().reindex(["Low Risk", "Medium Risk", "High Risk"])
    fig2 = px.pie(
        values=tier_counts.values, names=tier_counts.index, hole=0.45,
        color=tier_counts.index,
        color_discrete_map={"Low Risk": SAFE, "Medium Risk": "#D8A03D", "High Risk": RISK},
    )
    fig2.update_layout(height=380)
    st.plotly_chart(fig2, use_container_width=True)

# ============================================================================
# TAB 3 — FEATURE IMPORTANCE DASHBOARD
# ============================================================================
with tab3:
    st.subheader("Feature Importance Dashboard")
    st.write("Global drivers of churn as learned by the model, from two complementary methods.")

    imp_type = st.radio(
        "Importance method",
        ["Model-native (Random Forest / Gradient Boosting)", "Permutation importance (model-agnostic, ROC-AUC drop)"],
        horizontal=True,
    )

    src = feat_importance if imp_type.startswith("Model-native") else perm_importance
    top_n = st.slider("Number of features to show", 5, min(20, len(src)), 10)
    plot_src = src.head(top_n).sort_values()

    fig = px.bar(
        x=plot_src.values, y=plot_src.index, orientation="h",
        labels={"x": "Importance", "y": ""},
        color=plot_src.values, color_continuous_scale=["#DCE7F2", PRIMARY],
    )
    fig.update_layout(height=max(350, 32 * top_n), coloraxis_showscale=False)
    st.plotly_chart(fig, use_container_width=True)

    with st.expander("How to read this"):
        st.write(
            "Model-native importance reflects how much each feature reduces impurity across "
            "tree splits. Permutation importance measures the drop in ROC-AUC when a feature's "
            "values are randomly shuffled — a model-agnostic sanity check. Features that rank "
            "highly under both methods are the most trustworthy churn drivers for business action."
        )

# ============================================================================
# TAB 4 — WHAT-IF SCENARIO SIMULATOR
# ============================================================================
with tab4:
    st.subheader("What-If Scenario Simulator")
    st.write(
        "Start from a customer profile and adjust engagement / product variables to see how "
        "churn probability responds — useful for testing retention-offer scenarios."
    )

    st.markdown("##### 1. Base customer profile")
    b1, b2, b3, b4 = st.columns(4)
    with b1:
        s_credit = st.slider("Credit Score ", 350, 850, 650, key="s_credit")
        s_geo = st.selectbox("Geography ", ["France", "Spain", "Germany"], key="s_geo")
    with b2:
        s_gender = st.selectbox("Gender ", ["Male", "Female"], key="s_gender")
        s_age = st.slider("Age ", 18, 92, 45, key="s_age")
    with b3:
        s_salary = st.number_input("Salary ($) ", 11.0, 200000.0, 60000.0, step=1000.0, key="s_salary")
        s_balance_base = st.number_input("Current Balance ($) ", 0.0, 260000.0, 90000.0, step=1000.0, key="s_bal")
    with b4:
        s_tenure_base = st.slider("Current Tenure (yrs) ", 0, 10, 2, key="s_ten")
        s_cr = st.radio("Has Credit Card? ", ["Yes", "No"], horizontal=True, key="s_cr")

    st.markdown("##### 2. Simulate a retention scenario")
    st.caption("Drag the sliders below to see the effect of raising engagement or changing product holdings.")
    w1, w2 = st.columns(2)
    with w1:
        s_products = st.slider("Number of Products (what-if)", 1, 4, 1, key="s_prod")
    with w2:
        s_active = st.select_slider("Activity Level (what-if)", options=["Inactive", "Active"], value="Inactive", key="s_active")

    base_raw = {
        "CreditScore": s_credit, "Geography": s_geo, "Gender": s_gender, "Age": s_age,
        "Tenure": s_tenure_base, "Balance": s_balance_base, "NumOfProducts": s_products,
        "HasCrCard": 1 if s_cr == "Yes" else 0,
        "IsActiveMember": 1 if s_active == "Active" else 0,
        "EstimatedSalary": s_salary,
    }
    X_scenario = engineer_features(base_raw)
    scenario_prob = float(model.predict_proba(X_scenario)[0, 1])

    # Comparison: same profile with opposite engagement + baseline 1 product, inactive
    baseline_raw = dict(base_raw, NumOfProducts=1, IsActiveMember=0)
    baseline_prob = float(model.predict_proba(engineer_features(baseline_raw))[0, 1])

    m1, m2, m3 = st.columns(3)
    m1.metric("Baseline Risk (1 product, inactive)", f"{baseline_prob:.1%}")
    m2.metric("Scenario Risk", f"{scenario_prob:.1%}", delta=f"{(scenario_prob-baseline_prob):+.1%}",
              delta_color="inverse")
    m3.metric("Risk Reduction", f"{max(0, baseline_prob-scenario_prob):.1%}" if scenario_prob < baseline_prob
              else "No improvement")

    st.markdown("##### 3. Sensitivity curve: risk vs. number of products")
    curve_rows = []
    for p in [1, 2, 3, 4]:
        for act in [0, 1]:
            r = dict(base_raw, NumOfProducts=p, IsActiveMember=act)
            prob = float(model.predict_proba(engineer_features(r))[0, 1])
            curve_rows.append({"NumOfProducts": p, "Active": "Active" if act else "Inactive", "Probability": prob})
    curve_df = pd.DataFrame(curve_rows)
    fig = px.line(
        curve_df, x="NumOfProducts", y="Probability", color="Active", markers=True,
        color_discrete_map={"Active": SAFE, "Inactive": RISK},
    )
    fig.update_layout(height=380, yaxis_tickformat=".0%")
    st.plotly_chart(fig, use_container_width=True)

st.divider()
st.caption(
    "Model: trained on historical customer data with engineered engagement/product-interaction "
    "features. Explainability panels are provided to support regulatory review and business trust. "
    "This dashboard is a decision-support tool — retention actions should be reviewed by a qualified analyst."
)
