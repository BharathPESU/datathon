"use client";
import { useState, useEffect } from "react";
import { TrendingUp, Sparkles, MapPin, BarChart3, LineChart } from "lucide-react";
import { 
  AreaChart, Area, BarChart, Bar, 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from "recharts";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth";

export default function TrendsPage() {
  const { user } = useAuthStore();
  const [forecast, setForecast] = useState<any[]>([]);
  const [districts, setDistricts] = useState<any[]>([]);
  const [steps, setSteps] = useState(6);
  const [loading, setLoading] = useState(true);

  const role = user?.role?.toLowerCase();
  const hasAccess = role === "admin" || role === "supervisor" || role === "analyst";

  useEffect(() => {
    if (!hasAccess) {
      setLoading(false);
      return;
    }
    async function loadData() {
      setLoading(true);
      try {
        const [forecastRes, districtRes] = await Promise.all([
          api.forecast.timeline(steps),
          api.analytics.districtComparison({ top_n: 10 })
        ]);
        setForecast(forecastRes.data);
        setDistricts(districtRes.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [steps]);

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <TrendingUp className="w-12 h-12 text-[var(--danger)]" />
        <h3 className="text-lg font-bold text-white">Access Denied</h3>
        <p className="text-sm text-[var(--foreground-dim)] text-center max-w-sm">
          Your current security authorization level ({user?.role}) does not have permission to view predictive crime forecasting models.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-96 rounded-xl" />
        <div className="skeleton h-96 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold gradient-text">Recidivism Forecasts & Trends</h2>
          <p className="text-xs text-[var(--foreground-dim)]">Polynomial regression caseload projections and geographical comparative graphs</p>
        </div>

        {/* Steps selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[var(--foreground-dim)]">Projections:</span>
          <select 
            className="input py-1 text-xs w-28 bg-[var(--surface-dim)] border-[var(--border)] text-white outline-none cursor-pointer"
            value={steps}
            onChange={(e) => setSteps(parseInt(e.target.value))}
          >
            <option value={3}>3 Months</option>
            <option value={6}>6 Months</option>
            <option value={12}>12 Months</option>
          </select>
        </div>
      </div>

      {/* Caseload Projections chart */}
      <div className="chart-container flex flex-col justify-between min-h-[400px]">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold flex items-center gap-2">
              <LineChart className="w-4.5 h-4.5 text-[var(--primary)]" />
              <span>Predictive Caseload Forecast</span>
            </h3>
            <p className="text-xs text-[var(--foreground-dim)]">Shaded zone represents confidence bounds</p>
          </div>
          <span className="badge badge-success text-[10px]">Model: OLS Linear Regression</span>
        </div>

        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={forecast} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorPredicted" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorConfidence" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="var(--accent)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey="period" stroke="var(--foreground-dim)" fontSize={10} />
              <YAxis stroke="var(--foreground-dim)" fontSize={10} />
              <Tooltip contentStyle={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--foreground)" }} />
              <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="confidence_upper" stroke="transparent" fill="url(#colorConfidence)" name="Confidence Boundary (Upper)" />
              <Area type="monotone" dataKey="predicted_count" stroke="var(--primary)" strokeWidth={2} fill="url(#colorPredicted)" name="Projected Caseload" />
              <Area type="monotone" dataKey="confidence_lower" stroke="transparent" fill="transparent" name="Confidence Boundary (Lower)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* District comparative analysis chart */}
      <div className="chart-container flex flex-col justify-between min-h-[400px]">
        <div className="mb-4">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <BarChart3 className="w-4.5 h-4.5 text-[var(--accent)]" />
            <span>District Comparative Caseload Analysis</span>
          </h3>
          <p className="text-xs text-[var(--foreground-dim)]">Caseload ranking across top 10 districts in Karnataka</p>
        </div>

        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={districts} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey="district" stroke="var(--foreground-dim)" fontSize={10} />
              <YAxis stroke="var(--foreground-dim)" fontSize={10} />
              <Tooltip contentStyle={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--foreground)" }} />
              <Bar dataKey="count" fill="var(--accent)" name="Total Cases" radius={[4, 4, 0, 0]}>
                {districts.map((entry: any, index: number) => (
                  <Area key={`bar-${index}`} type="monotone" dataKey="count" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
}