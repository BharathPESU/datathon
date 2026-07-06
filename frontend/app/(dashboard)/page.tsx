"use client";
import { useState, useEffect } from "react";
import { 
  FileText, Users, ShieldAlert, Activity, Scale, Clock, TrendingUp, TrendingDown 
} from "lucide-react";
import { 
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from "recharts";
import api from "@/lib/api";

function KPICard({ title, value, icon: Icon, change, changeType, color, delay }: {
  title: string; value: string | number; icon: any; change?: string;
  changeType?: "up" | "down" | "neutral"; color: string; delay: number;
}) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <div className={`glass-card p-6 transition-all duration-500 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-[var(--foreground-dim)] uppercase tracking-wider">{title}</p>
          <p className="text-3xl font-extrabold mt-2" style={{ color }}>{typeof value === "number" ? value.toLocaleString() : value}</p>
          {change && (
            <div className={`flex items-center gap-1 mt-2 text-xs font-semibold ${
              changeType === "up" ? "text-[var(--success)]" :
              changeType === "down" ? "text-[var(--danger)]" :
              "text-[var(--foreground-dim)]"
            }`}>
              {changeType === "up" ? <TrendingUp className="w-3.5 h-3.5" /> : changeType === "down" ? <TrendingDown className="w-3.5 h-3.5" /> : null}
              <span>{change}</span>
            </div>
          )}
        </div>
        <div className="p-3 rounded-xl" style={{ background: `${color}15` }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [kpis, setKpis] = useState<any>(null);
  const [trends, setTrends] = useState<any>([]);
  const [categories, setCategories] = useState<any>([]);
  const [hotspots, setHotspots] = useState<any>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [kpiRes, trendRes, catRes, hotRes] = await Promise.all([
          api.analytics.kpis(),
          api.analytics.trends(),
          api.analytics.categoryDistribution(),
          api.forecast.hotspots()
        ]);
        setKpis(kpiRes);
        setTrends(trendRes.data);
        setCategories(catRes.data);
        setHotspots(hotRes.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-32 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="skeleton h-96 rounded-xl lg:col-span-2" />
          <div className="skeleton h-96 rounded-xl" />
        </div>
      </div>
    );
  }

  const PIE_COLORS = ["#3B82F6", "#8B5CF6", "#10B981", "#F59E0B", "#EF4444", "#EC4899"];

  return (
    <div className="space-y-6">
      
      {/* Welcome Title */}
      <div>
        <h2 className="text-xl font-bold gradient-text">Command & Intelligence Dashboard</h2>
        <p className="text-xs text-[var(--foreground-dim)]">Real-time surveillance analytics, predicted trends, and operational parameters</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
        <KPICard 
          title="Total Registered Cases" 
          value={kpis?.total_cases || 0} 
          icon={FileText} 
          change="+4.2% YoY increase" 
          changeType="up"
          color="var(--primary)"
          delay={0}
        />
        <KPICard 
          title="Active Investigations" 
          value={kpis?.active_investigations || 0} 
          icon={Activity} 
          change="84.5 days average length" 
          changeType="neutral"
          color="var(--accent)"
          delay={100}
        />
        <KPICard 
          title="Historical Conviction Rate" 
          value={`${kpis?.conviction_rate || 0}%`} 
          icon={Scale} 
          change="+1.5% from last Qtr" 
          changeType="up"
          color="var(--success)"
          delay={200}
        />
        <KPICard 
          title="Repeat Offenders Identified" 
          value={kpis?.repeat_offenders || 0} 
          icon={ShieldAlert} 
          change="High recidivism severity" 
          changeType="down"
          color="var(--danger)"
          delay={300}
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Crime Trend Over Time */}
        <div className="chart-container lg:col-span-2 flex flex-col justify-between">
          <div className="mb-4">
            <h3 className="text-sm font-bold">Temporal Case Trends</h3>
            <p className="text-xs text-[var(--foreground-dim)]">Caseload tracking aggregated monthly</p>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="period" stroke="var(--foreground-dim)" fontSize={10} />
                <YAxis stroke="var(--foreground-dim)" fontSize={10} />
                <Tooltip 
                  contentStyle={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--foreground)" }} 
                  itemStyle={{ color: "var(--primary)" }}
                />
                <Area type="monotone" dataKey="count" stroke="var(--primary)" strokeWidth={2} fillOpacity={1} fill="url(#colorCount)" name="FIRs" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Crime Type Share */}
        <div className="chart-container flex flex-col justify-between">
          <div className="mb-4">
            <h3 className="text-sm font-bold">Crime Category Distribution</h3>
            <p className="text-xs text-[var(--foreground-dim)]">Breakdown percentage by major heads</p>
          </div>
          <div className="h-72 w-full relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categories}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={4}
                  dataKey="count"
                  nameKey="category"
                >
                  {categories.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--foreground)" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* Bottom Panel: Predicted Hotspots */}
      <div className="chart-container">
        <div className="mb-4">
          <h3 className="text-sm font-bold">Predicted Future Hotspots</h3>
          <p className="text-xs text-[var(--foreground-dim)]">Spatial geohash areas flagging high future crime probability</p>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Region</th>
                <th>Target Latitude</th>
                <th>Target Longitude</th>
                <th>Caseload Density</th>
                <th>Flag / Status</th>
              </tr>
            </thead>
            <tbody>
              {hotspots.map((pt: any, idx: number) => (
                <tr key={idx}>
                  <td className="font-semibold text-white">{pt.district}</td>
                  <td>{pt.latitude.toFixed(4)}</td>
                  <td>{pt.longitude.toFixed(4)}</td>
                  <td>{pt.count} cases</td>
                  <td>
                    <span className="badge badge-danger">High Risk</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}