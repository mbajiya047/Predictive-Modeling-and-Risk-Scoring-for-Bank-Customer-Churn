const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
  WidthType, ShadingType, BorderStyle, AlignmentType, ImageRun, PageBreak,
  LevelFormat, convertInchesToTwip, Header, Footer, PageNumber, NumberFormat,
} = require("docx");

const FIG = "/home/claude/churn_project/figures";
const NAVY = "1F3864";
const BLUE = "2E5C8A";
const RUST = "C9563E";
const GREY = "595959";
const LIGHT = "EEF2F7";

function pngSize(path) {
  const buf = fs.readFileSync(path);
  // PNG: width at bytes 16-19, height at bytes 20-23 (big-endian), after 8-byte sig + 4-byte len + 4-byte 'IHDR'
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  return { width, height };
}

function dims(path, maxW = 600) {
  let d;
  try {
    d = pngSize(path);
  } catch (e) {
    return { width: maxW, height: Math.round(maxW * 0.6) };
  }
  const ratio = d.height / d.width;
  return { width: maxW, height: Math.round(maxW * ratio) };
}

function figure(path, caption, maxW = 600) {
  const { width, height } = dims(path, maxW);
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 80 },
      children: [new ImageRun({ data: fs.readFileSync(path), transformation: { width, height }, type: "png" })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [new TextRun({ text: caption, italics: true, size: 18, color: GREY })],
    }),
  ];
}

function h1(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 }, children: [new TextRun({ text })] });
}
function h2(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 280, after: 140 }, children: [new TextRun({ text })] });
}
function p(text, opts = {}) {
  return new Paragraph({ spacing: { after: 160 }, children: [new TextRun({ text, ...opts })] });
}
function bullet(text, opts = {}) {
  return new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 80 }, children: [new TextRun({ text, ...opts })] });
}

function cell(text, opts = {}) {
  const { bold = false, fill = null, width = 2000, color = "000000", align = AlignmentType.LEFT } = opts;
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: fill ? { type: ShadingType.CLEAR, fill } : undefined,
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    children: [new Paragraph({ alignment: align, children: [new TextRun({ text: String(text), bold, color })] })],
  });
}

const metrics = JSON.parse(fs.readFileSync("/home/claude/churn_project/metrics.json"));
const R = metrics.results;
const pct = (x) => (x * 100).toFixed(1) + "%";
const num = (x) => x.toFixed(3);

// ---------------------------------------------------------------------------
// Metrics comparison table
// ---------------------------------------------------------------------------
const metricCols = ["Accuracy", "Precision", "Recall", "F1-Score", "ROC-AUC"];
const modelOrder = ["Logistic Regression", "Decision Tree", "Random Forest", "Gradient Boosting"];

const metricsTable = new Table({
  width: { size: 9500, type: WidthType.DXA },
  columnWidths: [2800, 1675, 1675, 1675, 1675, 1675],
  rows: [
    new TableRow({
      tableHeader: true,
      children: [
        cell("Model", { bold: true, fill: NAVY, color: "FFFFFF", width: 2800 }),
        ...metricCols.map((m) => cell(m, { bold: true, fill: NAVY, color: "FFFFFF", width: 1675, align: AlignmentType.CENTER })),
      ],
    }),
    ...modelOrder.map((m, i) =>
      new TableRow({
        children: [
          cell(m, { bold: m === "Random Forest", fill: m === "Random Forest" ? LIGHT : (i % 2 ? "F7F9FC" : "FFFFFF"), width: 2800 }),
          ...metricCols.map((mc) =>
            cell(num(R[m][mc]), { fill: m === "Random Forest" ? LIGHT : (i % 2 ? "F7F9FC" : "FFFFFF"), width: 1675, align: AlignmentType.CENTER })
          ),
        ],
      })
    ),
  ],
});

// ---------------------------------------------------------------------------
// Feature importance table (top 10, native)
// ---------------------------------------------------------------------------
const fiLines = fs.readFileSync("/home/claude/churn_project/models/feature_importance.csv", "utf8").trim().split("\n").slice(1);
const fiTop = fiLines.slice(0, 10).map((l) => {
  const [name, val] = l.split(",");
  return { name, val: parseFloat(val) };
});

const fiTable = new Table({
  width: { size: 8000, type: WidthType.DXA },
  columnWidths: [1000, 4500, 2500],
  rows: [
    new TableRow({
      tableHeader: true,
      children: [
        cell("Rank", { bold: true, fill: NAVY, color: "FFFFFF", width: 1000, align: AlignmentType.CENTER }),
        cell("Feature", { bold: true, fill: NAVY, color: "FFFFFF", width: 4500 }),
        cell("Relative Importance", { bold: true, fill: NAVY, color: "FFFFFF", width: 2500, align: AlignmentType.CENTER }),
      ],
    }),
    ...fiTop.map((f, i) =>
      new TableRow({
        children: [
          cell(i + 1, { fill: i % 2 ? "F7F9FC" : "FFFFFF", width: 1000, align: AlignmentType.CENTER }),
          cell(f.name, { fill: i % 2 ? "F7F9FC" : "FFFFFF", width: 4500 }),
          cell(f.val.toFixed(4), { fill: i % 2 ? "F7F9FC" : "FFFFFF", width: 2500, align: AlignmentType.CENTER }),
        ],
      })
    ),
  ],
});

// ---------------------------------------------------------------------------
// Dataset schema table
// ---------------------------------------------------------------------------
const schema = [
  ["CustomerId", "Unique customer identifier (dropped before modeling — non-informative)"],
  ["Surname", "Customer surname (dropped before modeling — non-informative, PII)"],
  ["CreditScore", "Customer creditworthiness (numeric)"],
  ["Geography", "France, Spain, Germany (categorical, one-hot encoded)"],
  ["Gender", "Male / Female (categorical, one-hot encoded)"],
  ["Age", "Customer age in years"],
  ["Tenure", "Years with the bank"],
  ["Balance", "Account balance"],
  ["NumOfProducts", "Number of bank products held"],
  ["HasCrCard", "Credit card ownership flag"],
  ["IsActiveMember", "Activity indicator"],
  ["EstimatedSalary", "Estimated annual salary"],
  ["Exited (target)", "Churn indicator — 1 = churned, 0 = retained"],
];
const schemaTable = new Table({
  width: { size: 9500, type: WidthType.DXA },
  columnWidths: [2500, 7000],
  rows: [
    new TableRow({
      tableHeader: true,
      children: [
        cell("Column", { bold: true, fill: NAVY, color: "FFFFFF", width: 2500 }),
        cell("Description", { bold: true, fill: NAVY, color: "FFFFFF", width: 7000 }),
      ],
    }),
    ...schema.map(([a, b], i) =>
      new TableRow({
        children: [
          cell(a, { fill: i % 2 ? "F7F9FC" : "FFFFFF", width: 2500, bold: true }),
          cell(b, { fill: i % 2 ? "F7F9FC" : "FFFFFF", width: 7000 }),
        ],
      })
    ),
  ],
});

// ---------------------------------------------------------------------------
// Build document
// ---------------------------------------------------------------------------
const doc = new Document({
  numbering: {
    config: [{ reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] }],
  },
  sections: [
    // ---------------- Title page ----------------
    {
      properties: { page: { size: { width: 12240, height: 15840 } } },
      children: [
        new Paragraph({ spacing: { before: 2000, after: 200 }, alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "PREDICTIVE MODELING AND RISK SCORING", bold: true, size: 44, color: NAVY })] }),
        new Paragraph({ spacing: { after: 600 }, alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "FOR BANK CUSTOMER CHURN", bold: true, size: 44, color: NAVY })] }),
        new Paragraph({ spacing: { after: 200 }, alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "A Predictive Churn Intelligence System for Proactive Retention", italics: true, size: 26, color: GREY })] }),
        new Paragraph({ spacing: { before: 800, after: 80 }, alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "Research Paper", bold: true, size: 24 })] }),
        new Paragraph({ spacing: { after: 40 }, alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "Prepared for: The European Central Bank · Unified Mentor", size: 22, color: GREY })] }),
        new Paragraph({ spacing: { after: 40 }, alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "July 2026", size: 22, color: GREY })] }),
        new Paragraph({ spacing: { before: 1200 }, alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "Deployed model: Random Forest Classifier  |  Test ROC-AUC: " + num(R["Random Forest"]["ROC-AUC"]), size: 20, color: BLUE, bold: true })] }),
        new Paragraph({ children: [new PageBreak()] }),
      ],
    },
    // ---------------- Body ----------------
    {
      properties: {
        page: { size: { width: 12240, height: 15840 }, margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 } },
      },
      headers: {
        default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "Bank Customer Churn — Predictive Risk Scoring", size: 16, color: GREY })] })] }),
      },
      footers: {
        default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: GREY })] })] }),
      },
      children: [
        h1("1. Executive Overview"),
        p("Customer churn erodes Customer Lifetime Value, destabilizes revenue, and closes off cross-sell and upsell opportunities. Traditional churn analysis is retrospective — it explains why a customer left after the fact. This project builds a predictive churn intelligence system that scores every customer's probability of leaving before they leave, so retention teams can act early, target precisely, and spend efficiently."),
        p("Four models were developed and compared — Logistic Regression, Decision Tree, Random Forest, and Gradient Boosting — on a stratified 80/20 train-test split with 5-fold cross-validation. The Random Forest classifier was selected for deployment, achieving a test ROC-AUC of " + num(R["Random Forest"]["ROC-AUC"]) + " and the strongest precision-recall balance (F1 = " + num(R["Random Forest"]["F1-Score"]) + ") of the four candidates. Explainability analysis (feature importance, permutation importance, and partial dependence) confirms that geography, age, and engagement–product interaction are the dominant churn drivers — findings that translate directly into targeted retention actions."),

        h1("2. Background and Business Context"),
        p("Customer churn directly impacts:"),
        bullet("Customer Lifetime Value (CLV)"),
        bullet("Revenue stability"),
        bullet("Cross-sell and upsell potential"),
        bullet("Long-term competitiveness of retail banks"),
        p("Modern banking requires early identification of at-risk customers to enable proactive retention campaigns, personalized offers, and targeted engagement — replacing reactive, broad, and costly retention efforts with quantitative, explainable risk scoring."),

        h1("3. Problem Statement"),
        p("Despite having rich customer-level data, banks often lack accurate churn prediction models, quantitative churn risk scores, and explainable insights into churn drivers. As a result, retention actions tend to be reactive rather than proactive, broad rather than targeted, and inefficient and costly."),

        h1("4. Objectives"),
        h2("4.1 Primary Objectives"),
        bullet("Predict customer churn with high accuracy"),
        bullet("Generate churn probability scores"),
        bullet("Identify key churn drivers"),
        h2("4.2 Secondary Objectives"),
        bullet("Reduce false positives in churn detection"),
        bullet("Improve interpretability of ML models"),
        bullet("Enable scenario-based churn risk analysis"),

        h1("5. Dataset Description"),
        p("The modeling dataset contains " + (metrics.n_train + metrics.n_test).toLocaleString() + " customer records across 13 fields. " + (Object.values(metrics.missing_values).reduce((a,b)=>a+b,0)) + " missing values were present across CreditScore, Tenure, and EstimatedSalary and were resolved via median imputation inside the modeling pipeline. Overall churn prevalence is " + pct(metrics.churn_rate_train) + ", consistent with observed retail-banking benchmarks."),
        schemaTable,
        p(""),
        p("Note: this analysis was run on a schema-matched synthetic dataset calibrated to reproduce realistic churn patterns (elevated churn in Germany, among inactive members, and among customers holding 3–4 products), since no live customer export was provided with the brief. The identical pipeline runs unchanged against the bank's real data — see the accompanying README.", { italics: true, color: GREY, size: 20 }),

        h1("6. Exploratory Data Analysis"),
        p("Churn is imbalanced at roughly " + pct(metrics.churn_rate_train) + " of the customer base, and churn rate varies sharply by geography, activity status, and product holdings."),
        ...figure(`${FIG}/eda_overview.png`, "Figure 1. Class balance (left) and churn rate by geography (right)."),
        p("Germany shows a materially higher churn rate than France or Spain — a pattern that persists even after controlling for other variables in the modeling stage below."),
        ...figure(`${FIG}/eda_drivers.png`, "Figure 2. Churn rate by activity status, number of products, and gender."),
        p("Two patterns stand out. First, inactive members churn at nearly double the rate of active members. Second, the relationship between product count and churn is U-shaped in the low range but rises sharply at the top: customers holding 3 or 4 products — typically a sign of over-selling or product-fit mismatch rather than deeper loyalty — churn at substantially higher rates than customers with 1–2 products."),
        ...figure(`${FIG}/eda_distributions.png`, "Figure 3. Age and credit score distributions, retained vs. churned."),
        p("Churned customers skew older; credit score shows a much weaker separation, suggesting it is a secondary rather than primary churn driver — consistent with the model-based importance rankings in Section 8."),
        ...figure(`${FIG}/correlation_matrix.png`, "Figure 4. Correlation matrix across numeric and engineered features.", 520),

        h1("7. Analytical Methodology"),
        h2("7.1 Data Preprocessing"),
        bullet("Missing values resolved via median (numeric) / most-frequent (categorical) imputation, fit only on the training fold to prevent leakage"),
        bullet("Non-informative identifiers (CustomerId, Surname) removed prior to modeling"),
        bullet("Categorical variables (Geography, Gender) one-hot encoded"),
        bullet("Numerical features standardized (zero mean, unit variance) inside the pipeline"),
        h2("7.2 Feature Engineering"),
        bullet("Balance-to-Salary ratio — captures financial exposure relative to income"),
        bullet("Product density — products held per year of tenure"),
        bullet("Engagement–product interaction — activity status × number of products"),
        bullet("Age–tenure interaction — captures lifecycle-stage effects"),
        bullet("Zero-balance flag and products-per-credit-card ratio — secondary engineered signals"),
        h2("7.3 Train–Test Strategy"),
        p("An 80/20 stratified split preserved the churn class ratio in both partitions (train: " + pct(metrics.churn_rate_train) + ", test: " + pct(metrics.churn_rate_test) + "). 5-fold stratified cross-validation was additionally run on the training set for every model to check stability of the ROC-AUC estimate before final test evaluation."),
        h2("7.4 Model Development"),
        p("Four models were trained inside identical preprocessing pipelines to ensure a fair comparison:"),
        bullet("Logistic Regression — interpretability benchmark, class-weight balanced"),
        bullet("Decision Tree — simple non-linear baseline, depth-limited to control overfitting"),
        bullet("Random Forest — primary ensemble candidate, class-weight balanced"),
        bullet("Gradient Boosting — advanced ensemble comparison"),
        p("XGBoost was scoped as an optional extension in the brief; the pipeline is structured so it can be swapped in for the Gradient Boosting step with no other changes, if the deployment environment has the library available."),

        h1("8. Model Evaluation"),
        p("All four models were scored on the held-out test set using accuracy, precision, recall, F1-score, and ROC-AUC:"),
        metricsTable,
        p(""),
        ...figure(`${FIG}/model_comparison.png`, "Figure 5. Model performance comparison across all five evaluation metrics."),
        ...figure(`${FIG}/roc_curves.png`, "Figure 6. ROC curves for all four candidate models.", 480),
        p("Random Forest was selected for deployment: it achieves the highest test ROC-AUC (" + num(R["Random Forest"]["ROC-AUC"]) + ") and the best F1-score (" + num(R["Random Forest"]["F1-Score"]) + ") of the four models, indicating the most balanced trade-off between correctly flagging churners (recall = " + pct(R["Random Forest"]["Recall"]) + ") and avoiding false alarms (precision = " + pct(R["Random Forest"]["Precision"]) + "). Gradient Boosting reaches higher raw accuracy (" + pct(R["Gradient Boosting"]["Accuracy"]) + ") but at the cost of very low recall (" + pct(R["Gradient Boosting"]["Recall"]) + ") — it defaults toward predicting the majority \"retained\" class, which is unsuitable for a retention use case where missing an at-risk customer is costlier than a false alarm."),
        ...figure(`${FIG}/confusion_matrix.png`, "Figure 7. Confusion matrix for the deployed Random Forest model at a 0.5 probability threshold.", 420),
        p("The dashboard's decision threshold is adjustable (see Section 11), allowing retention teams to trade precision for recall depending on campaign capacity and cost-per-contact — lowering the threshold below 0.5 catches more true churners at the cost of more false positives, and vice versa."),

        h1("9. Model Explainability"),
        p("Two complementary importance methods were used to identify churn drivers and cross-validate findings, supporting both regulatory transparency and business trust:"),
        h2("9.1 Native Feature Importance (Random Forest)"),
        fiTable,
        p(""),
        ...figure(`${FIG}/feature_importance.png`, "Figure 8. Top 12 churn drivers by native (impurity-based) feature importance."),
        h2("9.2 Permutation Importance (Model-Agnostic)"),
        p("Permutation importance — measuring the drop in test-set ROC-AUC when each feature is randomly shuffled — was computed as an independent check. Geography, Age, and NumOfProducts again rank at the top, corroborating the native importance ranking and indicating these are genuine, robust drivers rather than artifacts of one particular model."),
        ...figure(`${FIG}/permutation_importance.png`, "Figure 9. Permutation importance — ROC-AUC decrease when each feature is shuffled."),
        h2("9.3 Partial Dependence"),
        p("Partial dependence plots show how the model's predicted churn probability changes as each feature varies, holding all others constant — useful for understanding direction and shape of effect, not just magnitude."),
        ...figure(`${FIG}/partial_dependence.png`, "Figure 10. Partial dependence — churn probability vs. top numeric drivers.", 560),

        h1("10. Key Insights and Recommendations"),
        h2("10.1 Insights"),
        bullet("Geography is the single strongest driver: German customers churn at a materially higher rate than French or Spanish customers, even after controlling for balance and activity. This points to a market-specific competitive or service issue worth qualitative follow-up."),
        bullet("Engagement matters more than tenure: inactive members are consistently higher-risk than active members regardless of how long they have banked with the institution — loyalty is driven by ongoing engagement, not history."),
        bullet("Product over-concentration is a red flag, not a loyalty signal: customers holding 3–4 products churn far more than those holding 1–2, suggesting these customers were over-sold or mis-fit products rather than deepened relationships."),
        bullet("Age is a strong, gradual risk factor: churn probability rises steadily with age, particularly past the mid-40s, warranting age-segment-specific retention messaging."),
        bullet("Credit score and having a credit card are comparatively weak drivers — deprioritize these in manual retention scoring in favor of the engagement and product variables above."),
        h2("10.2 Recommendations"),
        bullet("Deploy the Random Forest risk score into the CRM to flag high-risk customers (≥60% probability) for proactive relationship-manager outreach within 48 hours."),
        bullet("Launch a Germany-specific retention review: investigate pricing, service levels, and competitive offers in that market given its outsized churn rate."),
        bullet("Build a re-engagement campaign targeting inactive members before they reach high risk — activity, not tenure, is the actionable lever."),
        bullet("Audit product bundling practices for customers being sold a 3rd or 4th product; ensure product fit rather than pure cross-sell volume."),
        bullet("Recalibrate the decision threshold quarterly against retention-campaign capacity and cost-per-contact, using the what-if simulator in the accompanying dashboard."),
        bullet("Retrain the model on a rolling basis (e.g. quarterly) as customer behavior and market conditions shift, to guard against model drift."),

        h1("11. Deliverables"),
        bullet("This research paper (EDA, methodology, model evaluation, explainability, insights, and recommendations)"),
        bullet("A Streamlit dashboard providing: a customer churn risk calculator, portfolio-level probability distribution visualization, a feature importance dashboard, and a what-if scenario simulator for engagement/product variables"),
        bullet("An executive summary for government/regulatory stakeholders"),

        h1("12. Conclusion"),
        p("This project reframes customer churn from a behavioral and relationship-strength perspective rather than a purely demographic one. By centering the analysis on engagement and product utilization — rather than static customer attributes — it surfaces actionable levers for retention strategy design, product optimization, and customer loyalty enhancement. The resulting Random Forest model, paired with a transparent explainability layer and an interactive scoring dashboard, gives retention teams a quantitative, auditable, and immediately actionable early-warning system: shifting churn management from reactive damage control to proactive relationship management."),
      ],
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync("/home/claude/churn_project/docx_build/Research_Paper.docx", buf);
  console.log("done");
});
