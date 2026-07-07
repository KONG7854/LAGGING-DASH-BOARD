import React, { useState, useMemo, useEffect } from "react";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import {
  Database,
  LayoutDashboard,
  LineChart as LineChartIcon,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Calendar,
  Settings2,
  ChevronRight,
  Info,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  ClipboardPaste,
  X,
  Table as TableIcon,
  Trash2,
  Percent,
  DollarSign,
  ShieldCheck,
  ShieldAlert,
  Upload,
  Share2,
  RotateCcw,
  Save,
  Check,
} from "lucide-react";
import { motion } from "motion/react";
import { format, addMonths, subMonths, parseISO, eachMonthOfInterval, differenceInMonths } from "date-fns";
import { INITIAL_METAL_PRICES, PRECURSOR_PRODUCTS } from "./constants";
import { MetalPrice, PrecursorProduct } from "./types";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [metalPrices, setMetalPrices] = useState<MetalPrice[]>(() => {
    const saved = localStorage.getItem("metalPrices");
    return saved ? JSON.parse(saved) : INITIAL_METAL_PRICES;
  });
  const [products, setProducts] = useState<PrecursorProduct[]>(() => {
    const saved = localStorage.getItem("products");
    return saved ? JSON.parse(saved) : PRECURSOR_PRODUCTS;
  });
  const [selectedProductId, setSelectedProductId] = useState<string>(() => {
    return localStorage.getItem("selectedProductId") || PRECURSOR_PRODUCTS[0].id;
  });
  const [currentMonth, setCurrentMonth] = useState(() => {
    return localStorage.getItem("currentMonth") || "2026-04";
  });
  const [trendViewMode, setTrendViewMode] = useState<"chart" | "table">("chart");
  const [trendSelectedProductId, setTrendSelectedProductId] = useState<string>("all");
  const [analysisTrendSelectedProductId, setAnalysisTrendSelectedProductId] = useState<string>("all");

  const [activeTab, setActiveTab] = useState<"analysis" | "reference" | "trend" | "config">("analysis");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{ show: boolean; message: string; type: 'alert' | 'confirm'; onConfirm?: () => void }>({
    show: false,
    message: '',
    type: 'alert'
  });

  const showAlert = (message: string) => setAlertConfig({ show: true, message, type: 'alert' });
  const showConfirm = (message: string, onConfirm: () => void) => setAlertConfig({ show: true, message, type: 'confirm', onConfirm });
  
  // Confidential Data State (Initial values from constants)
  const [confidentialData, setConfidentialData] = useState(() => {
    const saved = localStorage.getItem('confidential_data');
    if (saved) return JSON.parse(saved);
    return {
      processingCost: 5.5, // 가공비 ($/kg)
      interestRate: 4.5,   // 금융비용 연이율 (%)
      storageFee: 0.15     // 보관료 ($/kg/month)
    };
  });

  const saveConfidentialData = (newData: typeof confidentialData) => {
    setConfidentialData(newData);
    localStorage.setItem('confidential_data', JSON.stringify(newData));
    setIsSettingsOpen(false);
    window.location.reload(); // Refresh to apply to all calculations
  };

  const createRestorePoint = () => {
    const snapshot = {
      metalPrices,
      products,
      confidentialData,
      timestamp: new Date().toLocaleString()
    };
    localStorage.setItem('precursor_restore_point', JSON.stringify(snapshot));
    showAlert(`현재 상태가 복원 지점으로 저장되었습니다. (${snapshot.timestamp})`);
  };

  const restoreFromPoint = () => {
    const saved = localStorage.getItem('precursor_restore_point');
    if (!saved) {
      showAlert("저장된 복원 지점이 없습니다.");
      return;
    }
    
    showConfirm("저장된 복원 지점으로 되돌리시겠습니까? 현재 데이터는 덮어씌워집니다.", () => {
      const snapshot = JSON.parse(saved);
      setMetalPrices(snapshot.metalPrices);
      setProducts(snapshot.products);
      setConfidentialData(snapshot.confidentialData);
      
      localStorage.setItem('metalPrices', JSON.stringify(snapshot.metalPrices));
      localStorage.setItem('products', JSON.stringify(snapshot.products));
      localStorage.setItem('confidential_data', JSON.stringify(snapshot.confidentialData));
      
      showAlert("복원이 완료되었습니다.");
      setTimeout(() => window.location.reload(), 1000);
    });
  };

  const resetToFactoryDefaults = () => {
    showConfirm("모든 데이터를 삭제하고 초기 원본 상태로 되돌리시겠습니까? 이 작업은 되돌릴 수 없습니다.", () => {
      localStorage.removeItem('metalPrices');
      localStorage.removeItem('products');
      localStorage.removeItem('confidential_data');
      localStorage.removeItem('precursor_restore_point');
      localStorage.removeItem('simInterestRate');
      localStorage.removeItem('simStorageFee');
      
      showAlert("시스템이 초기화되었습니다. 페이지를 새로고침합니다.");
      setTimeout(() => window.location.reload(), 1500);
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const exportDataPackage = () => {
    const data = {
      metalPrices,
      products,
      confidentialData,
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Precursor_Data_Package_${format(new Date(), 'yyyyMMdd')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importDataPackage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.metalPrices && data.products) {
          showConfirm('데이터를 불러오시겠습니까? 현재 저장된 모든 데이터가 덮어씌워집니다.', () => {
            setMetalPrices(data.metalPrices);
            setProducts(data.products);
            if (data.confidentialData) setConfidentialData(data.confidentialData);
            
            localStorage.setItem('metalPrices', JSON.stringify(data.metalPrices));
            localStorage.setItem('products', JSON.stringify(data.products));
            if (data.confidentialData) localStorage.setItem('confidential_data', JSON.stringify(data.confidentialData));
            
            showAlert('데이터 동기화가 완료되었습니다.');
            setTimeout(() => window.location.reload(), 1500);
          });
        }
      } catch (err) {
        showAlert('올바르지 않은 데이터 파일입니다.');
      }
    };
    reader.readAsText(file);
  };

  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteMode, setPasteMode] = useState<"metal" | "product">("metal");
  const [pasteText, setPasteText] = useState("");

  // Simulation State
  const [simProductId, setSimProductId] = useState(selectedProductId);
  const [simQuantity, setSimQuantity] = useState(200);
  const [simMonthA, setSimMonthA] = useState("2026-01");
  const [simMonthB, setSimMonthB] = useState("2026-04");
  const [simInterestRate, setSimInterestRate] = useState(() => {
    const saved = localStorage.getItem("simInterestRate");
    return saved ? Number(saved) : 4.5;
  });
  const [simStorageFee, setSimStorageFee] = useState(() => {
    const saved = localStorage.getItem("simStorageFee");
    return saved ? Number(saved) : 5;
  });

  useEffect(() => {
    setSimProductId(selectedProductId);
  }, [selectedProductId]);

  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [showMetalSaveSuccess, setShowMetalSaveSuccess] = useState(false);
  const [showFinanceSaveSuccess, setShowFinanceSaveSuccess] = useState(false);

  const handleSaveMetalPrices = () => {
    localStorage.setItem("metalPrices", JSON.stringify(metalPrices));
    setShowMetalSaveSuccess(true);
    setTimeout(() => setShowMetalSaveSuccess(false), 3000);
  };

  const handleSaveFinanceSettings = () => {
    localStorage.setItem("simInterestRate", simInterestRate.toString());
    localStorage.setItem("simStorageFee", simStorageFee.toString());
    setShowFinanceSaveSuccess(true);
    setTimeout(() => setShowFinanceSaveSuccess(false), 3000);
  };

  const handleSaveProducts = () => {
    localStorage.setItem("products", JSON.stringify(products));
    setShowSaveSuccess(true);
    setTimeout(() => setShowSaveSuccess(false), 3000);
  };

  useEffect(() => {
    localStorage.setItem("selectedProductId", selectedProductId);
  }, [selectedProductId]);

  useEffect(() => {
    localStorage.setItem("currentMonth", currentMonth);
  }, [currentMonth]);

  const selectedProduct = useMemo(() => 
    products.find(p => p.id === selectedProductId) || products[0],
    [products, selectedProductId]
  );

  // Helper to get 3-month average
  const get3MonthAvg = (targetMonth: string) => {
    const targetDate = parseISO(targetMonth + "-01");
    const monthsToAvg = [
      format(subMonths(targetDate, 1), "yyyy-MM"),
      format(subMonths(targetDate, 2), "yyyy-MM"),
      format(subMonths(targetDate, 3), "yyyy-MM"),
    ];

    const relevantPrices = metalPrices.filter((p) => monthsToAvg.includes(p.date));
    if (relevantPrices.length === 0) return null;

    return {
      ni: relevantPrices.reduce((sum, p) => sum + Number(p.ni), 0) / relevantPrices.length,
      co: relevantPrices.reduce((sum, p) => sum + Number(p.co), 0) / relevantPrices.length,
      mn: relevantPrices.reduce((sum, p) => sum + Number(p.mn), 0) / relevantPrices.length,
    };
  };

  const calculatePurchasePrice = (month: string, product: PrecursorProduct) => {
    const avgs = get3MonthAvg(month);
    if (!avgs) return null;

    const materialCost =
      (avgs.ni * product.niRatio +
      avgs.co * product.coRatio +
      avgs.mn * product.mnRatio);

    return {
      materialCost,
      purchasePrice: materialCost + product.processingFee,
      avg: avgs
    };
  };

  const analysisData = useMemo(() => {
    const baseDate = parseISO(currentMonth + "-01");
    const months = [];
    for (let i = -3; i <= 3; i++) {
      months.push(format(addMonths(baseDate, i), "yyyy-MM"));
    }

    return months.map((m) => {
      const calc = calculatePurchasePrice(m, selectedProduct);
      return {
        month: m,
        ...calc,
        label: m === currentMonth ? "Current" : m < currentMonth ? "Previous" : "Next",
      };
    });
  }, [metalPrices, selectedProduct, currentMonth]);

  const trendProducts = useMemo(() => {
    const merged: PrecursorProduct[] = [];
    let ncMerged: PrecursorProduct | null = null;
    
    products.forEach(p => {
      if (p.id === "nc021" || p.id === "nc022") {
        if (!ncMerged) {
          ncMerged = { ...p, name: "NC021/022", id: "nc021_022" };
          merged.push(ncMerged);
        }
      } else {
        merged.push(p);
      }
    });
    return merged;
  }, [products]);

  const productMaterialCostTrend = useMemo(() => {
    return metalPrices.map(priceData => {
      const row: any = { date: priceData.date };
      const avgs = get3MonthAvg(priceData.date);
      
      trendProducts.forEach(product => {
        if (avgs) {
          const materialCost = 
            avgs.ni * product.niRatio + 
            avgs.co * product.coRatio + 
            avgs.mn * product.mnRatio;
          row[product.name] = Number(materialCost.toFixed(2));
        } else {
          row[product.name] = null;
        }
      });
      
      return row;
    }).filter(row => {
      const values = Object.values(row);
      return values.some((v, idx) => idx > 0 && v !== null);
    });
  }, [metalPrices, trendProducts]);

  const currentPrice = analysisData.find((d) => d.month === currentMonth)?.purchasePrice;
  const nextPrice = analysisData.find((d) => d.month > currentMonth)?.purchasePrice;
  const effectiveCost = currentPrice ? currentPrice + (simStorageFee / 1000) + (currentPrice * simInterestRate / 100 / 12) : null;
  const prevPrice = analysisData.find((d) => d.month < currentMonth)?.purchasePrice;

  const recommendation = useMemo(() => {
    if (!currentPrice || !nextPrice || effectiveCost === null) return "데이터 부족";
    
    if (effectiveCost < nextPrice) return "당월 조기매입 유리";
    if (effectiveCost > nextPrice) return "당월 조기매입 불리";
    return "보합세";
  }, [currentPrice, nextPrice, effectiveCost]);

  const handlePriceChange = (date: string, metal: keyof Omit<MetalPrice, "date">, value: string) => {
    setMetalPrices((prev) =>
      prev.map((p) => (p.date === date ? { ...p, [metal]: value } : p))
    );
  };

  const handleProductChange = (productId: string, field: keyof PrecursorProduct, value: string | number) => {
    setProducts(prev => prev.map(p => p.id === productId ? { ...p, [field]: value } : p));
  };

  const handleDeleteProduct = (productId: string) => {
    if (products.length <= 1) {
      showAlert("최소 한 개의 품목은 유지되어야 합니다.");
      return;
    }
    showConfirm("정말 이 품목을 삭제하시겠습니까?", () => {
      setProducts(prev => prev.filter(p => p.id !== productId));
      if (selectedProductId === productId) {
        setSelectedProductId(products.find(p => p.id !== productId)?.id || "");
      }
    });
  };

  const handlePasteData = () => {
    if (!pasteText.trim()) return;

    const rows = pasteText.trim().split(/\r?\n/);
    
    if (pasteMode === "metal") {
      const newPrices: MetalPrice[] = [];
      rows.forEach(rowStr => {
        const cols = rowStr.split('\t');
        if (cols.length >= 5) {
          const year = cols[0].trim();
          const month = cols[1].trim().padStart(2, '0');
          if (/^\d{4}$/.test(year) && /^\d{1,2}$/.test(month)) {
            const date = `${year}-${month}`;
            newPrices.push({
              date,
              ni: cols[2].replace(/,/g, '').trim() || "0",
              co: cols[3].replace(/,/g, '').trim() || "0",
              mn: cols[4].replace(/,/g, '').trim() || "0",
            });
          }
        }
      });

      if (newPrices.length > 0) {
        setMetalPrices(prev => {
          const updated = [...prev];
          newPrices.forEach(newP => {
            const index = updated.findIndex(p => p.date === newP.date);
            if (index !== -1) {
              updated[index] = newP;
            } else {
              updated.push(newP);
            }
          });
          return updated.sort((a, b) => a.date.localeCompare(b.date));
        });
        showAlert(`${newPrices.length}개의 데이터가 반영되었습니다.`);
        setShowPasteModal(false);
        setPasteText("");
      } else {
        showAlert("올바른 형식의 데이터를 찾을 수 없습니다. 엑셀에서 표 영역을 복사하여 붙여넣어 주세요.");
      }
    } else {
      // Product Paste Mode
      // Expected format: Name | Ni% | Co% | Mn% | Fee
      const newProducts: PrecursorProduct[] = [];
      rows.forEach(rowStr => {
        const cols = rowStr.split('\t');
        if (cols.length >= 4) {
          const name = cols[0].trim();
          const ni = parseFloat(cols[1].replace(/%/g, '').trim()) / 100;
          const co = parseFloat(cols[2].replace(/%/g, '').trim()) / 100;
          const mn = parseFloat(cols[3].replace(/%/g, '').trim()) / 100;
          const fee = cols[4] ? parseFloat(cols[4].replace(/[^0-9.]/g, '').trim()) : 2.0;

          if (name && !isNaN(ni) && !isNaN(co) && !isNaN(mn)) {
            newProducts.push({
              id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
              name,
              niRatio: ni,
              coRatio: co,
              mnRatio: mn,
              processingFee: isNaN(fee) ? 2.0 : fee
            });
          }
        }
      });

      if (newProducts.length > 0) {
        setProducts(prev => [...prev, ...newProducts]);
        showAlert(`${newProducts.length}개의 품목이 추가되었습니다.`);
        setShowPasteModal(false);
        setPasteText("");
      } else {
        showAlert("올바른 형식의 데이터를 찾을 수 없습니다. [품목명, Ni%, Co%, Mn%, 가공비] 순서로 복사해 주세요.");
      }
    }
  };

  const forecastRangeData = useMemo(() => {
    const startDate = parseISO(currentMonth + "-01");
    const endDate = addMonths(startDate, 3);
    const startStr = format(startDate, "yyyy-MM");
    const endStr = format(endDate, "yyyy-MM");

    return metalPrices.filter((p) => p.date >= startStr && p.date <= endStr);
  }, [metalPrices, currentMonth]);

  const chartRangeData = useMemo(() => {
    const baseDate = parseISO(currentMonth + "-01");
    const startDate = subMonths(baseDate, 3);
    const endDate = addMonths(baseDate, 3);
    const startStr = format(startDate, "yyyy-MM");
    const endStr = format(endDate, "yyyy-MM");

    return metalPrices.filter((p) => p.date >= startStr && p.date <= endStr);
  }, [metalPrices, currentMonth]);

  const trendData = useMemo(() => {
    const baseDate = parseISO(currentMonth + "-01");
    if (isNaN(baseDate.getTime())) return [];
    
    const startDate = subMonths(baseDate, 3);
    const endDate = addMonths(baseDate, 3);
    
    const months = eachMonthOfInterval({
      start: startDate,
      end: endDate
    }).map(d => format(d, "yyyy-MM"));

    return months.map(month => {
      const data: any = { month };
      const avg = get3MonthAvg(month);
      trendProducts.forEach(product => {
        if (avg) {
          const purchasePrice = 
            (avg.ni * product.niRatio) + 
            (avg.co * product.coRatio) + 
            (avg.mn * product.mnRatio) + 
            product.processingFee;
          data[product.name] = Number(purchasePrice.toFixed(2));
        } else {
          data[product.name] = null;
        }
      });
      return data;
    });
  }, [metalPrices, trendProducts, currentMonth]);

  const simulationResult = useMemo(() => {
    const product = products.find(p => p.id === simProductId) || products[0];
    const priceA = calculatePurchasePrice(simMonthA, product)?.purchasePrice || 0;
    const priceB = calculatePurchasePrice(simMonthB, product)?.purchasePrice || 0;
    
    const dateA = parseISO(simMonthA + "-01");
    const dateB = parseISO(simMonthB + "-01");
    const monthsDiff = Math.abs(differenceInMonths(dateB, dateA));
    
    const isAEarlier = dateA < dateB;
    const earlyMonth = isAEarlier ? simMonthA : simMonthB;
    const lateMonth = isAEarlier ? simMonthB : simMonthA;
    const earlyPrice = isAEarlier ? priceA : priceB;
    const latePrice = isAEarlier ? priceB : priceA;

    // Calculations (Price is $/kg, so * 1000 for $/ton)
    const baseCostEarly = earlyPrice * simQuantity * 1000;
    const baseCostLate = latePrice * simQuantity * 1000;
    
    const storageCost = simStorageFee * simQuantity * monthsDiff;
    const financialCost = baseCostEarly * (simInterestRate / 100 / 12) * monthsDiff;
    
    const totalEarly = baseCostEarly + storageCost + financialCost;
    const totalLate = baseCostLate;
    
    const savings = totalLate - totalEarly;
    
    return {
      earlyMonth,
      lateMonth,
      earlyPrice,
      latePrice,
      baseCostEarly,
      baseCostLate,
      storageCost,
      financialCost,
      totalEarly,
      totalLate,
      savings,
      monthsDiff
    };
  }, [simProductId, simQuantity, simMonthA, simMonthB, simInterestRate, simStorageFee, products, metalPrices]);

  return (
    <div className="min-h-screen bg-[#E4E3E0] text-[#141414] font-sans selection:bg-[#141414] selection:text-[#E4E3E0]">
      {/* Header */}
      <header className="border-b border-[#141414] p-6 flex justify-between items-center bg-white/50 backdrop-blur-sm sticky top-0 z-10">
        <div>
          <h1 className="text-2xl font-bold tracking-tighter uppercase italic font-serif">
            전구체 매입 최적화 도구
          </h1>
          <p className="text-xs opacity-60 font-mono mt-1">
            메탈 시세 래깅 분석 및 구매 전략 시뮬레이션
          </p>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex bg-[#141414]/5 p-1 rounded-sm border border-[#141414]/10">
            <button 
              onClick={() => setActiveTab("analysis")}
              className={cn(
                "px-4 py-1.5 text-[10px] uppercase font-bold tracking-widest transition-all",
                activeTab === "analysis" ? "bg-[#141414] text-white shadow-lg" : "opacity-50 hover:opacity-100"
              )}
            >
              분석 대시보드
            </button>
            <button 
              onClick={() => setActiveTab("trend")}
              className={cn(
                "px-4 py-1.5 text-[10px] uppercase font-bold tracking-widest transition-all",
                activeTab === "trend" ? "bg-[#141414] text-white shadow-lg" : "opacity-50 hover:opacity-100"
              )}
            >
              단가 변동 추이
            </button>
            <button 
              onClick={() => setActiveTab("reference")}
              className={cn(
                "px-4 py-1.5 text-[10px] uppercase font-bold tracking-widest transition-all",
                activeTab === "reference" ? "bg-[#141414] text-white shadow-lg" : "opacity-50 hover:opacity-100"
              )}
            >
              메탈 시세 참조표
            </button>
            <button 
              onClick={() => setActiveTab("config")}
              className={cn(
                "px-4 py-1.5 text-[10px] uppercase font-bold tracking-widest transition-all",
                activeTab === "config" ? "bg-[#141414] text-white shadow-lg" : "opacity-50 hover:opacity-100"
              )}
            >
              품목별 설정
            </button>
          </div>
          <div className="flex items-center gap-6 no-print">
            <div className="flex items-center gap-2 bg-[#141414]/5 p-1 rounded-sm border border-[#141414]/10">
              <button 
                onClick={exportDataPackage}
                title="데이터 내보내기 (팀 공유용)"
                className="p-1.5 hover:bg-white rounded transition-colors opacity-60 hover:opacity-100"
              >
                <Share2 size={14} />
              </button>
              <label className="p-1.5 hover:bg-white rounded transition-colors opacity-60 hover:opacity-100 cursor-pointer">
                <Upload size={14} />
                <input type="file" accept=".json" onChange={importDataPackage} className="hidden" />
              </label>
            </div>
            
            <div className="h-4 w-px bg-[#141414]/10"></div>

            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest opacity-60 hover:opacity-100 transition-opacity"
            >
              <ShieldCheck size={14} />
              Security Settings
            </button>
            <div className="h-4 w-px bg-[#141414]/10"></div>
            <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase font-mono opacity-50">분석 대상 월</span>
            <select
              value={currentMonth}
              onChange={(e) => setCurrentMonth(e.target.value)}
              className="bg-transparent border-none font-bold text-lg focus:ring-0 cursor-pointer text-right p-0"
            >
              {metalPrices.slice(3).map((p) => (
                <option key={p.date} value={p.date}>
                  {format(parseISO(p.date + "-01"), "yyyy년 MM월")}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </header>

      <main className="p-6 max-w-[1600px] mx-auto">
        {activeTab === "analysis" ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Analysis & Recommendation */}
            <div className="lg:col-span-4 space-y-6">
              {/* Recommendation Card */}
              <div className="bg-[#141414] text-[#E4E3E0] p-8 rounded-sm shadow-2xl relative overflow-hidden group">
                <div className="relative z-10">
                  <span className="text-[10px] uppercase font-mono opacity-50 tracking-widest">구매 전략 추천</span>
                  <h2 className="text-4xl font-black mt-2 tracking-tighter leading-none">
                    {recommendation}
                  </h2>
                  <p className="mt-4 text-sm opacity-80 leading-relaxed">
                    3개월 래깅 메탈 시세 및 현재 예측가, <span className="font-bold">금융/보관비용</span>을 종합하여 산출되었습니다.
                  </p>
                  
                  <div className="mt-4 pt-4 border-t border-white/10 flex flex-wrap gap-x-4 gap-y-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] uppercase font-mono opacity-40">Ni</span>
                      <span className="text-xs font-bold font-mono">{(selectedProduct.niRatio * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] uppercase font-mono opacity-40">Co</span>
                      <span className="text-xs font-bold font-mono">{(selectedProduct.coRatio * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] uppercase font-mono opacity-40">Mn</span>
                      <span className="text-xs font-bold font-mono">{(selectedProduct.mnRatio * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] uppercase font-mono opacity-40">Fee</span>
                      <span className="text-xs font-bold font-mono">${selectedProduct.processingFee.toFixed(1)}</span>
                    </div>
                  </div>
                  
                  <div className="mt-8 grid grid-cols-2 gap-4">
                    <div className="border-l border-white/20 pl-4">
                      <span className="text-[10px] uppercase font-mono opacity-50">당월 매입 단가</span>
                      <div className="text-xl font-bold font-mono">
                        ${currentPrice?.toFixed(2)} <span className="text-xs opacity-50">/kg</span>
                      </div>
                      <div className="mt-1 text-[9px] font-mono opacity-40 uppercase tracking-tighter">
                        실질 원가: ${effectiveCost?.toFixed(2)}
                      </div>
                    </div>
                    <div className="border-l border-white/20 pl-4">
                      <span className="text-[10px] uppercase font-mono opacity-50">다음 달 예상 단가</span>
                      <div className="text-xl font-bold font-mono flex items-center gap-2">
                        ${nextPrice?.toFixed(2)}
                        {nextPrice && effectiveCost && (
                          <div className="flex items-center gap-1">
                            {nextPrice > effectiveCost ? (
                              <ArrowUpRight className="w-4 h-4 text-red-400" />
                            ) : (
                              <ArrowDownRight className="w-4 h-4 text-green-400" />
                            )}
                            <span className={cn(
                              "text-[10px] font-bold",
                              nextPrice > effectiveCost ? "text-red-400" : "text-green-400"
                            )}>
                              {Math.abs(((nextPrice - effectiveCost) / effectiveCost) * 100).toFixed(1)}%
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="absolute -right-8 -bottom-8 opacity-10 group-hover:scale-110 transition-transform duration-700">
                  <TrendingUp size={200} />
                </div>
              </div>

              {/* Product Selector */}
              <div className="bg-white p-6 border border-[#141414]/10 rounded-sm">
                <h3 className="text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Settings2 size={14} /> 제품 설정 및 함량
                </h3>
                <div className="space-y-2">
                  {products.map((product) => (
                    <button
                      key={product.id}
                      onClick={() => setSelectedProductId(product.id)}
                      className={cn(
                        "w-full text-left p-4 transition-all flex justify-between items-center group",
                        selectedProduct.id === product.id
                          ? "bg-[#141414] text-white"
                          : "hover:bg-[#141414]/5 border border-transparent hover:border-[#141414]/10"
                      )}
                    >
                      <div>
                        <div className="font-bold">{product.name}</div>
                        <div className="text-[10px] opacity-60 font-mono mt-1">
                          Ni:{Number(product.niRatio * 100).toFixed(1)}% Co:{Number(product.coRatio * 100).toFixed(1)}% Mn:{Number(product.mnRatio * 100).toFixed(1)}% | Fee:${product.processingFee.toFixed(1)}
                        </div>
                      </div>
                      <ChevronRight className={cn("w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity", selectedProduct.id === product.id && "opacity-100")} />
                    </button>
                  ))}
                </div>
              </div>

              {/* Price Comparison Table */}
              <div className="bg-white border border-[#141414]/10 rounded-sm overflow-hidden">
                <div className="p-4 border-b border-[#141414]/10 bg-[#141414]/5">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest">래깅 단가 비교 (전후 3개월)</h3>
                </div>
                <div className="divide-y divide-[#141414]/10 max-h-[400px] overflow-y-auto">
                  {analysisData.map((item) => (
                    <div key={item.month} className={cn("p-4 flex justify-between items-center", item.month === currentMonth && "bg-yellow-50")}>
                      <div>
                        <div className="text-xs font-mono opacity-50">
                          {item.label === "Current" ? "당월" : item.label === "Previous" ? "이전" : "이후"}
                        </div>
                        <div className="font-bold">{format(parseISO(item.month + "-01"), "yyyy년 MM월")}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold font-mono">
                          {item.purchasePrice ? `$${item.purchasePrice.toFixed(2)}` : "N/A"}
                        </div>
                        <div className="text-[10px] opacity-50">
                          재료비: {item.materialCost ? `$${item.materialCost.toFixed(2)}` : "N/A"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column: Charts & Inputs */}
            <div className="lg:col-span-8 space-y-6">
              {/* Metal Price Trend Chart */}
              <div className="bg-white p-8 border border-[#141414]/10 rounded-sm h-[400px]">
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                      <TrendingUp size={14} /> 메탈 시세 추이
                    </h3>
                    <p className="text-[10px] font-mono opacity-50 mt-1 italic">과거 및 예측 시장 데이터 (단위: USD/kg)</p>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartRangeData}>
                    <defs>
                      <linearGradient id="colorNi" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#141414" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#141414" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorCo" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#F27D26" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#F27D26" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorMn" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8E9299" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#8E9299" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="#14141408" />
                    <XAxis 
                      dataKey="date" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fontFamily: 'monospace', fill: '#141414', opacity: 0.5 }}
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fontFamily: 'monospace', fill: '#141414', opacity: 0.5 }}
                      width={40}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#141414', border: 'none', color: '#E4E3E0', borderRadius: '0px', padding: '12px' }}
                      itemStyle={{ fontSize: '11px', fontFamily: 'monospace', color: '#E4E3E0', padding: '2px 0' }}
                      labelStyle={{ fontSize: '10px', fontWeight: 'bold', marginBottom: '8px', opacity: 0.5 }}
                    />
                    <Legend 
                      verticalAlign="top" 
                      align="right"
                      iconType="circle" 
                      wrapperStyle={{ paddingBottom: '20px', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px' }} 
                    />
                    <ReferenceLine x={currentMonth} stroke="#141414" strokeWidth={1} label={{ position: 'top', value: '현재', fill: '#141414', fontSize: 10, fontWeight: 'bold' }} />
                    <Area type="monotone" dataKey={(d) => Number(d.ni)} name="니켈 (Ni)" stroke="#141414" strokeWidth={2} fillOpacity={1} fill="url(#colorNi)" dot={{ r: 3, fill: '#141414', strokeWidth: 0 }} activeDot={{ r: 5, strokeWidth: 0 }} />
                    <Area type="monotone" dataKey={(d) => Number(d.co)} name="코발트 (Co)" stroke="#F27D26" strokeWidth={2} fillOpacity={1} fill="url(#colorCo)" dot={{ r: 3, fill: '#F27D26', strokeWidth: 0 }} activeDot={{ r: 5, strokeWidth: 0 }} />
                    <Area type="monotone" dataKey={(d) => Number(d.mn)} name="망간 (Mn)" stroke="#8E9299" strokeWidth={2} fillOpacity={1} fill="url(#colorMn)" dot={{ r: 3, fill: '#8E9299', strokeWidth: 0 }} activeDot={{ r: 5, strokeWidth: 0 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Product Material Cost Trend Chart */}
              <div className="bg-white p-8 border border-[#141414]/10 rounded-sm min-h-[400px]">
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                      <TrendingUp size={14} /> 전구체 품목별 재료비 변동추이
                    </h3>
                    <p className="text-[10px] font-mono opacity-50 mt-1 italic">가공비 제외, 순수 메탈 재료비 (단위: USD/kg)</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <select
                      value={analysisTrendSelectedProductId}
                      onChange={(e) => setAnalysisTrendSelectedProductId(e.target.value)}
                      className="bg-[#141414]/5 border border-[#141414]/10 rounded-sm px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest outline-none focus:border-[#141414] transition-all"
                    >
                      <option value="all">전체 품목 보기</option>
                      {trendProducts.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <div className="flex bg-[#141414]/5 p-1 rounded-sm">
                      <button 
                        onClick={() => setTrendViewMode("chart")}
                        className={cn(
                          "p-1.5 rounded-sm transition-all",
                          trendViewMode === "chart" ? "bg-white shadow-sm text-[#141414]" : "text-[#141414]/40 hover:text-[#141414]"
                        )}
                      >
                        <LineChartIcon size={14} />
                      </button>
                      <button 
                        onClick={() => setTrendViewMode("table")}
                        className={cn(
                          "p-1.5 rounded-sm transition-all",
                          trendViewMode === "table" ? "bg-white shadow-sm text-[#141414]" : "text-[#141414]/40 hover:text-[#141414]"
                        )}
                      >
                        <TableIcon size={14} />
                      </button>
                    </div>
                  </div>
                </div>
                
                {trendViewMode === "chart" ? (
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={productMaterialCostTrend}>
                        <CartesianGrid stroke="#14141410" vertical={false} />
                        <XAxis 
                          dataKey="date" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 10, fontFamily: 'monospace' }}
                          dy={10}
                        />
                        <YAxis 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 10, fontFamily: 'monospace' }}
                          domain={['auto', 'auto']}
                          width={40}
                        />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#141414', border: 'none', color: '#E4E3E0', borderRadius: '0px' }}
                          itemStyle={{ fontSize: '12px', fontFamily: 'monospace', color: '#E4E3E0' }}
                        />
                        <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px' }} />
                        <ReferenceLine x={currentMonth} stroke="#141414" strokeWidth={1} label={{ position: 'top', value: '현재', fill: '#141414', fontSize: 10, fontWeight: 'bold' }} />
                        {trendProducts
                          .filter(p => analysisTrendSelectedProductId === "all" || p.id === analysisTrendSelectedProductId)
                          .map((product, idx) => {
                            const isHighlighted = selectedProductId === product.id || (product.id === "nc021_022" && (selectedProductId === "nc021" || selectedProductId === "nc022"));
                            const colorIndex = trendProducts.findIndex(tp => tp.id === product.id);
                            return (
                              <Line 
                                key={product.id}
                                type="monotone" 
                                dataKey={product.name} 
                                name={product.name} 
                                stroke={["#141414", "#F27D26", "#10B981", "#3B82F6", "#8B5CF6"][colorIndex % 5]} 
                                strokeWidth={isHighlighted || analysisTrendSelectedProductId !== "all" ? 4 : 2} 
                                dot={{ 
                                  r: isHighlighted || analysisTrendSelectedProductId !== "all" ? 4 : 3, 
                                  strokeWidth: 0, 
                                  fill: ["#141414", "#F27D26", "#10B981", "#3B82F6", "#8B5CF6"][colorIndex % 5] 
                                }}
                                opacity={analysisTrendSelectedProductId === "all" ? (isHighlighted ? 1 : 0.4) : 1}
                                activeDot={{ r: 6, strokeWidth: 0 }} 
                                connectNulls
                              />
                            );
                          })}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-[10px] font-mono">
                      <thead>
                        <tr className="border-b border-[#141414]/10 text-left">
                          <th className="py-2 pr-4 opacity-50 uppercase tracking-tighter">Month</th>
                          {trendProducts
                            .filter(p => analysisTrendSelectedProductId === "all" || p.id === analysisTrendSelectedProductId)
                            .map(p => (
                            <th key={p.id} className="py-2 px-2 opacity-50 uppercase tracking-tighter text-right">{p.name}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {productMaterialCostTrend.map((row, idx) => (
                          <tr key={idx} className="border-b border-[#141414]/5 hover:bg-[#141414]/5 transition-colors">
                            <td className="py-2 pr-4 font-bold">{row.date}</td>
                            {trendProducts
                              .filter(p => analysisTrendSelectedProductId === "all" || p.id === analysisTrendSelectedProductId)
                              .map(p => {
                              const isHighlighted = selectedProductId === p.id || (p.id === "nc021_022" && (selectedProductId === "nc021" || selectedProductId === "nc022"));
                              return (
                                <td key={p.id} className={cn(
                                  "py-2 px-2 text-right",
                                  isHighlighted ? "font-bold text-[#141414]" : "opacity-70"
                                )}>
                                  ${row[p.name]?.toFixed(2) || "-"}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Forecast Inputs */}
              <div className="bg-white border border-[#141414]/10 rounded-sm overflow-hidden">
                <div className="p-4 border-b border-[#141414]/10 flex justify-between items-center">
                  <h3 className="text-xs font-bold uppercase tracking-widest">시장 예측가 입력 (시뮬레이션)</h3>
                  <div className="flex items-center gap-2 text-[10px] font-mono opacity-50">
                    <Info size={12} /> 수치를 조정하여 구매 전략 변화를 확인하세요
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#141414]/5 text-[10px] uppercase font-mono tracking-tighter">
                        <th className="p-4 border-b border-[#141414]/10">해당 월</th>
                        <th className="p-4 border-b border-[#141414]/10">니켈 (Ni, $/kg)</th>
                        <th className="p-4 border-b border-[#141414]/10">코발트 (Co, $/kg)</th>
                        <th className="p-4 border-b border-[#141414]/10">망간 (Mn, $/kg)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#141414]/10">
                      {forecastRangeData.map((price) => (
                        <tr key={price.date} className="hover:bg-[#141414]/5 transition-colors group">
                          <td className="p-4 font-bold font-mono text-sm">{price.date}</td>
                          <td className="p-4">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={price.ni}
                              onChange={(e) => handlePriceChange(price.date, "ni", e.target.value)}
                              className="w-full bg-transparent border-b border-transparent group-hover:border-[#141414]/20 focus:border-[#141414] focus:ring-0 p-1 font-mono text-sm transition-all"
                            />
                          </td>
                          <td className="p-4">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={price.co}
                              onChange={(e) => handlePriceChange(price.date, "co", e.target.value)}
                              className="w-full bg-transparent border-b border-transparent group-hover:border-[#141414]/20 focus:border-[#141414] focus:ring-0 p-1 font-mono text-sm transition-all"
                            />
                          </td>
                          <td className="p-4">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={price.mn}
                              onChange={(e) => handlePriceChange(price.date, "mn", e.target.value)}
                              className="w-full bg-transparent border-b border-transparent group-hover:border-[#141414]/20 focus:border-[#141414] focus:ring-0 p-1 font-mono text-sm transition-all"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Explanation Footer */}
              <div className="bg-[#141414]/5 p-6 rounded-sm border border-[#141414]/10 flex gap-6">
                <div className="bg-[#141414] text-white p-3 rounded-full h-fit">
                  <AlertCircle size={24} />
                </div>
                <div>
                  <h4 className="font-bold uppercase text-xs tracking-widest mb-2">단가 산출 방식 안내</h4>
                  <p className="text-sm opacity-70 leading-relaxed">
                    <span className="font-bold">M월</span>의 매입 단가는 다음과 같이 계산됩니다:
                    <br />
                    <code className="bg-white/50 px-2 py-1 rounded text-xs font-mono block mt-2 border border-[#141414]/10">
                      단가(M) = [ Avg(Ni_{"M-1,M-2,M-3"}) * Ni% + Avg(Co_{"M-1,M-2,M-3"}) * Co% + Avg(Mn_{"M-1,M-2,M-3"}) * Mn% ] + 가공비
                    </code>
                    <br />
                    이 방식은 <span className="italic">래깅(Lagging) 효과</span>를 발생시켜, 현재 시장의 급등락이 실제 매입 단가에 반영되기까지 1~3개월의 시차가 발생합니다.
                  </p>
                </div>
              </div>

              {/* Purchase Strategy Simulator */}
              <div className="bg-white border border-[#141414] rounded-sm overflow-hidden shadow-xl">
                <div className="p-6 border-b border-[#141414] bg-[#141414] text-white flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-bold uppercase tracking-tighter italic font-serif flex items-center gap-2">
                      <LayoutDashboard size={20} /> 매입 시점별 손익 시뮬레이터
                    </h3>
                    <p className="text-[10px] font-mono opacity-60">금융비용 및 보관료를 포함한 실질 매입 유불리 분석</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-mono opacity-50 block">Total Savings</span>
                    <span className={cn(
                      "text-2xl font-black font-mono",
                      simulationResult.savings > 0 ? "text-green-400" : "text-red-400"
                    )}>
                      ${Math.abs(simulationResult.savings).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>

                <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-8">
                  {/* Inputs */}
                  <div className="space-y-4 border-r border-[#141414]/10 pr-6">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest opacity-50 mb-4">시뮬레이션 설정</h4>
                    
                    <div className="space-y-3">
                      <div>
                        <label className="text-[10px] font-mono block mb-1">대상 품목</label>
                        <select 
                          value={simProductId}
                          onChange={(e) => setSimProductId(e.target.value)}
                          className="w-full bg-[#141414]/5 border border-[#141414]/10 p-2 text-sm font-bold focus:ring-0 outline-none"
                        >
                          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </div>
                      
                      <div>
                        <label className="text-[10px] font-mono block mb-1">매입 수량 (톤)</label>
                        <input 
                          type="number"
                          value={simQuantity}
                          onChange={(e) => setSimQuantity(Number(e.target.value))}
                          className="w-full bg-[#141414]/5 border border-[#141414]/10 p-2 text-sm font-bold font-mono focus:ring-0 outline-none"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-mono block mb-1">매입 시점 A</label>
                          <select 
                            value={simMonthA}
                            onChange={(e) => setSimMonthA(e.target.value)}
                            className="w-full bg-[#141414]/5 border border-[#141414]/10 p-2 text-xs font-bold focus:ring-0 outline-none"
                          >
                            {metalPrices.slice(3).map(p => <option key={p.date} value={p.date}>{p.date}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-mono block mb-1">매입 시점 B</label>
                          <select 
                            value={simMonthB}
                            onChange={(e) => setSimMonthB(e.target.value)}
                            className="w-full bg-[#141414]/5 border border-[#141414]/10 p-2 text-xs font-bold focus:ring-0 outline-none"
                          >
                            {metalPrices.slice(3).map(p => <option key={p.date} value={p.date}>{p.date}</option>)}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-2">
                        <div>
                          <label className="text-[10px] font-mono block mb-1">연 이자율 (%)</label>
                          <input 
                            type="number"
                            step="0.1"
                            value={simInterestRate}
                            onChange={(e) => setSimInterestRate(Number(e.target.value))}
                            className="w-full bg-[#141414]/5 border border-[#141414]/10 p-2 text-sm font-bold font-mono focus:ring-0 outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-mono block mb-1">월 보관료 ($/톤)</label>
                          <input 
                            type="number"
                            value={simStorageFee}
                            onChange={(e) => setSimStorageFee(Number(e.target.value))}
                            className="w-full bg-[#141414]/5 border border-[#141414]/10 p-2 text-sm font-bold font-mono focus:ring-0 outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Comparison Details */}
                  <div className="md:col-span-2 space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                      <div className="p-4 bg-[#141414]/5 border border-[#141414]/10 rounded-sm">
                        <div className="flex justify-between items-center mb-4">
                          <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 bg-[#141414] text-white">Scenario A (Early)</span>
                          <span className="text-xs font-mono font-bold">{simulationResult.earlyMonth}</span>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs">
                            <span className="opacity-50">매입가 (${simulationResult.earlyPrice.toFixed(2)}/kg)</span>
                            <span className="font-mono">${simulationResult.baseCostEarly.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between text-xs text-red-500">
                            <span className="opacity-70">금융비용 ({simulationResult.monthsDiff}개월)</span>
                            <span className="font-mono">+${simulationResult.financialCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                          </div>
                          <div className="flex justify-between text-xs text-red-500">
                            <span className="opacity-70">보관비용 ({simulationResult.monthsDiff}개월)</span>
                            <span className="font-mono">+${simulationResult.storageCost.toLocaleString()}</span>
                          </div>
                          <div className="pt-2 border-t border-[#141414]/10 flex justify-between font-bold">
                            <span>Total</span>
                            <span className="font-mono">${simulationResult.totalEarly.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                          </div>
                        </div>
                      </div>

                      <div className="p-4 bg-[#141414]/5 border border-[#141414]/10 rounded-sm">
                        <div className="flex justify-between items-center mb-4">
                          <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 border border-[#141414]">Scenario B (Late)</span>
                          <span className="text-xs font-mono font-bold">{simulationResult.lateMonth}</span>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs">
                            <span className="opacity-50">매입가 (${simulationResult.latePrice.toFixed(2)}/kg)</span>
                            <span className="font-mono">${simulationResult.baseCostLate.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between text-xs opacity-30">
                            <span>금융비용</span>
                            <span className="font-mono">$0</span>
                          </div>
                          <div className="flex justify-between text-xs opacity-30">
                            <span>보관비용</span>
                            <span className="font-mono">$0</span>
                          </div>
                          <div className="pt-2 border-t border-[#141414]/10 flex justify-between font-bold">
                            <span>Total</span>
                            <span className="font-mono">${simulationResult.totalLate.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 border border-[#141414]/10 rounded-sm overflow-hidden">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-[#141414] text-white">
                            <th className="py-2 px-4 text-[10px] uppercase tracking-widest font-bold border-r border-white/10">시뮬레이션 분석 항목</th>
                            <th className="py-2 px-4 text-[10px] uppercase tracking-widest font-bold">분석 결과</th>
                          </tr>
                        </thead>
                        <tbody className="text-sm font-mono">
                          <tr className="border-b border-[#141414]/10">
                            <td className="py-3 px-4 font-bold bg-[#141414]/5 border-r border-[#141414]/10 w-1/3 text-[11px] uppercase">의사결정 권고</td>
                            <td className={cn(
                              "py-3 px-4 font-bold",
                              simulationResult.savings > 0 ? "text-green-600" : "text-red-600"
                            )}>
                              {simulationResult.savings > 0 
                                ? `${simulationResult.earlyMonth} 조기 매입 유리` 
                                : `${simulationResult.lateMonth} 매입 유리`}
                            </td>
                          </tr>
                          <tr className="border-b border-[#141414]/10">
                            <td className="py-3 px-4 font-bold bg-[#141414]/5 border-r border-[#141414]/10 text-[11px] uppercase">손익 유리 금액</td>
                            <td className="py-3 px-4 font-bold">
                              {simulationResult.savings > 0 ? "+" : ""}{simulationResult.savings.toLocaleString(undefined, { maximumFractionDigits: 0 })} USD
                            </td>
                          </tr>
                          <tr>
                            <td className="py-3 px-4 font-bold bg-[#141414]/5 border-r border-[#141414]/10 text-[11px] uppercase">수익률 개선 (%)</td>
                            <td className="py-3 px-4 font-bold">
                              {((simulationResult.savings / simulationResult.totalLate) * 100).toFixed(2)}%
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === "trend" ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white border border-[#141414]/10 rounded-sm p-8">
                <div className="flex justify-between items-center mb-8">
                  <div>
                    <h2 className="text-xl font-bold tracking-tighter uppercase italic font-serif">전구체별 매입 단가 변동 추이</h2>
                    <p className="text-xs opacity-60 font-mono mt-1">당월 기준 -3개월 ~ +3개월 예측 단가 비교</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <select
                      value={trendSelectedProductId}
                      onChange={(e) => setTrendSelectedProductId(e.target.value)}
                      className="bg-[#141414]/5 border border-[#141414]/10 rounded-sm px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest outline-none focus:border-[#141414] transition-all"
                    >
                      <option value="all">전체 품목 보기</option>
                      {trendProducts.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <div className="bg-[#141414] text-white px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                      <TrendingUp size={12} />
                      Trend Analysis
                    </div>
                  </div>
                </div>
                
                <div className="h-[400px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData}>
                      <CartesianGrid stroke="#141414" strokeOpacity={0.05} vertical={false} />
                      <XAxis 
                        dataKey="month" 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fontFamily: 'monospace', fill: '#141414', opacity: 0.5 }}
                        dy={10}
                      />
                      <YAxis 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fontFamily: 'monospace', fill: '#141414', opacity: 0.5 }}
                        domain={['auto', 'auto']}
                        width={40}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#141414', 
                          border: 'none', 
                          borderRadius: '0px',
                          color: '#E4E3E0',
                          fontSize: '11px',
                          fontFamily: 'monospace',
                          padding: '12px'
                        }}
                        itemStyle={{ color: '#E4E3E0', padding: '2px 0' }}
                        labelStyle={{ fontSize: '10px', fontWeight: 'bold', marginBottom: '8px', opacity: 0.5 }}
                      />
                      <Legend 
                        verticalAlign="top" 
                        align="right"
                        iconType="circle" 
                        wrapperStyle={{ paddingBottom: '20px', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px' }} 
                      />
                      <ReferenceLine x={currentMonth} stroke="#141414" strokeWidth={1} label={{ position: 'top', value: '현재', fill: '#141414', fontSize: 10, fontWeight: 'bold' }} />
                      {trendProducts
                        .filter(p => trendSelectedProductId === "all" || p.id === trendSelectedProductId)
                        .map((product, index) => {
                          const isHighlighted = selectedProductId === product.id || (product.id === "nc021_022" && (selectedProductId === "nc021" || selectedProductId === "nc022"));
                          const colorIndex = trendProducts.findIndex(tp => tp.id === product.id);
                          return (
                            <Line 
                              key={product.id}
                              type="monotone" 
                              dataKey={product.name} 
                              stroke={['#141414', '#F27D26', '#10B981', '#3B82F6', '#8B5CF6'][colorIndex % 5]} 
                              strokeWidth={isHighlighted || trendSelectedProductId !== "all" ? 4 : 2}
                              dot={{ 
                                r: isHighlighted || trendSelectedProductId !== "all" ? 4 : 3, 
                                strokeWidth: 0, 
                                fill: ['#141414', '#F27D26', '#10B981', '#3B82F6', '#8B5CF6'][colorIndex % 5] 
                              }}
                              activeDot={{ r: 6, strokeWidth: 0 }}
                              connectNulls
                              opacity={trendSelectedProductId === "all" ? (isHighlighted ? 1 : 0.4) : 1}
                            />
                          );
                        })}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-[#141414] text-[#E4E3E0] p-8 rounded-sm flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-widest mb-6 opacity-60">
                    시장 변동 요약 ({format(parseISO(currentMonth + "-01"), "M월")} 대비 {format(addMonths(parseISO(currentMonth + "-01"), 1), "M월")})
                  </h3>
                  <div className="space-y-8">
                    {trendProducts
                      .filter(p => trendSelectedProductId === "all" || p.id === trendSelectedProductId)
                      .map((product, index) => {
                      const currentMonthData = trendData.find(d => d.month === currentMonth);
                      const nextMonthDate = format(addMonths(parseISO(currentMonth + "-01"), 1), "yyyy-MM");
                      const nextMonthData = trendData.find(d => d.month === nextMonthDate);
                      
                      const startPrice = currentMonthData ? (currentMonthData[product.name] || 0) : 0;
                      const endPrice = nextMonthData ? (nextMonthData[product.name] || startPrice) : startPrice;
                      const diff = endPrice - startPrice;
                      const percent = startPrice !== 0 ? (diff / startPrice) * 100 : 0;
                      
                      return (
                        <div key={product.id} className="group">
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-xs font-bold uppercase tracking-tighter">{product.name}</span>
                            <div className="flex flex-col items-end gap-1">
                              <span className={cn(
                                "text-[10px] font-mono px-2 py-0.5 rounded-full",
                                diff > 0 ? "bg-red-500/20 text-red-400" : diff < 0 ? "bg-emerald-500/20 text-emerald-400" : "bg-white/10 text-white/40"
                              )}>
                                {diff > 0 ? "+" : ""}{percent.toFixed(1)}%
                              </span>
                              <span className={cn(
                                "text-[9px] font-mono opacity-80",
                                diff > 0 ? "text-red-400" : diff < 0 ? "text-emerald-400" : "text-white/40"
                              )}>
                                {diff > 0 ? "+" : ""}{diff.toFixed(2)} USD
                              </span>
                            </div>
                          </div>
                          <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-serif italic font-bold">${endPrice.toFixed(2)}</span>
                            <span className="text-[10px] opacity-40 font-mono">USD/kg ({format(addMonths(parseISO(currentMonth + "-01"), 1), "M월")} 예상)</span>
                          </div>
                          <div className="mt-2 h-1 bg-white/10 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-white transition-all duration-1000" 
                              style={{ width: `${Math.min(100, (endPrice / 25) * 100)}%`, opacity: 0.3 + (index * 0.2) }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                <div className="mt-12 pt-8 border-t border-white/10">
                  <p className="text-[10px] leading-relaxed opacity-50 italic">
                    * 위 수치는 현재 입력된 메탈 시세 전망치를 기준으로 계산된 예상 매입 단가입니다. 래깅 효과(1~3개월)가 반영되어 있습니다.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-[#141414]/10 rounded-sm overflow-hidden">
              <div className="p-4 bg-[#141414]/5 border-b border-[#141414]/10">
                <h3 className="text-[10px] font-bold uppercase tracking-widest">상세 단가 시뮬레이션 데이터</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#141414]/5 text-[10px] uppercase font-mono tracking-tighter">
                      <th className="p-4 border-b border-[#141414]/10">구분 (Month)</th>
                      {trendProducts
                        .filter(p => trendSelectedProductId === "all" || p.id === trendSelectedProductId)
                        .map(p => (
                        <th key={p.id} className="p-4 border-b border-[#141414]/10">{p.name} ($/kg)</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#141414]/10">
                    {trendData.map((row, idx) => (
                      <tr key={row.month} className={cn("hover:bg-[#141414]/5 transition-colors", row.month === currentMonth && "bg-yellow-50")}>
                        <td className="p-4 font-mono text-sm">
                          {row.month}
                          {row.month === currentMonth && <span className="ml-2 text-[10px] bg-[#141414] text-white px-1.5 py-0.5 rounded-full uppercase font-bold">Current</span>}
                        </td>
                        {trendProducts
                          .filter(p => trendSelectedProductId === "all" || p.id === trendSelectedProductId)
                          .map(p => {
                          const currentPrice = row[p.name] || 0;
                          const prevMonthPrice = idx > 0 ? trendData[idx-1][p.name] : null;
                          const diff = prevMonthPrice !== null ? currentPrice - prevMonthPrice : 0;
                          const percent = prevMonthPrice ? (diff / prevMonthPrice) * 100 : 0;
                          const isUp = diff > 0;
                          const isDown = diff < 0;
                          
                          return (
                            <td key={p.id} className="p-4 font-mono text-sm">
                              <div className="flex flex-col">
                                <span className="font-bold">${currentPrice.toFixed(2)}</span>
                                {prevMonthPrice !== null && (
                                  <div className={cn(
                                    "text-[10px] flex items-center gap-0.5 mt-0.5",
                                    isUp ? "text-red-500" : isDown ? "text-emerald-500" : "text-gray-400"
                                  )}>
                                    {isUp ? <TrendingUp size={10} /> : isDown ? <TrendingDown size={10} /> : null}
                                    <span>
                                      {isUp ? "+" : ""}{diff.toFixed(2)} ({isUp ? "+" : ""}{percent.toFixed(1)}%)
                                    </span>
                                  </div>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : activeTab === "reference" ? (
          <div className="space-y-6">
            <div className="bg-white border border-[#141414]/10 rounded-sm overflow-hidden transition-all">
              <div className="p-6 border-b border-[#141414]/10 flex justify-between items-center bg-[#141414]/5">
                <div>
                  <h2 className="text-xl font-bold tracking-tighter uppercase italic font-serif">메탈 시세 참조표</h2>
                  <p className="text-xs opacity-60 font-mono mt-1">시스템에서 참조하고 있는 전체 메탈 시세 데이터입니다.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleSaveMetalPrices}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 text-[10px] uppercase font-bold tracking-widest transition-all",
                      showMetalSaveSuccess 
                        ? "bg-emerald-500 text-white" 
                        : "bg-[#141414] text-white hover:bg-[#141414]/90"
                    )}
                  >
                    {showMetalSaveSuccess ? <Check size={14} /> : <Save size={14} />}
                    {showMetalSaveSuccess ? "저장 완료" : "시세 저장"}
                  </button>
                  <button 
                    onClick={() => {
                      setPasteMode("metal");
                      setShowPasteModal(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-[#141414]/5 text-[#141414] text-[10px] uppercase font-bold tracking-widest hover:bg-[#141414]/10 transition-colors border border-[#141414]/10"
                  >
                    <ClipboardPaste size={14} />
                    시세 정보 일괄 업로드
                  </button>
                  <div className="flex items-center gap-2 text-[10px] font-mono opacity-50 ml-2">
                    <Calendar size={12} /> 2025년 09월 ~ 2027년 12월
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#141414]/5 text-[10px] uppercase font-mono tracking-tighter">
                      <th className="p-4 border-b border-[#141414]/10">년</th>
                      <th className="p-4 border-b border-[#141414]/10">월</th>
                      <th className="p-4 border-b border-[#141414]/10">니켈 (Ni LME, $/kg)</th>
                      <th className="p-4 border-b border-[#141414]/10">코발트 (Co MB 99.3%, $/kg)</th>
                      <th className="p-4 border-b border-[#141414]/10">망간 (Mn MB 99.7%, $/kg)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#141414]/10">
                    {metalPrices.map((price) => {
                      const [year, month] = price.date.split("-");
                      const isFuture = price.date >= currentMonth;
                      return (
                        <tr key={price.date} className={cn("hover:bg-[#141414]/5 transition-colors group", isFuture && "bg-blue-50/30")}>
                          <td className="p-4 font-mono text-sm opacity-50">{year}</td>
                          <td className="p-4 font-bold font-mono text-sm">{month}</td>
                          <td className="p-4">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={price.ni}
                              onChange={(e) => handlePriceChange(price.date, "ni", e.target.value)}
                              className="w-full bg-transparent border-b border-transparent group-hover:border-[#141414]/20 focus:border-[#141414] focus:ring-0 p-1 font-mono text-sm transition-all"
                            />
                          </td>
                          <td className="p-4">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={price.co}
                              onChange={(e) => handlePriceChange(price.date, "co", e.target.value)}
                              className="w-full bg-transparent border-b border-transparent group-hover:border-[#141414]/20 focus:border-[#141414] focus:ring-0 p-1 font-mono text-sm transition-all"
                            />
                          </td>
                          <td className="p-4">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={price.mn}
                              onChange={(e) => handlePriceChange(price.date, "mn", e.target.value)}
                              className="w-full bg-transparent border-b border-transparent group-hover:border-[#141414]/20 focus:border-[#141414] focus:ring-0 p-1 font-mono text-sm transition-all"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-white border border-[#141414]/10 rounded-sm overflow-hidden">
              <div className="p-6 border-b border-[#141414]/10 bg-[#141414]/5 flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold tracking-tighter uppercase italic font-serif">품목별 메탈 함량 및 가공비 설정</h2>
                  <p className="text-xs opacity-60 font-mono mt-1">각 품목의 Ni, Co, Mn 함량 비율과 가공비를 설정합니다.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleSaveProducts}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 text-[10px] uppercase font-bold tracking-widest transition-all",
                      showSaveSuccess 
                        ? "bg-emerald-500 text-white" 
                        : "bg-[#141414] text-white hover:bg-[#141414]/90"
                    )}
                  >
                    {showSaveSuccess ? <Check size={14} /> : <Save size={14} />}
                    {showSaveSuccess ? "저장 완료" : "설정 저장"}
                  </button>
                  <button 
                    onClick={() => {
                      setPasteMode("product");
                      setShowPasteModal(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-[#141414]/5 text-[#141414] text-[10px] uppercase font-bold tracking-widest hover:bg-[#141414]/10 transition-colors border border-[#141414]/10"
                  >
                    <ClipboardPaste size={14} />
                    품목 정보 일괄 업로드
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#141414]/5 text-[10px] uppercase font-mono tracking-tighter">
                      <th className="p-4 border-b border-[#141414]/10">품목명</th>
                      <th className="p-4 border-b border-[#141414]/10">Ni 함량 (%)</th>
                      <th className="p-4 border-b border-[#141414]/10">Co 함량 (%)</th>
                      <th className="p-4 border-b border-[#141414]/10">Mn 함량 (%)</th>
                      <th className="p-4 border-b border-[#141414]/10">가공비 ($/kg)</th>
                      <th className="p-4 border-b border-[#141414]/10 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#141414]/10">
                    {products.map((product) => (
                      <tr key={product.id} className="hover:bg-[#141414]/5 transition-colors group">
                        <td className="p-4 font-bold text-sm">{product.name}</td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              step="0.0001"
                              value={Math.round(product.niRatio * 100 * 10000) / 10000}
                              onChange={(e) => handleProductChange(product.id, "niRatio", Number(e.target.value) / 100)}
                              className="w-24 bg-transparent border-b border-[#141414]/10 focus:border-[#141414] focus:ring-0 p-1 font-mono text-sm transition-all"
                            />
                            <span className="text-[10px] opacity-50">%</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              step="0.0001"
                              value={Math.round(product.coRatio * 100 * 10000) / 10000}
                              onChange={(e) => handleProductChange(product.id, "coRatio", Number(e.target.value) / 100)}
                              className="w-24 bg-transparent border-b border-[#141414]/10 focus:border-[#141414] focus:ring-0 p-1 font-mono text-sm transition-all"
                            />
                            <span className="text-[10px] opacity-50">%</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              step="0.0001"
                              value={Math.round(product.mnRatio * 100 * 10000) / 10000}
                              onChange={(e) => handleProductChange(product.id, "mnRatio", Number(e.target.value) / 100)}
                              className="w-24 bg-transparent border-b border-[#141414]/10 focus:border-[#141414] focus:ring-0 p-1 font-mono text-sm transition-all"
                            />
                            <span className="text-[10px] opacity-50">%</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] opacity-50">$</span>
                            <input
                              type="number"
                              step="0.1"
                              value={Math.round(product.processingFee * 100) / 100}
                              onChange={(e) => handleProductChange(product.id, "processingFee", Number(e.target.value))}
                              className="w-24 bg-transparent border-b border-[#141414]/10 focus:border-[#141414] focus:ring-0 p-1 font-mono text-sm transition-all"
                            />
                          </div>
                        </td>
                        <td className="p-4">
                          <button 
                            onClick={() => handleDeleteProduct(product.id)}
                            className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-all opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="bg-[#141414]/5 p-6 rounded-sm border border-[#141414]/10">
              <h4 className="font-bold uppercase text-xs tracking-widest mb-2 flex items-center gap-2">
                <Info size={14} /> 설정 안내
              </h4>
              <p className="text-sm opacity-70 leading-relaxed">
                여기서 수정한 함량과 가공비는 실시간으로 모든 분석 대시보드와 추이 그래프에 반영됩니다.
              </p>
            </div>

            <div className="bg-white border border-[#141414]/10 rounded-sm overflow-hidden">
              <div className="p-6 border-b border-[#141414]/10 bg-[#141414]/5 flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold tracking-tighter uppercase italic font-serif">금융 및 물류 비용 설정</h2>
                  <p className="text-xs opacity-60 font-mono mt-1">시뮬레이션에 사용되는 이자율과 창고 보관료 기준을 설정합니다.</p>
                </div>
                <button 
                  onClick={handleSaveFinanceSettings}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 text-[10px] uppercase font-bold tracking-widest transition-all",
                    showFinanceSaveSuccess 
                      ? "bg-emerald-500 text-white" 
                      : "bg-[#141414] text-white hover:bg-[#141414]/90"
                  )}
                >
                  {showFinanceSaveSuccess ? <Check size={14} /> : <Save size={14} />}
                  {showFinanceSaveSuccess ? "저장 완료" : "비용 설정 저장"}
                </button>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <label className="block">
                    <span className="text-[10px] uppercase font-bold tracking-widest opacity-50 flex items-center gap-2 mb-2">
                      <Percent size={12} /> 연 이자율 (Annual Interest Rate)
                    </span>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        value={simInterestRate}
                        onChange={(e) => setSimInterestRate(Number(e.target.value))}
                        className="w-full bg-[#141414]/5 border border-[#141414]/10 rounded-sm p-3 font-mono text-lg focus:border-[#141414] outline-none transition-all"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 font-mono opacity-50">%</span>
                    </div>
                    <p className="text-[10px] opacity-40 mt-2 italic">* 재고 금융 비용 산출의 기준이 됩니다.</p>
                  </label>
                </div>
                <div className="space-y-4">
                  <label className="block">
                    <span className="text-[10px] uppercase font-bold tracking-widest opacity-50 flex items-center gap-2 mb-2">
                      <DollarSign size={12} /> 창고 보관료 (Storage Fee per Ton/Month)
                    </span>
                    <div className="relative">
                      <input
                        type="number"
                        step="1"
                        value={simStorageFee}
                        onChange={(e) => setSimStorageFee(Number(e.target.value))}
                        className="w-full bg-[#141414]/5 border border-[#141414]/10 rounded-sm p-3 font-mono text-lg focus:border-[#141414] outline-none transition-all"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 font-mono opacity-50">$/ton</span>
                    </div>
                    <p className="text-[10px] opacity-40 mt-2 italic">* 월간 톤당 발생하는 보관 및 하역 비용입니다.</p>
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Paste Modal */}
      {showPasteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#141414]/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-2xl rounded-sm shadow-2xl border border-[#141414]/20 overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-[#141414]/10 flex justify-between items-center bg-[#141414]/5">
              <div>
                <h3 className="text-lg font-bold tracking-tighter uppercase italic font-serif">
                  {pasteMode === "metal" ? "메탈 시세 정보 일괄 업로드" : "전구체 품목 정보 일괄 업로드"}
                </h3>
                <p className="text-[10px] opacity-60 font-mono mt-1">
                  {pasteMode === "metal" 
                    ? "엑셀에서 [년, 월, Ni, Co, Mn] 영역을 복사(Ctrl+C)한 후 아래에 붙여넣기(Ctrl+V) 하세요."
                    : "엑셀에서 [품목명, Ni%, Co%, Mn%, 가공비] 영역을 복사(Ctrl+C)한 후 아래에 붙여넣기(Ctrl+V) 하세요."}
                </p>
              </div>
              <button onClick={() => setShowPasteModal(false)} className="p-2 hover:bg-[#141414]/10 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={pasteMode === "metal" ? "2026	01	15.5	12.2	1.8..." : "NCM811	0.8	0.1	0.1	2.0..."}
                className="w-full h-64 p-4 font-mono text-xs bg-[#141414]/5 border border-[#141414]/10 focus:border-[#141414] focus:ring-0 resize-none outline-none"
              />
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setShowPasteModal(false)}
                  className="px-6 py-2 text-[10px] uppercase font-bold tracking-widest hover:bg-[#141414]/5 transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={handlePasteData}
                  className="px-8 py-2 bg-[#141414] text-white text-[10px] uppercase font-bold tracking-widest hover:bg-[#141414]/90 transition-colors"
                >
                  데이터 반영하기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Custom Alert/Confirm Modal */}
      {alertConfig.show && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-[#141414]/80 backdrop-blur-md p-4 no-print">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#E4E3E0] border border-[#141414] p-8 max-w-md w-full relative"
          >
            <div className="flex items-start gap-4 mb-6">
              <div className={cn(
                "p-3 rounded-full",
                alertConfig.type === 'confirm' ? "bg-blue-500/10 text-blue-600" : "bg-amber-500/10 text-amber-600"
              )}>
                {alertConfig.type === 'confirm' ? <Info size={24} /> : <AlertCircle size={24} />}
              </div>
              <div>
                <h3 className="text-lg font-bold uppercase tracking-tighter italic font-serif mb-1 text-[#141414]">
                  {alertConfig.type === 'confirm' ? 'CONFIRMATION' : 'NOTIFICATION'}
                </h3>
                <p className="text-sm opacity-80 leading-relaxed text-[#141414]">{alertConfig.message}</p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              {alertConfig.type === 'confirm' && (
                <button 
                  onClick={() => setAlertConfig(prev => ({ ...prev, show: false }))}
                  className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-[#141414]/60 hover:text-[#141414] transition-colors"
                >
                  취소
                </button>
              )}
              <button 
                onClick={() => {
                  if (alertConfig.type === 'confirm' && alertConfig.onConfirm) {
                    alertConfig.onConfirm();
                  }
                  setAlertConfig(prev => ({ ...prev, show: false }));
                }}
                className="px-6 py-2 text-[10px] font-bold uppercase tracking-widest text-white bg-[#141414] hover:bg-[#141414]/90 transition-all"
              >
                확인
              </button>
            </div>
          </motion.div>
        </div>
      )}
      {/* Confidential Data Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 no-print">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white border border-[#141414] p-8 max-w-md w-full shadow-2xl"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-red-100 text-red-600 rounded-full">
                <ShieldAlert size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold uppercase italic font-serif">대외비 데이터 관리</h3>
                <p className="text-[10px] opacity-60 uppercase font-mono">Confidential Data Vault (Local Only)</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase font-bold mb-1 opacity-60">가공비 (Processing Cost, $/kg)</label>
                <input 
                  type="number" 
                  defaultValue={confidentialData.processingCost}
                  id="set_proc"
                  className="w-full bg-[#141414]/5 border border-[#141414]/10 p-2 font-mono outline-none focus:border-[#141414]"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold mb-1 opacity-60">금융비용 (Interest, %)</label>
                  <input 
                    type="number" 
                    defaultValue={confidentialData.interestRate}
                    id="set_int"
                    className="w-full bg-[#141414]/5 border border-[#141414]/10 p-2 font-mono outline-none focus:border-[#141414]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold mb-1 opacity-60">보관료 ($/kg/월)</label>
                  <input 
                    type="number" 
                    defaultValue={confidentialData.storageFee}
                    id="set_storage"
                    className="w-full bg-[#141414]/5 border border-[#141414]/10 p-2 font-mono outline-none focus:border-[#141414]"
                  />
                </div>
              </div>
            </div>

            <div className="mt-8 p-4 bg-amber-50 border border-amber-200 text-[10px] leading-relaxed opacity-80">
              <p className="font-bold mb-1">⚠️ 보안 안내:</p>
              이 데이터는 서버에 저장되지 않으며, 현재 사용 중인 브라우저의 로컬 저장소에만 보관됩니다. 
              오프라인 환경으로 내보낸 후에도 개별 PC에서 독립적으로 관리됩니다.
            </div>

            <div className="mt-8 pt-6 border-t border-[#141414]/10">
              <h4 className="text-[10px] font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
                <RotateCcw size={12} /> 시스템 복원 및 초기화
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={createRestorePoint}
                  className="py-2 bg-[#141414]/5 border border-[#141414]/10 text-[10px] font-bold uppercase tracking-widest hover:bg-[#141414]/10 transition-colors"
                >
                  현재 시점 저장
                </button>
                <button 
                  onClick={restoreFromPoint}
                  className="py-2 bg-[#141414]/5 border border-[#141414]/10 text-[10px] font-bold uppercase tracking-widest hover:bg-[#141414]/10 transition-colors"
                >
                  복원하기
                </button>
              </div>
              <button 
                onClick={resetToFactoryDefaults}
                className="w-full mt-3 py-2 border border-red-200 text-red-600 text-[10px] font-bold uppercase tracking-widest hover:bg-red-50 transition-colors"
              >
                공장 초기화 (원본 상태로)
              </button>
            </div>

            <div className="flex gap-3 mt-8">
              <button 
                onClick={() => setIsSettingsOpen(false)}
                className="flex-1 py-3 border border-[#141414] text-[10px] font-bold uppercase tracking-widest hover:bg-[#141414]/5 transition-colors"
              >
                취소
              </button>
              <button 
                onClick={() => {
                  saveConfidentialData({
                    processingCost: Number((document.getElementById('set_proc') as HTMLInputElement).value),
                    interestRate: Number((document.getElementById('set_int') as HTMLInputElement).value),
                    storageFee: Number((document.getElementById('set_storage') as HTMLInputElement).value),
                  });
                }}
                className="flex-1 py-3 bg-[#141414] text-white text-[10px] font-bold uppercase tracking-widest hover:bg-[#141414]/90 transition-colors"
              >
                설정 저장
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
