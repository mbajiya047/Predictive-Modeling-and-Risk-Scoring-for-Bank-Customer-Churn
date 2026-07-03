import { useState, useMemo } from 'react';
import { 
  Users, 
  TrendingUp, 
  ShieldAlert, 
  UserCheck, 
  Search, 
  Globe, 
  Percent, 
  Sparkles, 
  RefreshCw, 
  Copy, 
  Check, 
  ChevronRight, 
  AlertTriangle,
  Lightbulb,
  Building,
  CreditCard,
  Gauge
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { CUSTOMER_DATA, FEATURE_IMPORTANCES, Customer } from './data';

export default function App() {
  // Search & Filter State for Customer Table
  const [searchTerm, setSearchTerm] = useState('');
  const [geoFilter, setGeographyFilter] = useState<'All' | 'France' | 'Germany' | 'Spain'>('All');
  const [churnFilter, setChurnFilter] = useState<'All' | 'Churned' | 'Retained'>('All');
  
  // Selected Customer for Predictor (Defaults to first customer)
  const [selectedCustomerId, setSelectedCustomerId] = useState<number>(CUSTOMER_DATA[0].customerId);

  // Predictor Form Input State (initialized with selected customer values)
  const selectedCustomer = useMemo(() => {
    return CUSTOMER_DATA.find(c => c.customerId === selectedCustomerId) || CUSTOMER_DATA[0];
  }, [selectedCustomerId]);

  const [predictorValues, setPredictorValues] = useState({
    creditScore: selectedCustomer.creditScore,
    geography: selectedCustomer.geography,
    gender: selectedCustomer.gender,
    age: selectedCustomer.age,
    tenure: selectedCustomer.tenure,
    balance: selectedCustomer.balance,
    numOfProducts: selectedCustomer.numOfProducts,
    hasCrCard: selectedCustomer.hasCrCard,
    isActiveMember: selectedCustomer.isActiveMember,
    estimatedSalary: selectedCustomer.estimatedSalary,
  });

  // Keep form values in sync when a new customer is selected from the list
  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomerId(customer.customerId);
    setPredictorValues({
      creditScore: customer.creditScore,
      geography: customer.geography,
      gender: customer.gender,
      age: customer.age,
      tenure: customer.tenure,
      balance: customer.balance,
      numOfProducts: customer.numOfProducts,
      hasCrCard: customer.hasCrCard,
      isActiveMember: customer.isActiveMember,
      estimatedSalary: customer.estimatedSalary,
    });
    // Reset AI recommendation state
    setAiRecommendation('');
    setAiError('');
  };

  // AI Recommendation State
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiRecommendation, setAiRecommendation] = useState('');
  const [aiError, setAiError] = useState('');
  const [copied, setCopied] = useState(false);

  // Dynamic Metrics calculated from CUSTOMER_DATA
  const metrics = useMemo(() => {
    const total = CUSTOMER_DATA.length;
    const churned = CUSTOMER_DATA.filter(c => c.exited).length;
    const churnRate = ((churned / total) * 100).toFixed(1);
    
    const avgCreditScore = Math.round(CUSTOMER_DATA.reduce((acc, c) => acc + c.creditScore, 0) / total);
    const avgAge = Math.round(CUSTOMER_DATA.reduce((acc, c) => acc + c.age, 0) / total);
    const activeMembers = CUSTOMER_DATA.filter(c => c.isActiveMember).length;
    const activeRate = ((activeMembers / total) * 100).toFixed(1);

    // Churn rate by country to find the highest-risk region
    const countries = ['France', 'Germany', 'Spain'] as const;
    let maxChurnCountry = 'France';
    let maxChurnRate = 0;
    
    countries.forEach(country => {
      const countryUsers = CUSTOMER_DATA.filter(c => c.geography === country);
      const countryChurned = countryUsers.filter(c => c.exited).length;
      const rate = countryUsers.length > 0 ? (countryChurned / countryUsers.length) * 100 : 0;
      if (rate > maxChurnRate) {
        maxChurnRate = rate;
        maxChurnCountry = country;
      }
    });

    return {
      total,
      churnRate,
      avgCreditScore,
      avgAge,
      activeRate,
      highestRiskRegion: `${maxChurnCountry} (${maxChurnRate.toFixed(1)}%)`
    };
  }, []);

  // Filtered Customers list
  const filteredCustomers = useMemo(() => {
    return CUSTOMER_DATA.filter(c => {
      const matchesSearch = c.surname.toLowerCase().includes(searchTerm.toLowerCase()) || c.customerId.toString().includes(searchTerm);
      const matchesGeo = geoFilter === 'All' || c.geography === geoFilter;
      const matchesChurn = churnFilter === 'All' || 
        (churnFilter === 'Churned' && c.exited) || 
        (churnFilter === 'Retained' && !c.exited);
      return matchesSearch && matchesGeo && matchesChurn;
    });
  }, [searchTerm, geoFilter, churnFilter]);

  // Chart 1 Data: Churn Rate by Geography
  const chartGeoData = useMemo(() => {
    const countries = ['France', 'Germany', 'Spain'] as const;
    return countries.map(country => {
      const countryUsers = CUSTOMER_DATA.filter(c => c.geography === country);
      const countryChurned = countryUsers.filter(c => c.exited).length;
      const rate = countryUsers.length > 0 ? Math.round((countryChurned / countryUsers.length) * 100) : 0;
      return {
        name: country,
        'Taxa de Churn (%)': rate,
        'Clientes Totais': countryUsers.length,
      };
    });
  }, []);

  // Chart 2 Data: Churn Rate by Age Group
  const chartAgeData = useMemo(() => {
    const groups = [
      { name: '18-35', min: 18, max: 35 },
      { name: '36-50', min: 36, max: 50 },
      { name: '51-65', min: 51, max: 65 },
      { name: '66+', min: 66, max: 120 }
    ];
    return groups.map(g => {
      const groupUsers = CUSTOMER_DATA.filter(c => c.age >= g.min && c.age <= g.max);
      const groupChurned = groupUsers.filter(c => c.exited).length;
      const rate = groupUsers.length > 0 ? Math.round((groupChurned / groupUsers.length) * 100) : 0;
      return {
        name: g.name,
        'Taxa de Churn (%)': rate,
        'Total no Grupo': groupUsers.length
      };
    });
  }, []);

  // Chart 3 Data: Churn Rate by Product Count
  const chartProductData = useMemo(() => {
    const products = [1, 2, 3, 4];
    return products.map(p => {
      const productUsers = CUSTOMER_DATA.filter(c => c.numOfProducts === p);
      const productChurned = productUsers.filter(c => c.exited).length;
      const rate = productUsers.length > 0 ? Math.round((productChurned / productUsers.length) * 100) : 0;
      return {
        name: `${p} Prod.`,
        'Taxa de Churn (%)': rate,
        'Clientes': productUsers.length
      };
    });
  }, []);

  // Math-based predictive risk calculator (logistic-like logit scoring formula)
  const currentRiskScore = useMemo(() => {
    let logit = -1.5; // Baseline intercept

    // Age impact (Peak risk around 45-60)
    if (predictorValues.age > 30) {
      logit += (predictorValues.age - 30) * 0.058;
    }
    if (predictorValues.age > 60) {
      // Risk slowly declines for retirees
      logit -= (predictorValues.age - 60) * 0.03;
    }

    // Geography impact
    if (predictorValues.geography === 'Germany') {
      logit += 1.1; // Extremely strong positive coefficient
    } else if (predictorValues.geography === 'Spain') {
      logit -= 0.2; // Mild negative coefficient
    }

    // Is Active Member (Very powerful retention factor)
    if (predictorValues.isActiveMember) {
      logit -= 1.15;
    }

    // Product Count impact
    if (predictorValues.numOfProducts === 1) {
      logit += 0.25;
    } else if (predictorValues.numOfProducts === 2) {
      logit -= 0.65; // Sweet spot! Low churn risk
    } else if (predictorValues.numOfProducts === 3) {
      logit += 2.4; // Extremely high churn risk
    } else if (predictorValues.numOfProducts === 4) {
      logit += 4.8; // Guaranteed churn risk
    }

    // Credit Score impact
    if (predictorValues.creditScore < 500) {
      logit += (500 - predictorValues.creditScore) * 0.006;
    } else if (predictorValues.creditScore > 750) {
      logit -= 0.25;
    }

    // Balance impact
    if (predictorValues.balance > 40000) {
      logit += (predictorValues.balance - 40000) * 0.0000035;
    }

    // Tenure impact
    if (predictorValues.tenure < 3) {
      logit += (3 - predictorValues.tenure) * 0.15;
    }

    // Gender impact
    if (predictorValues.gender === 'Female') {
      logit += 0.2;
    }

    // Logistic function: P = 1 / (1 + e^-logit)
    const probability = 1 / (1 + Math.exp(-logit));
    return Math.min(Math.max(Math.round(probability * 100), 0), 100);
  }, [predictorValues]);

  // Determine risk category
  const riskCategory = useMemo(() => {
    if (currentRiskScore < 30) return { label: 'Baixo Risco', color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' };
    if (currentRiskScore < 70) return { label: 'Risco Moderado', color: 'text-amber-500 bg-amber-500/10 border-amber-500/20' };
    return { label: 'Risco Elevado', color: 'text-red-500 bg-red-500/10 border-red-500/20' };
  }, [currentRiskScore]);

  // Generate Retention plan via Server-Side API calling Gemini
  const handleGenerateRetentionPlan = async () => {
    setIsGeneratingAi(true);
    setAiRecommendation('');
    setAiError('');
    try {
      const response = await fetch('/api/generate-retention', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customer: {
            surname: selectedCustomer.surname,
            age: predictorValues.age,
            creditScore: predictorValues.creditScore,
            geography: predictorValues.geography,
            gender: predictorValues.gender,
            balance: predictorValues.balance,
            estimatedSalary: predictorValues.estimatedSalary,
            numOfProducts: predictorValues.numOfProducts,
            hasCrCard: predictorValues.hasCrCard,
            isActiveMember: predictorValues.isActiveMember,
            tenure: predictorValues.tenure,
          }
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Falha ao se comunicar com o servidor.');
      }

      setAiRecommendation(data.text);
    } catch (err: any) {
      console.error(err);
      setAiError(err.message || 'Ocorreu um erro ao gerar as recomendações de retenção.');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(aiRecommendation);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Helper parser for markdown content (for styled render inside the card)
  const renderMarkdown = (text: string) => {
    return text.split('\n').map((line, i) => {
      // Headers
      if (line.startsWith('### ')) {
        return <h4 key={i} className="text-md font-bold text-slate-100 mt-4 mb-2 first:mt-0">{line.replace('### ', '')}</h4>;
      }
      if (line.startsWith('## ')) {
        return <h3 key={i} className="text-lg font-bold text-emerald-400 mt-5 mb-2 first:mt-0">{line.replace('## ', '')}</h3>;
      }
      if (line.startsWith('# ')) {
        return <h2 key={i} className="text-xl font-bold text-emerald-400 mt-6 mb-3 first:mt-0">{line.replace('# ', '')}</h2>;
      }
      // Bullets
      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        const content = line.trim().substring(2);
        return (
          <li key={i} className="text-slate-300 ml-4 list-disc mb-1 leading-relaxed">
            {parseBoldText(content)}
          </li>
        );
      }
      // Empty line
      if (line.trim() === '') {
        return <div key={i} className="h-2" />;
      }
      // Regular paragraph
      return <p key={i} className="text-slate-300 text-sm mb-2 leading-relaxed">{parseBoldText(line)}</p>;
    });
  };

  const parseBoldText = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={idx} className="font-semibold text-white">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500/30 selection:text-emerald-400 antialiased">
      
      {/* SaaS Dashboard Header */}
      <header className="border-b border-slate-900 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/10">
              <TrendingUp className="h-5 w-5 text-slate-950" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                ChurnGuard <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">AI v3.5</span>
              </h1>
              <p className="text-xs text-slate-400">Portal Analítico de Retenção de Clientes Bancários</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 self-end md:self-auto text-xs font-mono bg-slate-950/80 px-4 py-2.5 rounded-lg border border-slate-900 shadow-inner">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-slate-400">Agente Ativo:</span>
            <span className="text-emerald-400 font-medium select-all">mbajiya047@gmail.com</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* Bento Row 1: KPI Cards */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4" id="kpi-panel">
          <div className="bg-slate-900/40 border border-slate-900 rounded-2xl p-5 hover:border-slate-800 transition-all shadow-sm">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold tracking-wider uppercase">Clientes Analisados</span>
              <Users className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold text-white tracking-tight">{metrics.total}</div>
            <p className="text-[10px] text-slate-500 mt-1">Registros consolidados no banco de dados</p>
          </div>

          <div className="bg-slate-900/40 border border-slate-900 rounded-2xl p-5 hover:border-slate-800 transition-all shadow-sm">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold tracking-wider uppercase">Taxa de Churn Global</span>
              <Percent className="h-4 w-4 text-red-400" />
            </div>
            <div className="text-2xl font-bold text-red-400 tracking-tight">{metrics.churnRate}%</div>
            <p className="text-[10px] text-red-400/50 mt-1">Média de cancelamento de conta histórica</p>
          </div>

          <div className="bg-slate-900/40 border border-slate-900 rounded-2xl p-5 hover:border-slate-800 transition-all shadow-sm">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold tracking-wider uppercase">Membros Ativos</span>
              <UserCheck className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-emerald-400 tracking-tight">{metrics.activeRate}%</div>
            <p className="text-[10px] text-emerald-400/50 mt-1">Clientes engajados com o banco</p>
          </div>

          <div className="bg-slate-900/40 border border-slate-900 rounded-2xl p-5 hover:border-slate-800 transition-all shadow-sm">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold tracking-wider uppercase">Hub de Maior Churn</span>
              <Globe className="h-4 w-4 text-amber-500" />
            </div>
            <div className="text-2xl font-bold text-amber-400 tracking-tight truncate">{metrics.highestRiskRegion}</div>
            <p className="text-[10px] text-amber-400/50 mt-1">Região demográfica sob maior ameaça</p>
          </div>
        </section>

        {/* Bento Row 2: Charts and Explorer (Left Column) vs Predictor (Right Column) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* LEFT 2 COLUMNS: Charts & Explorer */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Churn Analytics Charts */}
            <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-6 space-y-6">
              <div>
                <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-400" /> Tendências e Padrões de Churn Real
                </h3>
                <p className="text-xs text-slate-400 mt-1">Análise descritiva dos principais correlatos demográficos e comportamentais</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Chart 1: Geography */}
                <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-900/50 space-y-2">
                  <h4 className="text-xs font-semibold text-slate-300 text-center">Churn por País</h4>
                  <div className="h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartGeoData} margin={{ top: 10, right: 5, left: -25, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                        <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} />
                        <YAxis stroke="#64748b" fontSize={10} tickLine={false} unit="%" />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px' }}
                          labelStyle={{ color: '#fff', fontSize: '11px', fontWeight: 'bold' }}
                          itemStyle={{ color: '#10b981', fontSize: '11px' }}
                        />
                        <Bar dataKey="Taxa de Churn (%)" fill="#10b981" radius={[4, 4, 0, 0]}>
                          {chartGeoData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.name === 'Germany' ? '#f43f5e' : '#10b981'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="text-[10px] text-center text-slate-500 leading-normal">Alemanha registra mais que o dobro de churn dos demais hubs.</p>
                </div>

                {/* Chart 2: Age */}
                <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-900/50 space-y-2">
                  <h4 className="text-xs font-semibold text-slate-300 text-center">Churn por Faixa Etária</h4>
                  <div className="h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartAgeData} margin={{ top: 10, right: 5, left: -25, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                        <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} />
                        <YAxis stroke="#64748b" fontSize={10} tickLine={false} unit="%" />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px' }}
                          labelStyle={{ color: '#fff', fontSize: '11px', fontWeight: 'bold' }}
                          itemStyle={{ color: '#3b82f6', fontSize: '11px' }}
                        />
                        <Bar dataKey="Taxa de Churn (%)" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                          {chartAgeData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.name === '51-65' ? '#f43f5e' : '#3b82f6'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                <p className="text-center font-mono text-[10px] text-gray-400">
                  Alta criticidade em clientes seniores (51-65 anos).
                </p>
              </div>

              {/* Chart 3: NumOfProducts */}
              <div className="flex flex-col bg-slate-950/60 p-4 rounded-2xl border border-slate-900/50 space-y-2">
                <h4 className="text-xs font-semibold text-slate-300 text-center">Churn por Qtd Produtos</h4>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartProductData} margin={{ top: 10, right: 5, left: -25, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} />
                      <YAxis stroke="#64748b" fontSize={10} tickLine={false} unit="%" />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px' }}
                        labelStyle={{ color: '#fff', fontSize: '11px', fontWeight: 'bold' }}
                        itemStyle={{ color: '#f59e0b', fontSize: '11px' }}
                      />
                      <Bar dataKey="Taxa de Churn (%)" fill="#f59e0b" radius={[4, 4, 0, 0]}>
                        {chartProductData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={index >= 2 ? '#f43f5e' : '#f59e0b'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-[10px] text-center text-slate-500 leading-normal">Clientes de 3-4 produtos são anomalias críticas de churn.</p>
              </div>

            </div>
          </div>

          {/* Customer Explorer Panel */}
          <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-6 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                  <Users className="h-4 w-4 text-emerald-400" /> Diretório de Clientes Analisados
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Selecione um cliente para carregar no simulador preditivo</p>
              </div>
            </div>

            {/* Filters Bar */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Search */}
              <div className="relative col-span-1 md:col-span-1">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
                <input 
                  type="text"
                  placeholder="Buscar por sobrenome..."
                  className="w-full bg-slate-950/80 border border-slate-900 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 transition-all"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {/* Country Filter */}
              <select
                className="bg-slate-950/80 border border-slate-900 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50 transition-all cursor-pointer"
                value={geoFilter}
                onChange={(e) => setGeographyFilter(e.target.value as any)}
              >
                <option value="All">País: Todos</option>
                <option value="France">França</option>
                <option value="Germany">Alemanha</option>
                <option value="Spain">Espanha</option>
              </select>

              {/* Churn Filter */}
              <select
                className="bg-slate-950/80 border border-slate-900 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50 transition-all cursor-pointer"
                value={churnFilter}
                onChange={(e) => setChurnFilter(e.target.value as any)}
              >
                <option value="All">Status: Todos</option>
                <option value="Retained">Retidos</option>
                <option value="Churned">Churned</option>
              </select>
            </div>

            {/* Customers List Box */}
            <div className="bg-slate-950/80 rounded-2xl border border-slate-900 overflow-hidden shadow-inner">
              <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-900/60 custom-scrollbar">
                {filteredCustomers.length > 0 ? (
                  filteredCustomers.map((customer) => {
                    const isSelected = customer.customerId === selectedCustomerId;
                    return (
                      <button
                        key={customer.customerId}
                        onClick={() => handleSelectCustomer(customer)}
                        className={`w-full text-left px-4 py-3 flex items-center justify-between transition-all cursor-pointer group ${
                          isSelected 
                            ? 'bg-emerald-500/10 hover:bg-emerald-500/15 border-l-2 border-emerald-500' 
                            : 'hover:bg-slate-900/40 border-l-2 border-transparent'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-xs text-white group-hover:text-emerald-400 transition-colors">
                              {customer.surname}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">ID: {customer.customerId}</span>
                          </div>
                          <div className="flex items-center gap-3 text-[10px] text-slate-400">
                            <span className="flex items-center gap-1">
                              <Globe className="h-2.5 w-2.5 text-slate-500" /> {customer.geography}
                            </span>
                            <span>{customer.age} anos</span>
                            <span>€{customer.balance.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Churn Badge */}
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold ${
                            customer.exited 
                              ? 'bg-red-500/10 text-red-400 border border-red-500/20' 
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          }`}>
                            {customer.exited ? 'Churned' : 'Retido'}
                          </span>
                          <ChevronRight className={`h-3.5 w-3.5 text-slate-500 transition-transform ${isSelected ? 'translate-x-0.5 text-emerald-400' : 'group-hover:translate-x-0.5'}`} />
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="p-8 text-center text-slate-500 text-xs">
                    Nenhum cliente encontrado com os filtros aplicados.
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono px-1">
              <span>Exibindo {filteredCustomers.length} de {CUSTOMER_DATA.length} registros</span>
              <span className="flex items-center gap-1 text-slate-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block"></span> Clique para simular risco
              </span>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN (Predictor Form & Dynamic Machine Learning simulation) */}
        <div className="lg:col-span-1 space-y-8">
          
          {/* Churn Risk Predictor Simulator Card */}
          <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-6 space-y-6 shadow-xl relative overflow-hidden">
            
            {/* Visual background gradient accent */}
            <div className="absolute top-0 right-0 h-40 w-40 bg-gradient-to-bl from-emerald-500/5 to-transparent rounded-full pointer-events-none"></div>

            <div>
              <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <Gauge className="h-4.5 w-4.5 text-emerald-400" /> Simulador de Risco (Modelo ML)
              </h3>
              <p className="text-xs text-slate-400 mt-1">Ajuste os parâmetros ou selecione um cliente para recalcular o risco instantaneamente</p>
            </div>

            {/* Risk Gauge Visual Output */}
            <div className="bg-slate-950/80 p-5 rounded-2xl border border-slate-900/60 flex flex-col items-center justify-center space-y-4">
              <div className="relative h-28 w-44 flex items-center justify-center overflow-hidden">
                {/* Simulated Speedometer Arc */}
                <svg className="absolute top-0 left-0 w-full h-full transform -rotate-180" viewBox="0 0 100 50">
                  <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#1e293b" strokeWidth="8" strokeLinecap="round" />
                  <path 
                    d="M 10 50 A 40 40 0 0 1 90 50" 
                    fill="none" 
                    stroke="url(#gradient-stroke)" 
                    strokeWidth="8" 
                    strokeLinecap="round"
                    strokeDasharray="125.6"
                    strokeDashoffset={125.6 - (125.6 * currentRiskScore) / 100}
                  />
                  <defs>
                    <linearGradient id="gradient-stroke" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#10b981" />
                      <stop offset="50%" stopColor="#f59e0b" />
                      <stop offset="100%" stopColor="#f43f5e" />
                    </linearGradient>
                  </defs>
                </svg>
                
                {/* Numeric Score */}
                <div className="absolute bottom-0 text-center">
                  <div className="text-4xl font-extrabold text-white tracking-tight leading-none">{currentRiskScore}%</div>
                  <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-1">Risco de Churn</div>
                </div>
              </div>

              {/* Status Indicator */}
              <div className={`text-center px-4 py-1.5 rounded-full text-xs font-bold border ${riskCategory.color}`}>
                {riskCategory.label}
              </div>
            </div>

            {/* Predictor Param Sliders/Inputs */}
            <div className="space-y-4 text-xs">
              
              {/* Country Selection */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-slate-400 font-medium">País de Residência</label>
                  <select 
                    className="w-full bg-slate-950/80 border border-slate-900 rounded-xl px-3 py-2 text-slate-300 focus:outline-none focus:border-emerald-500/50"
                    value={predictorValues.geography}
                    onChange={(e) => setPredictorValues({ ...predictorValues, geography: e.target.value as any })}
                  >
                    <option value="France">França</option>
                    <option value="Germany">Alemanha (Alto Risco)</option>
                    <option value="Spain">Espanha</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-400 font-medium">Gênero</label>
                  <select 
                    className="w-full bg-slate-950/80 border border-slate-900 rounded-xl px-3 py-2 text-slate-300 focus:outline-none focus:border-emerald-500/50"
                    value={predictorValues.gender}
                    onChange={(e) => setPredictorValues({ ...predictorValues, gender: e.target.value as any })}
                  >
                    <option value="Male">Masculino</option>
                    <option value="Female">Feminino</option>
                  </select>
                </div>
              </div>

              {/* Age Slider */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <label className="text-slate-400 font-medium">Idade do Cliente</label>
                  <span className="font-mono text-white font-bold">{predictorValues.age} anos</span>
                </div>
                <input 
                  type="range" 
                  min="18" 
                  max="100" 
                  className="w-full h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  value={predictorValues.age}
                  onChange={(e) => setPredictorValues({ ...predictorValues, age: Number(e.target.value) })}
                />
              </div>

              {/* Credit Score Slider */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <label className="text-slate-400 font-medium">Score de Crédito</label>
                  <span className="font-mono text-white font-bold">{predictorValues.creditScore}</span>
                </div>
                <input 
                  type="range" 
                  min="350" 
                  max="850" 
                  className="w-full h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  value={predictorValues.creditScore}
                  onChange={(e) => setPredictorValues({ ...predictorValues, creditScore: Number(e.target.value) })}
                />
              </div>

              {/* Num of Products & Active Status */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-slate-400 font-medium">Qtd de Produtos</label>
                  <select 
                    className="w-full bg-slate-950/80 border border-slate-900 rounded-xl px-3 py-2 text-slate-300 focus:outline-none focus:border-emerald-500/50"
                    value={predictorValues.numOfProducts}
                    onChange={(e) => setPredictorValues({ ...predictorValues, numOfProducts: Number(e.target.value) })}
                  >
                    <option value={1}>1 Produto</option>
                    <option value={2}>2 Produtos (Ideal)</option>
                    <option value={3}>3 Produtos (Crítico)</option>
                    <option value={4}>4 Produtos (Crítico)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-400 font-medium">Membro Ativo?</label>
                  <select 
                    className="w-full bg-slate-950/80 border border-slate-900 rounded-xl px-3 py-2 text-slate-300 focus:outline-none focus:border-emerald-500/50"
                    value={predictorValues.isActiveMember ? 'Yes' : 'No'}
                    onChange={(e) => setPredictorValues({ ...predictorValues, isActiveMember: e.target.value === 'Yes' })}
                  >
                    <option value="Yes">Ativo (Engajado)</option>
                    <option value="No">Inativo (Risco)</option>
                  </select>
                </div>
              </div>

              {/* Balance Slider */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <label className="text-slate-400 font-medium">Saldo em Conta</label>
                  <span className="font-mono text-white font-bold">€{predictorValues.balance.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="250000" 
                  step="5000"
                  className="w-full h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  value={predictorValues.balance}
                  onChange={(e) => setPredictorValues({ ...predictorValues, balance: Number(e.target.value) })}
                />
              </div>

              {/* Tenure and Credit Card Row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-slate-400 font-medium">Anos no Banco (Tenure)</label>
                  <select 
                    className="w-full bg-slate-950/80 border border-slate-900 rounded-xl px-3 py-2 text-slate-300 focus:outline-none focus:border-emerald-500/50"
                    value={predictorValues.tenure}
                    onChange={(e) => setPredictorValues({ ...predictorValues, tenure: Number(e.target.value) })}
                  >
                    {[...Array(11).keys()].map(year => (
                      <option key={year} value={year}>{year} {year === 1 ? 'ano' : 'anos'}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5 col-span-1">
                  <label className="text-slate-400 font-medium">Tem Cartão de Crédito?</label>
                  <select 
                    className="w-full bg-slate-950/80 border border-slate-900 rounded-xl px-3 py-2 text-slate-300 focus:outline-none focus:border-emerald-500/50"
                    value={predictorValues.hasCrCard ? 'Yes' : 'No'}
                    onChange={(e) => setPredictorValues({ ...predictorValues, hasCrCard: e.target.value === 'Yes' })}
                  >
                    <option value="Yes">Sim</option>
                    <option value="No">Não</option>
                  </select>
                </div>
              </div>

            </div>

            {/* Feature Impact Analysis Section */}
            <div className="space-y-3 pt-2 border-t border-slate-900">
              <div className="flex items-center gap-1.5 text-xs text-white font-bold">
                <AlertTriangle className="h-4 w-4 text-amber-500 animate-pulse" /> Principais Agravantes de Churn
              </div>
              <div className="space-y-2">
                
                {/* Dynamic warning items based on values */}
                {predictorValues.geography === 'Germany' && (
                  <div className="flex items-start gap-2 bg-red-500/5 border border-red-500/10 rounded-xl p-2.5 text-[11px] leading-relaxed">
                    <span className="text-red-400 font-semibold font-mono shrink-0">+12.2%</span>
                    <span className="text-slate-300">Residência na Alemanha representa o principal fator de churn geopolítico do banco.</span>
                  </div>
                )}

                {predictorValues.age >= 45 && (
                  <div className="flex items-start gap-2 bg-red-500/5 border border-red-500/10 rounded-xl p-2.5 text-[11px] leading-relaxed">
                    <span className="text-red-400 font-semibold font-mono shrink-0">+11.1%</span>
                    <span className="text-slate-300">A faixa etária acima de 45 anos é altamente vulnerável a novas abordagens comerciais.</span>
                  </div>
                )}

                {predictorValues.numOfProducts >= 3 && (
                  <div className="flex items-start gap-2 bg-red-500/5 border border-red-500/10 rounded-xl p-2.5 text-[11px] leading-relaxed">
                    <span className="text-red-400 font-semibold font-mono shrink-0">+7.5%</span>
                    <span className="text-slate-300">Cliente com {predictorValues.numOfProducts} produtos possui alto índice de fricção e sobreposição de contas.</span>
                  </div>
                )}

                {!predictorValues.isActiveMember && (
                  <div className="flex items-start gap-2 bg-amber-500/5 border border-amber-500/10 rounded-xl p-2.5 text-[11px] leading-relaxed">
                    <span className="text-amber-400 font-semibold font-mono shrink-0">+6.2%</span>
                    <span className="text-slate-300">Falta de engajamento operacional (membro inativo) reduz os laços transacionais do cliente.</span>
                  </div>
                )}

                {/* If none of the critical risk flags are present, show reassuring message */}
                {predictorValues.geography !== 'Germany' && predictorValues.age < 45 && predictorValues.numOfProducts < 3 && predictorValues.isActiveMember && (
                  <div className="flex items-start gap-2 bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-2.5 text-[11px] leading-relaxed">
                    <span className="text-emerald-400 font-semibold shrink-0">Seguro</span>
                    <span className="text-slate-300">O perfil do cliente é estável, com baixas correlações históricas de cancelamento de conta.</span>
                  </div>
                )}

              </div>
            </div>

          </div>

          {/* AI Retention Plan Box (Triggered by Gemini) */}
          <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <Sparkles className="h-4.5 w-4.5 text-emerald-400" /> Aconselhamento de Retenção IA
              </h3>
            </div>
            
            <p className="text-xs text-slate-400 leading-normal">
              Utilize inteligência artificial avançada para criar uma estratégia promocional personalizada e uma mensagem persuasiva com base no perfil de risco atual do cliente.
            </p>

            {/* CTA Generate Button */}
            {!aiRecommendation && !isGeneratingAi && (
              <button
                onClick={handleGenerateRetentionPlan}
                className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/5 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Sparkles className="h-4 w-4" /> Gerar Plano de Retenção com Gemini 3.5
              </button>
            )}

            {/* Generating State */}
            {isGeneratingAi && (
              <div className="bg-slate-950/80 border border-slate-900 rounded-2xl p-6 flex flex-col items-center justify-center space-y-4 min-h-[150px]">
                <RefreshCw className="h-6 w-6 text-emerald-400 animate-spin" />
                <div className="text-center space-y-1">
                  <p className="text-xs font-semibold text-white">Analisando fatores de churn...</p>
                  <p className="text-[10px] text-slate-500">O Gemini está gerando propostas financeiras sob medida para {selectedCustomer.surname}</p>
                </div>
              </div>
            )}

            {/* Error Message */}
            {aiError && (
              <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-4 text-xs space-y-2">
                <div className="flex items-center gap-1.5 text-red-400 font-bold">
                  <AlertTriangle className="h-4 w-4" /> Falha no Aconselhamento IA
                </div>
                <p className="text-slate-300 leading-relaxed text-[11px]">{aiError}</p>
                <p className="text-[10px] text-slate-500 leading-tight">Nota: Certifique-se de configurar a variável <code className="bg-slate-950 px-1 py-0.5 rounded text-red-300 font-mono text-[9px]">GEMINI_API_KEY</code> no painel Configurações &gt; Secrets.</p>
              </div>
            )}

            {/* Output AI Recommendations Box */}
            {aiRecommendation && (
              <div className="space-y-4 animate-fade-in">
                <div className="bg-slate-950/95 border border-slate-900 rounded-2xl p-4 space-y-3 shadow-inner relative max-h-[400px] overflow-y-auto custom-scrollbar">
                  
                  {/* Decorative AI indicator */}
                  <div className="flex items-center justify-between text-[9px] font-mono text-slate-500 border-b border-slate-900 pb-2">
                    <span>Estratégia Recomendada por IA</span>
                    <span>Modelo: Gemini-3.5-Flash</span>
                  </div>

                  <div className="prose prose-invert prose-xs text-slate-300 leading-relaxed">
                    {renderMarkdown(aiRecommendation)}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={copyToClipboard}
                    className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-400" /> Copiado!
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5 text-slate-400" /> Copiar Mensagem
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => { setAiRecommendation(''); setAiError(''); }}
                    className="px-3.5 bg-slate-950 hover:bg-slate-900 border border-slate-900 text-slate-400 hover:text-white rounded-xl transition-all flex items-center justify-center cursor-pointer"
                    title="Limpar recomendação"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}

          </div>

        </div>

      </div>

      </main>

      {/* Footer Info */}
      <footer className="border-t border-slate-900 py-6 mt-16 text-center text-xs text-slate-500 font-mono">
        <p className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-2">
          <span>ChurnGuard Portal &copy; 2026. Todos os direitos reservados.</span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block"></span> Servidor Conectado • Porta 3000 Ingress
          </span>
        </p>
      </footer>

    </div>
  );
}
