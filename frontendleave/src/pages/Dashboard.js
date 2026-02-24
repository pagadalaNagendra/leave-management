import React, { useEffect, useState } from 'react';
import { dashboardAPI } from '../services/api';
import './Dashboard.css';
import {
  BarChart, Bar, XAxis, YAxis,
  Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, LabelList
} from 'recharts';

import {
  FiUsers, FiClock, FiAlertCircle,
  FiSettings, FiSun, FiMoon
} from 'react-icons/fi';

const Dashboard = () => {
  const [leaveStats, setLeaveStats] = useState([]);
  const [loginData, setLoginData] = useState([]);
  const [loginView, setLoginView] = useState('last7'); // 'last7' or 'all'
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [summary, setSummary] = useState({
    totalEmployees: 0,
    onTime: 0,
    lateArrivals: 0,
    earlyDepartures: 0
  });
  const [yesterdayStats, setYesterdayStats] = useState({
    totalEmployees: null,
    onTime: null,
    lateArrivals: null,
    earlyDepartures: null
  });
  // Early departure state
  const [logoutData, setLogoutData] = useState([]);
  const [logoutView, setLogoutView] = useState('last7');

  const COLORS = ['#2f80ed', '#eb5757', '#27ae60', '#9b51e0', '#f2994a'];

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 7 }, (_, i) => currentYear - 5 + i);

  /* LIVE CLOCK */
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (date) =>
    date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const formatDate = (date) =>
    date.toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' });

  const timeToMinutes = (time) => {
    if (!time) return null;
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  };

  const minutesToTime = (min) => {
    if (min == null) return '';
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  /* FETCH DATA */
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      try {
        const { data } = await dashboardAPI.getUserLeaveTakenPendingExceed(selectedYear);
        setLeaveStats(data || []);
      } catch {
        setLeaveStats([]);
      }

      let loginPatternData = [];
      try {
        const { data } = await dashboardAPI.getDailyLoginPattern(selectedYear);
        const datesMap = {};
        Object.entries(data || {}).forEach(([username, records]) => {
          if (["sysadmin", "admin"].includes(username.toLowerCase()) && Object.keys(data).length > 1) return;
          Object.entries(records).forEach(([date, time]) => {
            if (!datesMap[date]) datesMap[date] = { date };
            datesMap[date][username] = timeToMinutes(time);
          });
        });
        const formatted = Object.values(datesMap).sort(
          (a, b) => new Date(a.date) - new Date(b.date)
        );
        setLoginData(formatted);
        loginPatternData = formatted;
      } catch {
        setLoginData([]);
        loginPatternData = [];
      }

      // Fetch logout pattern for early departure
      let logoutPatternData = [];
      try {
        const { data } = await dashboardAPI.getDailyLogoutPattern(selectedYear);
        const datesMap = {};
        Object.entries(data || {}).forEach(([username, records]) => {
          if (["sysadmin", "admin"].includes(username.toLowerCase()) && Object.keys(data).length > 1) return;
          Object.entries(records).forEach(([date, time]) => {
            if (!datesMap[date]) datesMap[date] = { date };
            // Early departure: before 18:30 (1110 min)
            datesMap[date][username] = time ? timeToMinutes(time) : null;
          });
        });
        const formatted = Object.values(datesMap).sort(
          (a, b) => new Date(a.date) - new Date(b.date)
        );
        setLogoutData(formatted);
        logoutPatternData = formatted;
      } catch {
        setLogoutData([]);
        logoutPatternData = [];
      }

      try {
        // Fetch dashboard summary using dashboardAPI
        const { data } = await dashboardAPI.getDashboardSummary();
        setSummary(data);
      } catch {
        setSummary({ totalEmployees: 0, onTime: 0, lateArrivals: 0, earlyDepartures: 0 });
      }

      // Calculate yesterday's stats
      try {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yDateStr = yesterday.toISOString().slice(0, 10);
        // Find yesterday's login data
        let yLogin = loginPatternData.find(d => d.date === yDateStr);
        // If not found, try with +1 day offset (to match tickFormatter logic)
        if (!yLogin) {
          const altDate = new Date(yesterday);
          altDate.setDate(altDate.getDate() - 1);
          const altDateStr = altDate.toISOString().slice(0, 10);
          yLogin = loginPatternData.find(d => d.date === altDateStr);
        }
        // For demo, just show number of users who have a value for that day as 'onTime', rest as 'lateArrivals'.
        if (yLogin) {
          const userTimes = Object.entries(yLogin).filter(([k]) => k !== 'date');
          const total = userTimes.length;
          // Let's say onTime is those who logged in <= 9:30 (570 min)
          const onTime = userTimes.filter(([, v]) => v != null && v <= 570).length;
          const late = userTimes.filter(([, v]) => v != null && v > 570).length;
          setYesterdayStats({
            totalEmployees: total,
            onTime,
            lateArrivals: late,
            earlyDepartures: null // Not available from login pattern
          });
        } else {
          setYesterdayStats({ totalEmployees: null, onTime: null, lateArrivals: null, earlyDepartures: null });
        }
      } catch {
        setYesterdayStats({ totalEmployees: null, onTime: null, lateArrivals: null, earlyDepartures: null });
      }

      setLoading(false);
    };
    fetchData();
  }, [selectedYear]);


  const users =
    loginData.length > 0
      ? Object.keys(loginData[0]).filter(k => k !== 'date')
      : [];
  const logoutUsers =
    logoutData.length > 0
      ? Object.keys(logoutData[0]).filter(k => k !== 'date')
      : [];

  // Filter loginData for last 7 unique dates (not just last 7 records)
  let loginDataFiltered = loginData;
  if (loginView === 'last7' && loginData.length > 0) {
    const allDates = loginData.map(d => d.date);
    const last7Dates = allDates.slice(-7);
    loginDataFiltered = loginData.filter(d => last7Dates.includes(d.date));
  }

  // Filter logoutData for last 7 unique dates
  let logoutDataFiltered = logoutData;
  if (logoutView === 'last7' && logoutData.length > 0) {
    const allDates = logoutData.map(d => d.date);
    const last7Dates = allDates.slice(-7);
    logoutDataFiltered = logoutData.filter(d => last7Dates.includes(d.date));
  }



  return (
    <div className="dashboard-container">

      {/* HEADER */}
      <div className="dashboard-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="breadcrumb"></div>
        <select
          value={selectedYear}
          onChange={e => setSelectedYear(Number(e.target.value))}
          style={{ minWidth: 120 }}
        >
          {yearOptions.map(year => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
      </div>

      {/* TOP WIDGETS */}
      <div className="top-widgets">

        <div className="time-card">
          <FiSun className="time-icon" />
          <div className="time">{formatTime(currentTime)}</div>
          <div className="subtle">Realtime Insight</div>

          <div className="today-label">Today:</div>
          <div className="date">{formatDate(currentTime)}</div>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div>
              <span>Total Employees</span>
              <div style={{ fontWeight: 'bold', fontSize: 24, marginTop: 4 }}>{summary.totalEmployees}</div>
            </div>
            <FiUsers className="card-icon blue" />
          </div>

          <div className="stat-card">
            <div>
              <span>On Time</span>
              <div style={{ fontWeight: 'bold', fontSize: 24, marginTop: 4 }}>{summary.onTime}</div>
            </div>
            <FiClock className="card-icon green" />
          </div>

          <div className="stat-card">
            <div>
              <span>Late Arrival</span>
              <div style={{ fontWeight: 'bold', fontSize: 24, marginTop: 4 }}>{summary.lateArrivals}</div>
            </div>
            <FiAlertCircle className="card-icon red" />
          </div>

          <div className="stat-card">
            <div>
              <span>
                Early Departures<span className="stat-subtext">  (Yesterday)</span>
                {yesterdayStats.earlyDepartures !== null && (
                  <span style={{ marginLeft: 8, fontSize: 12, color: '#b3b8c5', fontWeight: 400 }}>
                    (yest: {yesterdayStats.earlyDepartures})
                  </span>
                )}
              </span>
              <div style={{ fontWeight: 'bold', fontSize: 24, marginTop: 4 }}>{summary.earlyDepartures}</div>
            </div>
            <FiMoon className="card-icon purple" />
          </div>
        </div>
      </div>

      {/* TWO CHARTS */}
      <div className="charts-row">
        {/* Leave Summary Chart */}
        <div className="chart-card small" style={{ background: '#101c2c' }}>
          <h3 style={{ marginBottom: 18 }}>User-wise Leave Summary</h3>
          {loading || leaveStats.length === 0 ? (
            <div className="placeholder">No leave data</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={leaveStats} barGap={6} barCategoryGap={18}>
                <XAxis dataKey="username" tick={{ fill: '#b3b8c5', fontSize: 13 }} axisLine={{ stroke: '#222a3a' }} tickLine={false} />
                <YAxis tick={{ fill: '#b3b8c5', fontSize: 13 }} axisLine={{ stroke: '#222a3a' }} tickLine={false} grid={{ stroke: '#222a3a', strokeDasharray: '3 3' }} />
                <Tooltip
                  contentStyle={{ background: '#181f2e', border: 'none', borderRadius: 10, color: '#fff' }}
                  labelStyle={{ color: '#2f80ed', fontWeight: 'bold' }}
                  itemStyle={{ color: '#fff' }}
                  cursor={{ fill: '#222a3a', opacity: 0.2 }}
                />
                <Legend iconType="circle" wrapperStyle={{ color: '#b3b8c5', fontSize: 13 }} />
                <Bar dataKey="days_taken" stackId="a" fill="#2f80ed" radius={[8, 8, 0, 0]} />
                <Bar dataKey="days_pending" stackId="a" fill="#f2994a" radius={[8, 8, 0, 0]} />
                <Bar dataKey="limit_exceed" stackId="a" fill="#eb5757" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Late Arrival Chart */}
        <div className="chart-card small" style={{ background: '#101c2c' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <h3 style={{ marginBottom: 0 }}>Late Arrival summary</h3>
            <select
              value={loginView}
              onChange={e => setLoginView(e.target.value)}
              style={{ background: '#181f2e', color: '#b3b8c5', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 13 }}
            >
              <option value="last7">Last 7 Days</option>
              <option value="all">All Days</option>
            </select>
          </div>
          {loginDataFiltered.length === 0 ? (
            <div className="placeholder">No login data</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={loginDataFiltered} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#b3b8c5', fontSize: 13 }}
                  axisLine={{ stroke: '#222a3a' }}
                  tickLine={false}
                  tickFormatter={date => {
                    if (!date) return '';
                    const d = new Date(date);
                    d.setDate(d.getDate() + 1);
                    return d.toISOString().slice(0, 10);
                  }}
                />
                <YAxis
                  domain={[0, 1440]}
                  tickFormatter={v => Math.floor(v / 60)}
                  ticks={[0, 60, 120, 180, 240, 300, 360, 420, 480, 540, 600, 660, 720, 780, 840, 900, 960, 1020, 1080, 1140, 1200, 1260, 1320, 1380, 1440]}
                  tick={{ fill: '#b3b8c5', fontSize: 13 }}
                  axisLine={{ stroke: '#222a3a' }}
                  tickLine={false}
                  grid={{ stroke: '#222a3a', strokeDasharray: '3 3' }}
                  label={{ value: 'Hour', angle: -90, position: 'insideLeft', fill: '#b3b8c5', fontSize: 13 }}
                />
                <Tooltip
                  formatter={minutesToTime}
                  contentStyle={{ background: '#181f2e', border: 'none', borderRadius: 10, color: '#fff' }}
                  labelStyle={{ color: '#2f80ed', fontWeight: 'bold' }}
                  itemStyle={{ color: '#fff' }}
                  cursor={{ fill: '#222a3a', opacity: 0.2 }}
                  labelFormatter={date => {
                    if (!date) return '';
                    const d = new Date(date);
                    d.setDate(d.getDate() + 1);
                    return d.toISOString().slice(0, 10);
                  }}
                />
                {users.map((user, index) => (
                  <Line
                    key={user}
                    type="monotone"
                    dataKey={user}
                    stroke={COLORS[index % COLORS.length]}
                    strokeWidth={3}
                    dot={false}
                    activeDot={{ r: 6 }}
                  >
                    <LabelList
                      dataKey={user}
                      position="top"
                      formatter={minutesToTime}
                      fill={COLORS[index % COLORS.length]}
                      fontSize={11}
                      content={({ x, y, value }) => {
                        if (value == null) return null;
                        return (
                          <text x={x} y={y - 6} textAnchor="middle" fill={COLORS[index % COLORS.length]} fontSize="11">
                            {minutesToTime(value)}
                          </text>
                        );
                      }}
                    />
                  </Line>
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Early Departure Chart */}
        <div className="chart-card small" style={{ background: '#101c2c' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <h3 style={{ marginBottom: 0 }}>Early Departure summary</h3>
            <select
              value={logoutView}
              onChange={e => setLogoutView(e.target.value)}
              style={{ background: '#181f2e', color: '#b3b8c5', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 13 }}
            >
              <option value="last7">Last 7 Days</option>
              <option value="all">All Days</option>
            </select>
          </div>
          {logoutDataFiltered.length === 0 ? (
            <div className="placeholder">No logout data</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={logoutDataFiltered} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#b3b8c5', fontSize: 13 }}
                  axisLine={{ stroke: '#222a3a' }}
                  tickLine={false}
                  tickFormatter={date => {
                    if (!date) return '';
                    const d = new Date(date);
                    d.setDate(d.getDate() + 1);
                    return d.toISOString().slice(0, 10);
                  }}
                />
                <YAxis
                  domain={[0, 1440]}
                  tickFormatter={v => Math.floor(v / 60)}
                  ticks={[0, 60, 120, 180, 240, 300, 360, 420, 480, 540, 600, 660, 720, 780, 840, 900, 960, 1020, 1080, 1140, 1200, 1260, 1320, 1380, 1440]}
                  tick={{ fill: '#b3b8c5', fontSize: 13 }}
                  axisLine={{ stroke: '#222a3a' }}
                  tickLine={false}
                  grid={{ stroke: '#222a3a', strokeDasharray: '3 3' }}
                  label={{ value: 'Hour', angle: -90, position: 'insideLeft', fill: '#b3b8c5', fontSize: 13 }}
                />
                <Tooltip
                  formatter={minutesToTime}
                  contentStyle={{ background: '#181f2e', border: 'none', borderRadius: 10, color: '#fff' }}
                  labelStyle={{ color: '#f2994a', fontWeight: 'bold' }}
                  itemStyle={{ color: '#fff' }}
                  cursor={{ fill: '#222a3a', opacity: 0.2 }}
                  labelFormatter={date => {
                    if (!date) return '';
                    const d = new Date(date);
                    d.setDate(d.getDate() + 1);
                    return d.toISOString().slice(0, 10);
                  }}
                />
                {logoutUsers.map((user, index) => (
                  <Line
                    key={user}
                    type="monotone"
                    dataKey={user}
                    stroke={COLORS[index % COLORS.length]}
                    strokeWidth={3}
                    dot={false}
                    activeDot={{ r: 6 }}
                  >
                    <LabelList
                      dataKey={user}
                      position="top"
                      formatter={minutesToTime}
                      fill={COLORS[index % COLORS.length]}
                      fontSize={11}
                      content={({ x, y, value }) => {
                        if (value == null) return null;
                        return (
                          <text x={x} y={y - 6} textAnchor="middle" fill={COLORS[index % COLORS.length]} fontSize="11">
                            {minutesToTime(value)}
                          </text>
                        );
                      }}
                    />
                  </Line>
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;